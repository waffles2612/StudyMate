import React, { useState, useEffect } from "react";
import "./App.css";
import { BrowserRouter, Routes, Route, Navigate, useNavigate } from "react-router-dom";
import LandingPage from "./components/LandingPage";
import Dashboard from "./components/Dashboard";
import {
  signInWithPopup,
  signInWithRedirect,
  getRedirectResult,
  signOut,
  onAuthStateChanged,
  GoogleAuthProvider,
} from "firebase/auth";
import { auth, provider } from "./firebase";
import ToDo from "./components/ToDo";
import QuizApp from "./components/QuizApp";
import TutorApp from "./components/TutorApp";

function AppWrapper() {
  const navigate = useNavigate();
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  // ✅ Handle Google redirect result (only runs after login)
  useEffect(() => {
    getRedirectResult(auth)
      .then((result) => {
        if (result?.user) {
          console.log("✅ Redirect login success:", result.user.email);
          const credential = GoogleAuthProvider.credentialFromResult(result);
          const accessToken = credential?.accessToken;

          if (accessToken) {
            localStorage.setItem("googleAccessToken", accessToken);
          }

          const userData = {
            name: result.user.displayName,
            email: result.user.email,
            picture: result.user.photoURL,
            uid: result.user.uid,
          };
          setUser(userData);

          // ✅ Navigate directly to dashboard
          navigate("/dashboard");
        }
      })
      .catch((error) => {
        if (error.code !== "auth/no-auth-event") {
          console.error("Redirect login error:", error);
        }
      });
  }, [navigate]);

  // ✅ Auth state persistence — redirects if already logged in
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      if (currentUser) {
        const userData = {
          name: currentUser.displayName,
          email: currentUser.email,
          picture: currentUser.photoURL,
          uid: currentUser.uid,
        };
        setUser(userData);

        // ✅ Redirect only when on root path
        if (window.location.pathname === "/") {
          navigate("/dashboard");
        }
      } else {
        setUser(null);
      }
      setLoading(false);
    });

    return () => unsubscribe();
  }, [navigate]);

  // ✅ Login handler (popup for local, redirect for production)
  const handleLogin = async () => {
    try {
      provider.addScope("https://www.googleapis.com/auth/calendar.events");

      if (window.location.hostname.includes("localhost")) {
        // Local testing
        const result = await signInWithPopup(auth, provider);
        const credential = GoogleAuthProvider.credentialFromResult(result);
        const accessToken = credential?.accessToken;

        if (accessToken) {
          localStorage.setItem("googleAccessToken", accessToken);
          console.log("✅ Google Access Token saved:", accessToken);
        }

        const userData = {
          name: result.user.displayName,
          email: result.user.email,
          picture: result.user.photoURL,
          uid: result.user.uid,
        };
        setUser(userData);
        navigate("/dashboard");
      } else {
        // ✅ Use redirect login for Vercel
        await signInWithRedirect(auth, provider);
      }
    } catch (error) {
      console.error("❌ Google login failed:", error);
      alert("Google login failed. Please check the console for details.");
    }
  };

  // ✅ Logout handler
  const handleLogout = async () => {
    try {
      await signOut(auth);
      localStorage.removeItem("googleAccessToken");
      setUser(null);
      navigate("/");
    } catch (error) {
      console.error("Logout error:", error);
    }
  };

  if (loading) return <p>Loading...</p>;

  return (
    <Routes>
      {/* Landing Page */}
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
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <AppWrapper />
    </BrowserRouter>
  );
}
