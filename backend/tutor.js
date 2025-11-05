const express = require("express");
const bodyParser = require("body-parser");
const cors = require("cors");
const dotenv = require("dotenv");
const multer = require("multer");
const fs = require("fs");
const pdfParse = require("pdf-parse");
const { GoogleGenerativeAI } = require("@google/generative-ai");

dotenv.config();
const app = express();
app.use(cors({ origin: "*" }));
app.use(bodyParser.json());

// Gemini client
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

// File upload setup
const upload = multer({ dest: "uploads/" });

/* -------------------------
   General Chat Endpoint
------------------------- */
app.post("/chat", async (req, res) => {
  try {
    const { message } = req.body;
    if (!message) return res.status(400).json({ error: "No message provided" });

    const result = await model.generateContent({
      contents: [
        {
          role: "user",
          parts: [
            {
              text: `Answer clearly in 3–6 bullet points:\n\n${message}`,
            },
          ],
        },
      ],
    });

    const answer = result.response.text();
    res.json({ answer });
  } catch (err) {
    console.error("Gemini chat error:", err);
    res.status(500).json({ error: "Failed to get response" });
  }
});

/* -------------------------
   PDF Q&A Endpoint
------------------------- */
app.post("/upload-pdf", upload.single("file"), async (req, res) => {
  try {
    const { question } = req.body;
    if (!req.file || !question)
      return res.status(400).json({ error: "Missing PDF or question" });

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

const PORT = process.env.PORT || 3002; // run on a different port from quiz backend
app.listen(PORT, () =>
  console.log(`✅ Gemini Tutor API running on http://localhost:${PORT}`)
);
