// src/firebase.js
import { initializeApp, getApps, getApp } from "firebase/app";
import { getAnalytics, isSupported } from "firebase/analytics";
import { getAuth, GoogleAuthProvider } from "firebase/auth";
import { getDatabase } from "firebase/database";

const firebaseConfig = {
  apiKey: "AIzaSyAj5hwyJlZE5BSxpeoJ27zyUjpPyfYXSZw",
  authDomain: "studymate-e2268.firebaseapp.com",
  databaseURL: "https://studymate-e2268-default-rtdb.firebaseio.com",
  projectId: "studymate-e2268",
  storageBucket: "studymate-e2268.appspot.com",
  messagingSenderId: "983818270750",
  appId: "1:983818270750:web:ac96e821c515a62f84960f",
  measurementId: "G-BL9EM2JTXD"
};

const app = getApps().length ? getApp() : initializeApp(firebaseConfig);

// ✅ Analytics (optional)
let analytics;
if (typeof window !== "undefined") {
  isSupported().then((supported) => {
    if (supported) analytics = getAnalytics(app);
  });
}

// ✅ Auth + Provider
const auth = getAuth(app);
const provider = new GoogleAuthProvider();

// ✅ Add Google Calendar access permission
provider.addScope("https://www.googleapis.com/auth/calendar");

// ✅ Force account chooser and offline access
provider.setCustomParameters({
  access_type: "offline",
  prompt: "consent",
});

// ✅ 🔥 Force redirect URI to your production domain
if (window.location.hostname !== "localhost") {
  provider.setCustomParameters({
    redirect_uri: "https://study-mate-chi-six.vercel.app", // your Vercel URL
  });
}

// ✅ Realtime Database
const db = getDatabase(app);

export { auth, provider, db };
