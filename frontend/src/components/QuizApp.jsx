import React, { useState } from "react";
import axios from "axios";
import { getAuth } from "firebase/auth";
import { useNavigate } from "react-router-dom";
import { ref, push, set } from "firebase/database";
import { db } from "../firebase"; // ✅ make sure this path is correct

/** ---------- helpers ---------- */
const stripLabel = (s = "") => s.replace(/^\s*[A-D]\s*[\.\)]\s*/i, "").trim();
const normalize = (s = "") => stripLabel(s).replace(/\s+/g, " ").trim().toLowerCase();
const letterToIndex = (val) => {
  if (val == null) return null;
  const m = String(val).trim().match(/^[A-D]/i);
  return m ? m[0].toUpperCase().charCodeAt(0) - 65 : null;
};
const getCorrectIndex = (q) => {
  const n = q?.options?.length ?? 0;
  if (!n) return -1;
  if (Number.isInteger(q.answerIndex)) {
    if (q.answerIndex >= 0 && q.answerIndex < n) return q.answerIndex;
    if (q.answerIndex >= 1 && q.answerIndex <= n) return q.answerIndex - 1;
  }
  const li = letterToIndex(q.answer);
  if (li !== null && li >= 0 && li < n) return li;
  const ansNorm = normalize(q.answer ?? "");
  const matchByText = q.options.findIndex((opt) => normalize(opt) === ansNorm);
  if (matchByText !== -1) return matchByText;
  if (ansNorm) {
    const fuzzy = q.options.findIndex((opt) => normalize(opt).includes(ansNorm));
    if (fuzzy !== -1) return fuzzy;
  }
  return -1;
};
const computeScore = (quiz, answers) =>
  quiz.reduce((acc, q, i) => {
    const correctIdx = getCorrectIndex(q);
    return acc + (answers[i] === correctIdx ? 1 : 0);
  }, 0);

