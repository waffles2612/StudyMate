import React, { useState } from "react";
import axios from "axios";
import ReactMarkdown from "react-markdown";  // ✅ Added


const TUTOR_BACKEND_URL =
  process.env.REACT_APP_BACKEND_URL || "http://localhost:3002";

export default function TutorApp() {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [pdfFile, setPdfFile] = useState(null);
  const [pdfQuestion, setPdfQuestion] = useState("");
  const [loading, setLoading] = useState(false);

  const sendMessage = async () => {
    if (!input) return;
    const userMsg = { from: "user", text: input, time: new Date() };
    setMessages((prev) => [...prev, userMsg]);
    setInput("");
    setLoading(true);

    try {
      const res = await axios.post(`${TUTOR_BACKEND_URL}/api/ai-tutor/ask`, {
        question: input,
      });
      const botMsg = {
        from: "bot",
        text: res.data.answer,
        time: new Date(),
      };
      setMessages((prev) => [...prev, botMsg]);
    } catch {
      setMessages((prev) => [
        ...prev,
        { from: "bot", text: "❌ Error: failed to get response", time: new Date() },
      ]);
    } finally {
      setLoading(false);
    }
  };

  const askFromPdf = async () => {
    if (!pdfFile || !pdfQuestion) {
      alert("Please upload a PDF and enter your question.");
      return;
    }
    const userMsg = {
      from: "user",
      text: `(PDF) ${pdfQuestion}`,
      time: new Date(),
    };
    setMessages((prev) => [...prev, userMsg]);
    setLoading(true);

    const formData = new FormData();
    formData.append("file", pdfFile);
    formData.append("question", pdfQuestion);

    try {
      const res = await axios.post(
        `${TUTOR_BACKEND_URL}/api/ai-tutor/pdf`,
        formData,
        { headers: { "Content-Type": "multipart/form-data" } }
      );
      const botMsg = {
        from: "bot",
        text: res.data.answer,
        time: new Date(),
      };
      setMessages((prev) => [...prev, botMsg]);
    } catch {
      setMessages((prev) => [
        ...prev,
        { from: "bot", text: "❌ Error: failed to get PDF answer", time: new Date() },
      ]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      style={{
        fontFamily: "Inter, sans-serif",
        padding: "30px",
        maxWidth: "900px",
        margin: "0 auto",
        background: "#f9fafb",
        borderRadius: 12,
        boxShadow: "0 4px 12px rgba(0,0,0,0.1)",
      }}
    >
      <h2 style={{ textAlign: "center", marginBottom: 20 }}>
        💬 <span style={{ color: "#2563eb" }}>AI Study Companion</span> + 📄 PDF Tutor
      </h2>

      {/* Chat Window */}
      <div
        style={{
          border: "1px solid #ddd",
          borderRadius: 10,
          padding: 15,
          height: 420,
          overflowY: "auto",
          marginBottom: 20,
          background: "white",
        }}
      >
        {messages.map((m, i) => (
          <div
            key={i}
            style={{
              background: m.from === "user" ? "#dbeafe" : "#dcfce7",
              padding: "10px 14px",
              borderRadius: 12,
              margin: "8px 0",
              maxWidth: "80%",
              alignSelf: m.from === "user" ? "flex-end" : "flex-start",
              textAlign: "left",
            }}
          >
            <div style={{ fontSize: 14, marginBottom: 4, opacity: 0.7 }}>
                {m.from === "user" ? "👤 You" : "🤖 Tutor"} —{" "}
             {m.time
                ? m.time.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
                 : ""}
        </div>

        {m.from === "bot" ? (
        <ReactMarkdown>{m.text || ""}</ReactMarkdown> 
        ) : (
        <p style={{ margin: 0 }}>{m.text}</p>
     )}
  </div>
))}
        {loading && <p style={{ fontStyle: "italic", color: "#888" }}>Tutor is thinking...</p>}
      </div>

      {/* Chat input */}
      <div style={{ display: "flex", gap: 10, marginBottom: 25 }}>
        <input
          style={{
            flex: 1,
            padding: "10px 12px",
            borderRadius: 8,
            border: "1px solid #ccc",
          }}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Type your question here..."
        />
        <button
          onClick={sendMessage}
          disabled={loading}
          style={{
            padding: "10px 16px",
            border: "none",
            borderRadius: 8,
            background: loading ? "#94a3b8" : "#2563eb",
            color: "white",
            cursor: loading ? "not-allowed" : "pointer",
            transition: "0.2s",
          }}
        >
          {loading ? "Sending..." : "Send"}
        </button>
      </div>

      {/* PDF Section */}
      <h4>📄 Ask a Question from PDF</h4>
      <input
        type="file"
        accept="application/pdf"
        onChange={(e) => setPdfFile(e.target.files[0])}
      />
      <div style={{ display: "flex", gap: 10, marginTop: 12 }}>
        <input
          style={{
            flex: 1,
            padding: "10px 12px",
            borderRadius: 8,
            border: "1px solid #ccc",
          }}
          value={pdfQuestion}
          onChange={(e) => setPdfQuestion(e.target.value)}
          placeholder="Enter your question about the PDF..."
        />
        <button
          onClick={askFromPdf}
          disabled={loading}
          style={{
            padding: "10px 16px",
            border: "none",
            borderRadius: 8,
            background: loading ? "#94a3b8" : "#16a34a",
            color: "white",
            cursor: loading ? "not-allowed" : "pointer",
            transition: "0.2s",
          }}
        >
          {loading ? "Asking..." : "Ask PDF"}
        </button>
      </div>
    </div>
  );
}

