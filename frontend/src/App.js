import React, { useState, useEffect } from "react";
import "./App.css";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import LandingPage from "./components/LandingPage";
import Dashboard from "./components/Dashboard";
import { signInWithPopup, signOut, onAuthStateChanged, GoogleAuthProvider } from "firebase/auth";
import { auth, provider } from "./firebase";
import ToDo from "./components/ToDo";

// ✅ QuizApp + TutorApp imports
import QuizApp from "./components/QuizApp";
import TutorApp from "./components/TutorApp";

function App() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  // ✅ Listen for login/logout state changes
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      if (currentUser) {
        setUser({
          name: currentUser.displayName,
          email: currentUser.email,
          picture: currentUser.photoURL,
          uid: currentUser.uid,
        });
      } else {
        setUser(null);
      }
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  // ✅ Single source of truth for login
  const handleLogin = async () => {
    try {
      // Add Calendar permission scope
      provider.addScope("https://www.googleapis.com/auth/calendar.events");

      const result = await signInWithPopup(auth, provider);

      // ✅ Correct token extraction
      const credential = GoogleAuthProvider.credentialFromResult(result);
      const accessToken = credential?.accessToken;

      if (accessToken) {
        localStorage.setItem("googleAccessToken", accessToken);
        console.log("✅ Google Access Token saved:", accessToken);
      } else {
        console.warn("⚠️ No access token received from Google login.");
      }

      // ✅ Store user info
      const userData = {
        name: result.user.displayName,
        email: result.user.email,
        picture: result.user.photoURL,
        uid: result.user.uid,
      };
      setUser(userData);
    } catch (error) {
      console.error("❌ Google login failed:", error);
      alert("Google login failed. Please check the console for details.");
    }
  };

  // ✅ Clean logout
  const handleLogout = async () => {
    try {
      await signOut(auth);
      localStorage.removeItem("googleAccessToken");
      setUser(null);
    } catch (error) {
      console.error("Logout error:", error);
    }
  };

  if (loading) {
    return <p>Loading...</p>;
  }

  return (
    <div className="App">
      <BrowserRouter>
        <Routes>
          {/* Landing */}
          <Route
            path="/"
            element={
              user ? (
                <Navigate to="/dashboard" replace />
              ) : (
                <LandingPage onLogin={handleLogin} />
              )
            }
          />

          {/* Dashboard (protected) */}
          <Route
            path="/dashboard"
            element={
              user ? (
                <Dashboard user={user} onLogout={handleLogout} />
              ) : (
                <Navigate to="/" replace />
              )
            }
          />

          {/* Quiz (protected) */}
          <Route
            path="/quiz"
            element={user ? <QuizApp user={user} /> : <Navigate to="/" replace />}
          />

          {/* Tutor (protected) */}
          <Route
            path="/tutor"
            element={user ? <TutorApp user={user} /> : <Navigate to="/" replace />}
          />

          {/* ToDo (protected) */}
          <Route
            path="/todo"
            element={user ? <ToDo user={user} /> : <Navigate to="/" replace />}
          />
        </Routes>
      </BrowserRouter>
    </div>
  );
}

export default App;