/** ---------- component ---------- */
export default function App() {
  const navigate = useNavigate();
  const [file, setFile] = useState(null);
  const [numQuestions, setNumQuestions] = useState(3);
  const [quiz, setQuiz] = useState([]);
  const [answers, setAnswers] = useState({});
  const [score, setScore] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  // Generate quiz from PDF
  const uploadPdf = async (regen = false) => {
    if (!file) {
      alert("Please select a PDF file first.");
      return;
    }
    setLoading(true);
    setError("");
    try {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("numQuestions", numQuestions);

      const res = await axios.post(
  `${process.env.REACT_APP_BACKEND_URL}/upload-pdf`,
  formData,
  {
    headers: { "Content-Type": "multipart/form-data" },
  }
);

      setQuiz(res.data.quiz || []);
      setAnswers({});
      setScore(0);

      if (regen) {
        alert("✅ Quiz regenerated successfully!");
      }
    } catch (e) {
      console.error(e);
      setError("Failed to process PDF. Is the backend running?");
    } finally {
      setLoading(false);
    }
  };

  // Reset everything
  const resetQuiz = () => {
    setFile(null);
    setNumQuestions(3);
    setQuiz([]);
    setAnswers({});
    setScore(0);
    setError("");
  };

  const handleAnswer = (qIndex, optIndex) => {
    const next = { ...answers, [qIndex]: optIndex };
    setAnswers(next);
    setScore(computeScore(quiz, next));
  };

  /** ---------- ✅ UPDATED QUIZ SUBMISSION ---------- */
  const handleSubmitQuiz = async () => {
    const finalScore = computeScore(quiz, answers);

    const auth = getAuth();
    const user = auth.currentUser;

    if (!user) {
      alert("❌ You must be logged in to submit your quiz.");
      return;
    }

    try {
      const totalQuestions = quiz.length; // ✅ automatically count total questions
      const quizId = "quiz1"; // 👈 make this dynamic later if needed

      // ✅ Create a reference for this user's quiz results
      const userResultsRef = ref(db, `quizResults/${user.uid}`);
      const newResultRef = push(userResultsRef); // auto-generate unique ID
      /*const istDateTime = new Date().toLocaleString("en-IN", {
  timeZone: "Asia/Kolkata",
  hour12: false, // optional: use 24-hour format
});*/
       // 🕒 Generate IST date & time
const now = new Date();
const istDate = new Intl.DateTimeFormat("en-GB", {
  timeZone: "Asia/Kolkata",
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
}).format(now); // => "07/11/2025"

const istTime = new Intl.DateTimeFormat("en-GB", {
  timeZone: "Asia/Kolkata",
  hour: "2-digit",
  minute: "2-digit",
  second: "2-digit",
  hour12: false,
}).format(now); // => "09:45:32"

// ✅ Save to Firebase
await set(newResultRef, {
  email: user.email,
  quizId,
  score: finalScore,
  totalQuestions,
  submittedAt: now.toISOString(),
  userId: user.uid,

  // 🆕 New fields
  dateSubmitted: istDate,   // "07/11/2025"
  timeSubmitted: istTime,   // "09:45:32"
});

      // ✅ Save to Firebase
      //await set(newResultRef, {
        //email: user.email,
       // quizId,
       // score: finalScore,
       // totalQuestions, // ✅ added
       // submittedAt: new Date().toISOString(),
       // userId: user.uid,
        //dateTime: istDateTime,
      //});

      console.log("✅ Quiz result saved successfully to Firebase!");
      alert(`🎉 Quiz submitted successfully! Score: ${finalScore}/${totalQuestions}`);
      window.location.href = "/dashboard";
    } catch (err) {
      console.error("❌ Error saving quiz result:", err);
      alert("⚠️ Failed to save quiz result. Please try again.");
    }
  };

  return (
    <div
      style={{
        padding: "30px",
        maxWidth: "800px",
        margin: "0 auto",
        fontFamily: "Poppins, Arial, sans-serif",
        background: "#f8f9fa",
        minHeight: "100vh",
      }}
    >
      <button
        onClick={() => navigate("/dashboard")}
        style={{
          position: "absolute",
          top: "20px",
          right: "20px",
          background: "#5717e0ff",
          color: "white",
          padding: "8px 14px",
          border: "none",
          borderRadius: "6px",
          cursor: "pointer",
          fontWeight: "600",
        }}
      >
        ⬅ Back
      </button>

      <h1 style={{ textAlign: "center", marginBottom: "20px", color: "#0077b6" }}>
        📘 AI Quiz Generator
      </h1>

      <div
        style={{
          background: "white",
          padding: "20px",
          borderRadius: "12px",
          boxShadow: "0 4px 12px rgba(0,0,0,0.1)",
          marginBottom: "20px",
        }}
      >
        <input
          type="file"
          accept="application/pdf"
          onChange={(e) => setFile(e.target.files[0])}
          style={{ marginBottom: "12px" }}
        />

        <input
          type="number"
          min="1"
          value={numQuestions}
          onChange={(e) => setNumQuestions(Number(e.target.value))}
          style={{
            marginLeft: "10px",
            padding: "6px",
            width: "100px",
            border: "1px solid #ccc",
            borderRadius: "6px",
          }}
        />

        <button
          onClick={() => uploadPdf(false)}
          style={{
            marginLeft: "10px",
            padding: "8px 14px",
            background: "#0077b6",
            color: "white",
            border: "none",
            borderRadius: "6px",
            cursor: "pointer",
          }}
        >
          {loading ? "Generating..." : "Generate Quiz"}
        </button>

        {quiz.length > 0 && (
          <>
            <button
              onClick={() => uploadPdf(true)}
              style={{
                marginLeft: "10px",
                padding: "8px 14px",
                background: "#ffb703",
                color: "black",
                border: "none",
                borderRadius: "6px",
                cursor: "pointer",
              }}
            >
              🔄 Regenerate
            </button>

            <button
              onClick={resetQuiz}
              style={{
                marginLeft: "10px",
                padding: "8px 14px",
                background: "#e63946",
                color: "white",
                border: "none",
                borderRadius: "6px",
                cursor: "pointer",
              }}
            >
              ❌ Reset
            </button>
          </>
        )}
      </div>

      {error && (
        <p style={{ color: "crimson", marginTop: 12, textAlign: "center" }}>
          {error}
        </p>
      )}

      <div
        style={{
          fontWeight: 600,
          textAlign: "center",
          marginBottom: "20px",
          fontSize: "18px",
        }}
      >
        Score: {score} / {quiz.length || 0}
      </div>

      {quiz.length > 0 && (
        <div>
          {quiz.map((q, i) => {
            const selectedIdx = answers[i];
            const correctIdx = getCorrectIndex(q);
            const correctText =
              correctIdx >= 0 && q.options[correctIdx]
                ? stripLabel(q.options[correctIdx])
                : q.answer ?? "—";

            return (
              <div
                key={i}
                style={{
                  background: "white",
                  padding: "18px",
                  marginBottom: "18px",
                  borderRadius: "12px",
                  boxShadow: "0 2px 8px rgba(0,0,0,0.05)",
                }}
              >
                <p
                  style={{
                    fontSize: "16px",
                    fontWeight: "bold",
                    marginBottom: "12px",
                  }}
                >
                  Q{i + 1}: {q.question}
                </p>
                <ul style={{ listStyle: "none", padding: 0 }}>
                  {q.options.map((opt, idx) => {
                    const shown = stripLabel(opt);
                    const label = String.fromCharCode(65 + idx);

                    const isSelected = selectedIdx === idx;
                    const isCorrect = idx === correctIdx;
                    const answered = selectedIdx !== undefined;

                    let bg = "#f8f9fa";
                    if (answered && isSelected)
                      bg = isCorrect ? "#b7efc5" : "#f7a9a8";
                    else if (answered && isCorrect) bg = "#d3f9d8";

                    return (
                      <li
                        key={idx}
                        onClick={() => handleAnswer(i, idx)}
                        style={{
                          padding: "12px",
                          margin: "8px 0",
                          borderRadius: "8px",
                          cursor: "pointer",
                          background: bg,
                          transition: "0.2s",
                          border: isSelected
                            ? "2px solid #0077b6"
                            : "1px solid #ccc",
                        }}
                      >
                        <span style={{ marginRight: 8, fontWeight: "bold" }}>
                          {label}.
                        </span>
                        {shown}
                      </li>
                    );
                  })}
                </ul>
                {selectedIdx !== undefined && (
                  <p style={{ marginTop: 10, fontStyle: "italic" }}>
                    {selectedIdx === correctIdx
                      ? "✅ Correct!"
                      : `❌ Wrong. Correct answer: ${correctText}`}
                  </p>
                )}
              </div>
            );
          })}

          <div style={{ textAlign: "center", marginTop: 20 }}>
            <button
              onClick={handleSubmitQuiz}
              style={{
                padding: "10px 20px",
                background: "#0077b6",
                color: "white",
                border: "none",
                borderRadius: "8px",
                cursor: "pointer",
              }}
            >
              Submit Quiz
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
