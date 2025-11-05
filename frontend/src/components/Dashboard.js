import React, { useState, useEffect } from 'react';
import { useNavigate } from "react-router-dom";
import { analyzeProgress } from "../utils/analytics";
import DatePicker from "react-datepicker";
import "react-datepicker/dist/react-datepicker.css";
import { db } from "../firebase"; // ✅ use single initialized DB instance
import { ref, onValue } from "firebase/database"; // ✅ lightweight imports only
import ToDo from "./ToDo";



import {
  LogOut,
  Upload,
  Brain,
  MessageSquare,
  Clock,
  TrendingUp,
  Calendar,
  Play,
  Pause,
  RotateCcw,
  BarChart3,
  Zap
} from 'lucide-react';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;

const Dashboard = ({ user, onLogout }) => {
  const [dashboardData, setDashboardData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [latestScore, setLatestScore] = useState(null);
  const [feedback, setFeedback] = useState("");
  const [timerMinutes, setTimerMinutes] = useState(25);
  const [timerSeconds, setTimerSeconds] = useState(0);
  const [timerActive, setTimerActive] = useState(false);
  const [sessionCount, setSessionCount] = useState(0);
  const [recentScores, setRecentScores] = useState([]);
  const [progressData, setProgressData] = useState(null);
  const [showReminderModal, setShowReminderModal] = useState(false);
  const [reminderDetails, setReminderDetails] = useState({
  title: "",
  start: new Date(),
  duration: 30,
  });
  const navigate = useNavigate();

// ✅ Fetch most recent quiz score
useEffect(() => {
  if (!user?.uid) return;

  const userResultsRef = ref(db, `quizResults/${user.uid}`);

  let isMounted = true; // 🛡 Prevent early updates before mount

  const unsubscribe = onValue(userResultsRef, (snapshot) => {
    if (!isMounted) return;

    if (!snapshot.exists()) {
      console.log("⚠️ No quiz results found for this user.");
      setLatestScore(null);
      setDashboardData((prev) => ({ ...prev, overall_score: 0 }));
      setLoading(false);
      return;
    }

    const data = Object.values(snapshot.val());
    if (!data.length) {
      setLatestScore(null);
      setDashboardData((prev) => ({ ...prev, overall_score: 0 }));
      setLoading(false);
      return;
    }

    // ✅ Compute latest + average
    const sorted = [...data].sort(
      (a, b) => new Date(b.submittedAt) - new Date(a.submittedAt)
    );
    const latest = sorted[0];
    const latestMax = latest.totalQuestions || 3;
    const latestPercent = Math.round((latest.score / latestMax) * 100);

    const totalPercentages = data.map((q) => {
      const max = q.totalQuestions || 3;
      return (q.score / max) * 100;
    });

    const avgScore = Math.round(
      totalPercentages.reduce((sum, p) => sum + p, 0) / totalPercentages.length
    );

    // ✅ Merge new data
    setDashboardData((prev) => ({
      ...prev,
      overall_score: avgScore,
    }));

    setLatestScore(latestPercent);
    setFeedback(
      latestPercent < 40
        ? "❌ You need more practice!! Keep trying 💪"
        : "✅ You passed, keep practicing!! 🎉"
    );

    // ✅ stop loading only after Firebase data has arrived
    setTimeout(() => setLoading(false), 300);
  });

  return () => {
    isMounted = false;
    unsubscribe();
  };
}, [user]);


// ✅ 2. Fetch progress analytics
useEffect(() => {
  const fetchProgress = async () => {
    if (!user?.uid) return;
    try {
      const result = await analyzeProgress(user.uid);
      setProgressData(result);
    } catch (error) {
      console.error("Error fetching progress:", error);
    }
  };

  fetchProgress();
}, [user]);


// ✅ 3. Fetch dashboard stats + Google Calendar reminders
useEffect(() => {
  const fetchDashboardData = async () => {
    try {
      const response = await fetch(`${BACKEND_URL}/api/dashboard/stats/${user.uid}`, {
        credentials: "include",
      });

      if (response.ok) {
        const data = await response.json();
        setDashboardData(data);
      }
    } catch (error) {
      console.error("Error fetching dashboard data:", error);
    } finally {
      setLoading(false); // stop loading spinner
    }
  };

  fetchDashboardData();      // existing backend fetch
  fetchGoogleReminders();    // 👈 NEW: fetch Google Calendar reminders
  
}, [user]);



// ✅ 4. Pomodoro timer logic
useEffect(() => {
  let interval = null;
  if (timerActive) {
    interval = setInterval(() => {
      if (timerSeconds > 0) {
        setTimerSeconds((prev) => prev - 1);
      } else if (timerMinutes > 0) {
        setTimerMinutes((prev) => prev - 1);
        setTimerSeconds(59);
      } else {
        setTimerActive(false);
        setSessionCount((prev) => prev + 1);
        setTimerMinutes(25);
        setTimerSeconds(0);
        alert("🎉 Pomodoro session complete! You're crushing it! 🚀");
      }
    }, 1000);
  } else if (!timerActive && timerSeconds !== 0) {
    clearInterval(interval);
  }
  return () => clearInterval(interval);
}, [timerActive, timerMinutes, timerSeconds]);

  const saveReminder = async () => {
  try {
    const { title, start, duration } = reminderDetails;
    if (!title || !start) {
      alert("⚠️ Please fill all fields before saving.");
      return;
    }

    const startDt = new Date(start);
    const endDt = new Date(startDt.getTime() + duration * 60000);

    const accessToken = localStorage.getItem("googleAccessToken");
    if (!accessToken) {
      alert("⚠️ Please re-login to enable Google Calendar access.");
      return;
    }

    const event = {
      summary: title,
      description: "StudyMate Reminder 📚",
      start: { dateTime: startDt.toISOString(), timeZone: "Asia/Kolkata" },
      end: { dateTime: endDt.toISOString(), timeZone: "Asia/Kolkata" },
    };

    const googleResponse = await fetch(
      "https://www.googleapis.com/calendar/v3/calendars/primary/events",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          Accept: "application/json",
          "Content-Type": "application/json",
        },
        body: JSON.stringify(event),
      }
    );

    if (googleResponse.ok) {
      alert("🎯 Reminder added to your Google Calendar!");
      setShowReminderModal(false);
    } else {
      const err = await googleResponse.json();
      console.error("Google Calendar API Error:", err);
      alert(`❌ Failed to add reminder: ${err.error?.message}`);
    }
  } catch (err) {
    console.error("Error adding reminder:", err);
    alert("❌ Could not connect to Google Calendar.");
  }
};
// ✅ Fetch upcoming Google Calendar events (next 7 days)
const fetchGoogleReminders = async () => {
  try {
    const accessToken = localStorage.getItem("googleAccessToken");
    if (!accessToken) {
      console.warn("⚠️ No Google access token found, skipping calendar fetch.");
      return;
    }

    // Define time window: now → +7 days
    const now = new Date().toISOString();
    const nextWeek = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();

    const response = await fetch(
      `https://www.googleapis.com/calendar/v3/calendars/primary/events?timeMin=${now}&timeMax=${nextWeek}&singleEvents=true&orderBy=startTime`,
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
          Accept: "application/json",
        },
      }
    );

    if (response.ok) {
      const data = await response.json();
      console.log("📅 Google Calendar Events:", data.items);

      // Map events to a simpler format
      const reminders = data.items.map((event) => ({
        id: event.id,
        title: event.summary || "Untitled Event",
        scheduled_time: event.start.dateTime || event.start.date,
      }));

      // Merge with dashboard data
      setDashboardData((prev) => ({
        ...prev,
        upcoming_reminders: reminders,
      }));
    } else {
      const err = await response.json();
      console.error("❌ Google Calendar API error:", err);
    }
  } catch (error) {
    console.error("Error fetching Google Calendar reminders:", error);
  }
};



  // ✅ Handle actions (reminder, quiz, tutor)
  const handleQuickAction = async (action) => {
    switch (action) {
      case 'upload':
        alert('📁 File upload feature coming soon with Google Drive integration! 🚀');
        break;

      case 'quiz':
        navigate("/quiz");
        break;

      case 'tutor':
        navigate("/tutor");
        break;

      case 'reminder':
        setShowReminderModal(true);
        break;
    }
  };

  if (loading) {
    return (
      <div className="loading-screen">
        <div className="loading-spinner"></div>
        <p>Loading your awesome dashboard... 🌟</p>
      </div>
    );
  }

  const formatTime = (minutes, seconds) =>
    `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;

return (
  <>
    <div className="dashboard">
      <header className="dashboard-header">
        <div className="logo">
          <span className="logo-emoji">🎓</span>
          Study Mate
        </div>
        <div className="user-profile">
          {user.picture && (
            <img src={user.picture} alt={user.name} className="user-avatar" />
          )}
          <span>Hey, {user.name.split(' ')[0]}! 👋</span>
          <button className="logout-btn" onClick={onLogout}>
            <LogOut size={16} /> Logout
          </button>
        </div>
      </header>

      <main className="dashboard-content">

        {/* ✅ Reminder Modal */}
        {showReminderModal && (
          <div className="modal-overlay">
            <div className="modal">
              <h3>📅 Create Study Reminder</h3>

              <label>Title</label>
              <input
                type="text"
                value={reminderDetails.title}
                onChange={(e) =>
                  setReminderDetails({
                    ...reminderDetails,
                    title: e.target.value,
                  })
                }
                placeholder="e.g. Math Revision"
              />

              {/* 📅 Date Picker */}
<label>Date</label>
<DatePicker
  selected={reminderDetails.start}
  onChange={(date) => {
    const updated = new Date(reminderDetails.start);
    updated.setFullYear(date.getFullYear(), date.getMonth(), date.getDate());
    setReminderDetails({ ...reminderDetails, start: updated });
  }}
  dateFormat="MM/dd/yyyy"
  placeholderText="Select date"
  className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-pink-400"
/>

{/* ⏰ Time Picker (digital) */}
<label>Time</label>
<DatePicker
  selected={reminderDetails.start}
  onChange={(time) => {
    const updated = new Date(reminderDetails.start);
    updated.setHours(time.getHours());
    updated.setMinutes(time.getMinutes());
    setReminderDetails({ ...reminderDetails, start: updated });
  }}
  showTimeSelect
  showTimeSelectOnly
  timeIntervals={1}         // 👈 allows any minute (1-minute steps)
  timeCaption="Time"
  dateFormat="h:mm aa"      // 👈 12-hour digital format
  placeholderText="Select time"
  className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-pink-400"
/>


              <label>Duration (minutes)</label>
              <input
                type="number"
                min="5"
                value={reminderDetails.duration}
                onChange={(e) =>
                  setReminderDetails({
                    ...reminderDetails,
                    duration: parseInt(e.target.value, 10),
                  })
                }
              />

              <div className="modal-buttons">
                <button onClick={saveReminder}>✅ Save</button>
                <button
                  className="cancel"
                  onClick={() => setShowReminderModal(false)}
                >
                  ❌ Cancel
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ✅ Quick Actions */}
        <section className="section-card">
          <h3 className="section-title">
            <Zap size={24} /> Quick Actions ⚡
          </h3>
          <div className="quick-actions">
            <button className="action-btn" onClick={() => navigate('/todo')}>
              <Upload className="icon" size={24} /> To Do 📚
            </button>
            <button
              className="action-btn"
              onClick={() => handleQuickAction('quiz')}
            >
              <Brain className="icon" size={24} /> Take Quiz 🧠
            </button>
            <button
              className="action-btn"
              onClick={() => handleQuickAction('tutor')}
            >
              <MessageSquare className="icon" size={24} /> Ask AI Buddy 🤖
            </button>
            <button
              className="action-btn"
              onClick={() => handleQuickAction('reminder')}
            >
              <Clock className="icon" size={24} /> Set Reminder ⏰
            </button>
          </div>
        </section>

        {/* ✅ Progress */}
        <section className="section-card">
          <h3 className="section-title">
            <BarChart3 size={24} /> Your Progress & Analytics 📊
          </h3>
          <div className="progress-stats">
            <div className="progress-item">
              <h4>🧠 Your Latest Quiz Score</h4>
              {latestScore !== null ? (
                <>
                  <div
                    className="value"
                    style={{
                      color: latestScore < 40 ? "#e74c3c" : "#2ecc71",
                      fontWeight: "bold",
                    }}
                  >
                    {latestScore}%
                  </div>
                  <p
                    style={{
                      color: latestScore < 40 ? "#e74c3c" : "#2ecc71",
                      fontSize: "1rem",
                      marginTop: "0.5rem",
                    }}
                  >
                    {feedback}
                  </p>
                </>
              ) : (
                <p>No quiz data yet! Take a quiz to get started 🚀</p>
              )}
            </div>

            <div className="progress-item">
              <h4>🎯 Overall Score</h4>
              <div className="value">
                {dashboardData?.overall_score || 0}%
              </div>
              <p style={{ color: "#888", fontSize: "0.9rem" }}>
                Your total average across all quizzes.
              </p>
            </div>
          </div>
        </section>

        {/* ✅ Upcoming Reminders */}
        <section className="section-card">
          <h3 className="section-title">
            <Calendar size={20} /> Upcoming Reminders 📅
          </h3>
          {dashboardData?.upcoming_reminders?.length > 0 ? (
            dashboardData.upcoming_reminders.map((reminder) => (
              <div key={reminder.id} className="reminder-card">
                <strong>🎯 {reminder.title}</strong>
                <p>📅 {new Date(reminder.scheduled_time).toLocaleString()}</p>
              </div>
            ))
          ) : (
            <p>🌟 No reminders yet! Set one to stay on track! 🎯</p>
          )}
        </section>

        {/* ✅ Pomodoro Timer */}
        <section className="section-card">
          <h3 className="section-title">🎯 Focus Timer ⏰</h3>
          <div className="timer-display">
            {formatTime(timerMinutes, timerSeconds)}
          </div>
          <div className="timer-controls">
            <button
              className="small-btn"
              onClick={() => setTimerActive(true)}
              disabled={timerActive}
            >
              <Play size={16} /> Start
            </button>
            <button
              className="small-btn"
              onClick={() => setTimerActive(false)}
              disabled={!timerActive}
            >
              <Pause size={16} /> Pause
            </button>
            <button
              className="small-btn secondary"
              onClick={() => {
                setTimerActive(false);
                setTimerMinutes(25);
                setTimerSeconds(0);
              }}
            >
              <RotateCcw size={16} /> Reset
            </button>
          </div>
          <p>
            🔥 Sessions Completed Today: <strong>{sessionCount}</strong>
          </p>
        </section>

       

      </main>
    </div>

    {/* ✅ Modal Styles */}
    <style>{`
      .modal-overlay {
        position: fixed;
        inset: 0;
        background: rgba(0,0,0,0.5);
        display: flex;
        align-items: center;
        justify-content: center;
        z-index: 1000;
      }
      .modal {
        background: white;
        border-radius: 16px;
        padding: 20px;
        width: 340px;
        box-shadow: 0 10px 25px rgba(0,0,0,0.2);
        display: flex;
        flex-direction: column;
        gap: 12px;
      }
      .modal h3 { text-align: center; color: #ff4eb8; }
      .modal input {
        padding: 8px;
        border: 1px solid #ddd;
        border-radius: 8px;
        font-size: 14px;
      }
      .modal-buttons {
        display: flex;
        justify-content: space-between;
        margin-top: 10px;
      }
      .modal-buttons button {
        padding: 8px 14px;
        border: none;
        border-radius: 8px;
        cursor: pointer;
        font-weight: bold;
      }
      .modal-buttons .cancel { background: #eee; color: #444; }
      .modal-buttons button:not(.cancel) {
        background: linear-gradient(to right, #ff66b3, #ff9ed8);
        color: white;
      }
    `}</style>
  </>
);
};

export default Dashboard;