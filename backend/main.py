
import os
import json
import uuid
from io import BytesIO
import traceback

from dotenv import load_dotenv
from fastapi import FastAPI, UploadFile, File, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from google import genai
from pypdf import PdfReader

load_dotenv()

api_key = os.getenv("GEMINI_API_KEY")
model = os.getenv("GEMINI_MODEL", "gemini-2.5-flash")

if not api_key:
    raise RuntimeError("GEMINI_API_KEY is missing in .env")

client = genai.Client(api_key=api_key)

app = FastAPI(title="DocuMind AI")


app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",
        "http://localhost:5174",
        "https://documind-ai-frontend-coral.vercel.app"
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


documents = {}


class QuestionRequest(BaseModel):
    document_id: str
    question: str


class DocumentRequest(BaseModel):
    document_id: str


def split_text(text, chunk_size=1200, overlap=200):
    chunks = []
    start = 0

    while start < len(text):
        end = start + chunk_size
        chunks.append(text[start:end])
        start += chunk_size - overlap

    return chunks


def retrieve_chunks(chunks, question, limit=4):
    words = set(question.lower().split())
    scored = []

    for chunk in chunks:
        chunk_words = set(chunk.lower().split())
        score = len(words.intersection(chunk_words))
        scored.append((score, chunk))

    scored.sort(key=lambda item: item[0], reverse=True)

    return [
        chunk for score, chunk in scored[:limit]
        if score > 0
    ]



def ask_gemini(instructions, prompt):
    try:
        print("Sending request to Gemini...", flush=True)

        response = client.models.generate_content(
            model=model,
            contents=f"{instructions}\n\n{prompt}"
        )

        print("Gemini response received.", flush=True)

        if not response.text:
            raise HTTPException(
                502, "Gemini returned an empty response"
            )

        return response.text

    except HTTPException:
        raise

    except Exception:
        print("FULL GEMINI ERROR:", flush=True)
        traceback.print_exc()
        raise HTTPException(
            502, "AI request failed. Check backend terminal."
        )


@app.get("/")
def home():
    return {"message": "DocuMind AI API is running"}


@app.get("/health")
def health():
    return {"status": "healthy"}


@app.post("/upload")
async def upload_document(file: UploadFile = File(...)):
    if not file.filename.lower().endswith(".pdf"):
        raise HTTPException(400, "Only PDF files are supported")

    content = await file.read()

    if len(content) > 10 * 1024 * 1024:
        raise HTTPException(413, "PDF must be smaller than 10 MB")

    try:
        reader = PdfReader(BytesIO(content))

        if reader.is_encrypted:
            raise HTTPException(400, "Encrypted PDFs are not supported")

        text = "\n".join(
            page.extract_text() or ""
            for page in reader.pages
        )

    except HTTPException:
        raise
    except Exception as e:
        print("PDF error:", repr(e))
        raise HTTPException(400, "Could not read this PDF")

    if not text.strip():
        raise HTTPException(
            400,
            "No readable text found. Scanned PDFs need OCR."
        )

    doc_id = str(uuid.uuid4())
    chunks = split_text(text)

    documents[doc_id] = {
        "filename": file.filename,
        "text": text,
        "chunks": chunks
    }

    return {
        "document_id": doc_id,
        "filename": file.filename,
        "pages": len(reader.pages),
        "chunks": len(chunks),
        "message": "Document uploaded successfully"
    }


@app.post("/summarize")
def summarize(request: DocumentRequest):
    doc = documents.get(request.document_id)

    if not doc:
        raise HTTPException(404, "Document not found")

    summary = ask_gemini(
        "Summarize the document accurately. Do not invent facts. "
        "Highlight important details and missing information.",
        doc["text"][:15000]
    )

    return {"summary": summary}


@app.post("/ask")
def ask_document(request: QuestionRequest):
    doc = documents.get(request.document_id)

    if not doc:
        raise HTTPException(404, "Document not found")

    matches = retrieve_chunks(
        doc["chunks"],
        request.question
    )

    if not matches:
        return {
            "answer": "I could not find relevant information in this document."
        }

    context = "\n\n".join(matches)

    answer = ask_gemini(
        "Answer only using the supplied document context. "
        "If the answer is missing, say so. "
        "Do not invent medical facts. This is not a diagnosis tool.",
        f"DOCUMENT CONTEXT:\n{context}\n\n"
        f"USER QUESTION:\n{request.question}"
    )

    return {"answer": answer}


@app.post("/extract-json")
def extract_json(request: DocumentRequest):
    doc = documents.get(request.document_id)

    if not doc:
        raise HTTPException(404, "Document not found")

    result_text = ask_gemini(
        "Extract information from the document as valid JSON only. "
        "Do not use Markdown code fences. Use null for missing values. "
        "Do not invent information. Use these keys: "
        "document_type, important_findings, "
        "extracted_information.",
        doc["text"][:12000]
    )

    try:
        cleaned = result_text.strip()

        if cleaned.startswith("```"):
            cleaned = cleaned.replace("```json", "", 1)
            cleaned = cleaned.replace("```", "").strip()

        result = json.loads(cleaned)

    except json.JSONDecodeError:
        raise HTTPException(502, "Gemini returned invalid JSON")

    return {"data": result}
