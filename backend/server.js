const express = require("express");
const bodyParser = require("body-parser");
const dotenv = require("dotenv");
const cors = require("cors");
const multer = require("multer");
const fs = require("fs");
const pdfParse = require("pdf-parse");
const { GoogleGenerativeAI } = require("@google/generative-ai");

const admin = require("firebase-admin");

const serviceAccount = require("./serviceAccountKey.json"); // download from Firebase Console

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  databaseURL: "https://studymate-e2268-default-rtdb.firebaseio.com/",
});

const db = admin.database();

// ✅ Load .env first
dotenv.config();

// ✅ Check Gemini API key
if (!process.env.GEMINI_API_KEY) {
  console.error("❌ GEMINI_API_KEY is missing in backend/.env");
} else {
  console.log(
    "✅ GEMINI_API_KEY loaded:",
    process.env.GEMINI_API_KEY.slice(0, 6) + "********"
  );
}

const app = express();
app.use(cors({
  origin: "http://localhost:3000", // your frontend URL
  credentials: true
}));

app.use(bodyParser.json());

// File upload setup
const upload = multer({ dest: "uploads/" });

// ✅ Gemini client (new integration)
let genAI, model;
try {
  genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
  model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });
  console.log("✅ Gemini model (2.5-flash) initialized successfully");
} catch (err) {
  console.error("❌ Failed to initialize Gemini client:", err.message);
}

// -------------------------
// Route 1: text → quiz
// -------------------------
app.post("/generate-quiz", async (req, res) => {
  try {
    const { text, numQuestions } = req.body;
    if (!text || !numQuestions) {
      return res.status(400).json({ error: "Missing text or numQuestions" });
    }

    console.log("⚡ Generating quiz from raw text, length:", text.length);

    const prompt = `
Generate ${numQuestions} multiple-choice questions from the study material below.
Each question must have exactly 4 options.
Output must be valid JSON in this format:
[
  { "question": "string", "options": ["A","B","C","D"], "answer": "must be one of the options" }
]

Study Material:
${text}
`;

    const result = await model.generateContent(prompt);
    let rawText = result.response.text();
    console.log("✅ Gemini raw response:", rawText.slice(0, 200), "...");

    rawText = rawText.replace(/json|```/g, "").trim();

    let quiz;
    try {
      quiz = JSON.parse(rawText);
    } catch {
      console.error("❌ Gemini returned invalid JSON");
      return res
        .status(502)
        .json({ error: "Gemini returned invalid JSON", raw: rawText });
    }

    res.json({ quiz });
  } catch (err) {
    console.error("Error generating quiz:", err);
    res
      .status(500)
      .json({ error: "Quiz generation failed", details: err.message });
  }
});

// -------------------------
// Route 2: upload PDF → quiz
// -------------------------
app.post("/upload-pdf", upload.single("file"), async (req, res) => {
  try {
    console.log("📥 PDF upload received:", req.file?.originalname);

    const { numQuestions } = req.body;
    if (!req.file || !numQuestions) {
      return res
        .status(400)
        .json({ error: "Missing PDF file or numQuestions" });
    }

    const dataBuffer = fs.readFileSync(req.file.path);
    const pdfData = await pdfParse(dataBuffer);
    const text = pdfData.text;
    console.log("✅ Extracted text length from PDF:", text.length);

    const prompt = `
Generate ${numQuestions} multiple-choice questions from the study material below.
Each question must have exactly 4 options.
Output must be valid JSON in this format:
[
  { "question": "string", "options": ["A","B","C","D"], "answer": "must be one of the options" }
]
     
Study Material:
${text}
`;

    console.log("⚡ Sending PDF text to Gemini API...");
    const result = await model.generateContent(prompt);

    let rawText = result.response.text();
    console.log("✅ Gemini raw response:", rawText.slice(0, 200), "...");

    rawText = rawText.replace(/json|```/g, "").trim();

    let quiz;
    try {
      quiz = JSON.parse(rawText);
    } catch {
      console.error("❌ Gemini returned invalid JSON");
      return res
        .status(502)
        .json({ error: "Gemini returned invalid JSON", raw: rawText });
    }

    res.json({ quiz });
  } catch (err) {
    console.error("Error handling PDF upload:", err);
    res
      .status(500)
      .json({ error: "PDF processing failed", details: err.message });
  }
});

