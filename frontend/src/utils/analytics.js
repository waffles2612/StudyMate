// src/utils/analytics.js
import { ref, get } from "firebase/database";
import { db } from "../firebase";

// Analyze progress for a given user
export async function analyzeProgress(userId) {
  try {
    // ✅ Fetch all quiz attempts for this user (no need for query)
    const scoresRef = ref(db, `quizResults/${userId}`);
    const snapshot = await get(scoresRef); // <-- you had this commented out

    if (!snapshot.exists()) {
      return { message: "No scores found for this user." };
    }

    const data = snapshot.val();

    // ✅ Group scores by subject (assuming quizId encodes subject, e.g. "math_quiz1")
    const subjectScores = {};

    Object.values(data).forEach((attempt) => {
      const { quizId, score } = attempt;
      const subject = quizId?.includes("_") ? quizId.split("_")[0] : "General";

      if (!subjectScores[subject]) {
        subjectScores[subject] = [];
      }
      subjectScores[subject].push(score);
    });

    // ✅ Calculate averages
    const subjectAverages = {};
    for (const subject in subjectScores) {
      const scores = subjectScores[subject];
      const avg = scores.reduce((a, b) => a + b, 0) / scores.length;
      subjectAverages[subject] = avg;
    }

    // ✅ Sort subjects by performance
    const sorted = Object.entries(subjectAverages).sort((a, b) => b[1] - a[1]);

    return {
      subjectAverages,
      strongest: sorted[0],
      weakest: sorted[sorted.length - 1],
    };
  } catch (error) {
    console.error("Error analyzing progress:", error);
    return { error: error.message };
  }
}
