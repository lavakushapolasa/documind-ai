
import { useState } from "react";
import {
  FileText,
  Upload,
  MessageCircle,
  Sparkles,
  Brain,
  LoaderCircle,
  FileJson,
  Send,
  CheckCircle,
  Stethoscope
} from "lucide-react";

import "./App.css";

const API =
  import.meta.env.VITE_API_URL || "http://localhost:8000";

function App() {
  const [file, setFile] = useState(null);
  const [documentId, setDocumentId] = useState("");
  const [documentName, setDocumentName] = useState("");

  const [question, setQuestion] = useState("");
  const [answer, setAnswer] = useState("");
  const [summary, setSummary] = useState("");
  const [jsonData, setJsonData] = useState(null);

  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState("");

  // Upload PDF
  async function uploadDocument() {
    if (!file) {
      setStatus("Please select a PDF document.");
      return;
    }

    setLoading(true);
    setStatus("");

    try {
      const formData = new FormData();
      formData.append("file", file);

      const response = await fetch(`${API}/upload`, {
        method: "POST",
        body: formData
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.detail || "Upload failed");
      }

      setDocumentId(data.document_id);
      setDocumentName(data.filename);

      setStatus(
        `Upload successful! ${data.pages} pages processed.`
      );

      setAnswer("");
      setSummary("");
      setJsonData(null);

    } catch (error) {
      setStatus(error.message);
    } finally {
      setLoading(false);
    }
  }

  // Common API function
  async function callAPI(endpoint, body) {
    setLoading(true);
    setStatus("");

    try {
      const response = await fetch(`${API}/${endpoint}`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify(body)
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.detail || "Request failed");
      }

      if (endpoint === "ask") {
        setAnswer(data.answer);
      }

      if (endpoint === "summarize") {
        setSummary(data.summary);
      }

      if (endpoint === "extract-json") {
        setJsonData(data.data);
      }

    } catch (error) {
      setStatus(error.message);
    } finally {
      setLoading(false);
    }
  }

  // Ask document
  function askQuestion(e) {
    e.preventDefault();

    if (!question.trim() || !documentId) {
      return;
    }

    callAPI("ask", {
      document_id: documentId,
      question: question
    });
  }

  return (
    <div className="app">

      {/* Header */}
      <header className="header">
        <div className="brand">
          <div className="brand-icon">
            <Brain size={25} />
          </div>

          <div>
            <h2>DocuMind AI</h2>
            <span>Intelligent Document Assistant</span>
          </div>
        </div>

        <div className="online">
          <span></span>
          AI Assistant
        </div>
      </header>

      <main className="container">

        {/* Hero */}
        <section className="hero">
          <div className="tag">
            <Sparkles size={14} />
            POWERED BY GENERATIVE AI
          </div>

          <h1>
            Understand your documents
            <br />
            <span>with the power of AI.</span>
          </h1>

          <p>
            Upload documents, ask questions and
            generate intelligent summaries.
          </p>
        </section>

        {/* Upload */}
        <section className="upload-card">
          <div className="section-title">
            <FileText size={30} />

            <div>
              <h3>Upload your document</h3>
              <p>
                Upload a PDF file to get started.
                Maximum size: 10 MB.
              </p>
            </div>
          </div>

          <label className="dropzone">
            <Upload size={34} />

            <strong>
              {file
                ? file.name
                : "Choose your PDF file"}
            </strong>

            <span>Click here to browse files</span>

            <input
              type="file"
              accept=".pdf,application/pdf"
              onChange={(e) => {
                setFile(e.target.files[0]);
                setStatus("");
              }}
            />
          </label>

          <button
            className="primary"
            onClick={uploadDocument}
            disabled={loading}
          >
            {loading ? (
              <LoaderCircle className="spin" />
            ) : (
              <Upload size={17} />
            )}

            Upload Document
          </button>

          {status && (
            <p className="status">{status}</p>
          )}

          {documentId && (
            <div className="uploaded">
              <CheckCircle size={19} />

              <span>
                Active document:
                <b> {documentName}</b>
              </span>
            </div>
          )}
        </section>

        {/* AI Workspace */}
        <section className="features">

          <div className="section-heading">
            <h2>AI Workspace</h2>
            <p>
              Choose what you want to do with your document.
            </p>
          </div>

          <div className="grid">

            {/* Summary */}
            <article className="feature-card">
              <div className="feature-icon purple">
                <Sparkles size={23} />
              </div>

              <h3>AI Summary</h3>

              <p>
                Generate a clear summary of your
                uploaded document.
              </p>

              <button
                className="secondary"
                disabled={!documentId || loading}
                onClick={() =>
                  callAPI("summarize", {
                    document_id: documentId
                  })
                }
              >
                Generate Summary
              </button>

              {summary && (
                <div className="result">
                  {summary}
                </div>
              )}
            </article>

            {/* Chat */}
            <article className="feature-card">
              <div className="feature-icon blue">
                <MessageCircle size={23} />
              </div>

              <h3>Ask Your Document</h3>

              <p>
                Ask questions and retrieve
                relevant document information.
              </p>

              <form onSubmit={askQuestion}>
                <input
                  value={question}
                  onChange={(e) =>
                    setQuestion(e.target.value)
                  }
                  placeholder="Ask a question..."
                  disabled={!documentId || loading}
                />

                <button
                  className="primary"
                  disabled={!documentId || loading}
                >
                  <Send size={16} />
                  Ask AI
                </button>
              </form>

              {answer && (
                <div className="result">
                  {answer}
                </div>
              )}
            </article>

            {/* JSON */}
            <article className="feature-card">
              <div className="feature-icon orange">
                <FileJson size={23} />
              </div>

              <h3>Structured JSON</h3>

              <p>
                Extract document information
                into structured JSON.
              </p>

              <button
                className="secondary"
                disabled={!documentId || loading}
                onClick={() =>
                  callAPI("extract-json", {
                    document_id: documentId
                  })
                }
              >
                Extract JSON
              </button>

              {jsonData && (
                <pre className="result json">
                  {JSON.stringify(jsonData, null, 2)}
                </pre>
              )}
            </article>

          </div>
        </section>

        {/* Healthcare information */}
        <section className="notice">
          <Stethoscope size={20} />

          <p>
            <b>Healthcare document assistant</b>
            <br />
            This application is a document-processing
            demo, not a medical diagnosis system.
          </p>
        </section>

        <footer>
          DocuMind AI · Built with React, Python and OpenAI
        </footer>

      </main>
    </div>
  );
}

export default App;