// -------------------------
// Route 3: submit quiz score
// -------------------------
app.post("/submit-quiz", async (req, res) => {
  try {
    const { userId, email, quizId, score, submittedAt } = req.body;

    if (!userId || !email || score == null) {
      return res.status(400).json({ error: "Missing required fields" });
    }

    const newResultRef = db.ref(`quizResults/${userId}`).push();
    await newResultRef.set({
      userId,
      email,
      quizId,
      score,
      submittedAt: submittedAt || new Date().toISOString(),
    });

    res.json({
      message: "✅ Quiz result saved successfully!",
      quizId: newResultRef.key,
    });
  } catch (err) {
    console.error("Error saving quiz result:", err);
    res.status(500).json({ error: "Failed to save quiz result" });
  }
});

// -------------------------
// Route 4: Dashboard Stats (User-specific)
// -------------------------
app.get("/api/dashboard/stats/:userId", async (req, res) => {
  try {
    const { userId } = req.params;
    if (!userId) return res.status(400).json({ error: "Missing userId" });

    const userResultsRef = db.ref(`quizResults/${userId}`);
    const snapshot = await userResultsRef.once("value");

    if (!snapshot.exists()) {
      return res.json({
        overall_score: 0,
        quiz_scores: [],
        recent_activities: [],
        upcoming_reminders: [],
      });
    }

    let results = [];
    snapshot.forEach((child) => results.push(child.val()));

    const scores = results.map((r) => r.score || 0);
    const avgScore =
      scores.length > 0
        ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length)
        : 0;

    const response = {
      overall_score: avgScore,
      quiz_scores: scores.slice(-5),
      recent_activities: results
        .slice(-3)
        .reverse()
        .map((r) => ({
          id: r.submittedAt,
          description: `Scored ${r.score}% on quiz ${r.quizId || "N/A"}`,
          timestamp: r.submittedAt,
        })),
      upcoming_reminders: [],
    };

    res.json(response);
  } catch (err) {
    console.error("Error fetching user dashboard stats:", err);
    res.status(500).json({ error: "Failed to fetch dashboard stats" });
  }
});

// -------------------------
// Route 5: Tutor (Chat + PDF Q&A)
// -------------------------
app.post("/api/ai-tutor/ask", async (req, res) => {
  try {
    const { question } = req.body;
    if (!question)
      return res.status(400).json({ error: "No question provided" });

    const result = await model.generateContent({
      contents: [
        {
          role: "user",
          parts: [
            { text: `Answer clearly in 3–6 bullet points:\n\n${question}` },
          ],
        },
      ],
    });

    const answer = result.response.text();
    res.json({ answer });
  } catch (err) {
    console.error("Gemini tutor error:", err);
    res.status(500).json({ error: "Failed to get response" });
  }
});

app.post("/api/ai-tutor/pdf", upload.single("file"), async (req, res) => {
  try {
    const { question } = req.body;
    if (!req.file || !question) {
      return res.status(400).json({ error: "Missing PDF or question" });
    }

    const dataBuffer = fs.readFileSync(req.file.path);
    const pdfData = await pdfParse(dataBuffer);
    const text = pdfData.text;

    const result = await model.generateContent({
      contents: [
        {
          role: "user",
          parts: [
            {
              text: `From the following study material, answer the question in 3–6 bullet points:\n\nStudy Material:\n${text}\n\nQuestion: ${question}`,
            },
          ],
        },
      ],
    });

    const answer = result.response.text();
    res.json({ answer });
  } catch (err) {
    console.error("Error in PDF Q&A:", err);
    res.status(500).json({ error: "Failed to get PDF answer" });
  }
});

// -------------------------
// Route: Get latest quiz score for a user
// -------------------------
app.get("/api/dashboard/recent-score/:userId", async (req, res) => {
  try {
    const { userId } = req.params;
    if (!userId) return res.status(400).json({ error: "Missing userId" });

    const userResultsRef = db.ref(`quizResults/${userId}`);
    const snapshot = await userResultsRef.once("value");

    if (!snapshot.exists()) {
      return res.json({ score: null });
    }

    let allResults = [];
    snapshot.forEach((resultSnap) => {
      allResults.push(resultSnap.val());
    });

    // Sort by submittedAt (latest first)
    allResults.sort(
      (a, b) => new Date(b.submittedAt) - new Date(a.submittedAt)
    );

    const latest = allResults[0]; // most recent
    res.json({
      score: latest?.score ?? null,
      submittedAt: latest?.submittedAt,
    });
  } catch (err) {
    console.error("Error fetching recent score:", err);
    res.status(500).json({ error: "Failed to fetch recent score" });
  }
});

// -------------------------
// Route: Gemini Connection Test
// -------------------------
app.get("/test-gemini", async (req, res) => {
  try {
    console.log("🧠 Testing Gemini API connection...");

    const prompt = "Say a short hello message for StudyMate students!";
    const result = await model.generateContent(prompt);
    const reply = result.response.text();

    console.log("✅ Gemini test reply:", reply);
    res.json({ success: true, message: reply });
  } catch (err) {
    console.error("❌ Gemini test failed:", err.message);
    res.status(500).json({ success: false, error: err.message });
  }
});

/* ------------------------- */
// -------------------------
// Route: Get all todos for a user
// -------------------------
app.get("/api/todos/:userId", async (req, res) => {
  try {
    const { userId } = req.params;
    if (!userId) return res.status(400).json({ error: "Missing userId" });

    const todosRef = db.ref(`todos/${userId}`);
    const snapshot = await todosRef.once("value");

    if (!snapshot.exists()) {
      return res.json({ tasks: [] });
    }

    let tasks = [];
    snapshot.forEach((taskSnap) => {
      tasks.push({
        id: taskSnap.key,
        ...taskSnap.val(),
      });
    });

    // Sort by createdAt (newest first)
    tasks.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

    res.json({ tasks });
  } catch (err) {
    console.error("Error fetching todos:", err);
    res.status(500).json({ error: "Failed to fetch todos" });
  }
});

// -------------------------
// Route: Add a new todo
// -------------------------
app.post("/api/todos", async (req, res) => {
  try {
    const { userId, task } = req.body;

    if (!userId || !task) {
      return res.status(400).json({ error: "Missing userId or task" });
    }

    const newTaskRef = db.ref(`todos/${userId}`).push();
    await newTaskRef.set({
      task,
      completed: false,
      createdAt: new Date().toISOString(),
    });

    res.json({
      message: "✅ Task added successfully!",
      taskId: newTaskRef.key,
    });
  } catch (err) {
    console.error("Error adding todo:", err);
    res.status(500).json({ error: "Failed to add task" });
  }
});

// -------------------------
// Route: Update a todo (toggle completion)
// -------------------------
app.put("/api/todos/:taskId", async (req, res) => {
  try {
    const { taskId } = req.params;
    const { userId, completed } = req.body;

    if (!userId || completed == null) {
      return res.status(400).json({ error: "Missing userId or completed status" });
    }

    const taskRef = db.ref(`todos/${userId}/${taskId}`);
    await taskRef.update({
      completed,
      updatedAt: new Date().toISOString(),
    });

    res.json({ message: "✅ Task updated successfully!" });
  } catch (err) {
    console.error("Error updating todo:", err);
    res.status(500).json({ error: "Failed to update task" });
  }
});

// -------------------------
// Route: Delete a todo
// -------------------------
app.delete("/api/todos/:taskId", async (req, res) => {
  try {
    const { taskId } = req.params;
    const { userId } = req.query;

    if (!userId) {
      return res.status(400).json({ error: "Missing userId" });
    }

    const taskRef = db.ref(`todos/${userId}/${taskId}`);
    await taskRef.remove();

    res.json({ message: "✅ Task deleted successfully!" });
  } catch (err) {
    console.error("Error deleting todo:", err);
    res.status(500).json({ error: "Failed to delete task" });
  }
});
// -------------------------
const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  console.log(`✅ StudyMate API running on http://localhost:${PORT}`);
});
