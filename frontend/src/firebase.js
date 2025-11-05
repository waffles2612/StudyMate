// src/firebase.js
import { initializeApp, getApps, getApp } from "firebase/app";
import { getAnalytics, isSupported } from "firebase/analytics";
import { getAuth, GoogleAuthProvider } from "firebase/auth";
import { getDatabase } from "firebase/database";

// ✅ Your web app's Firebase configuration
const firebaseConfig = {
  apiKey: "AIzaSyAj5hwyJlZE5BSxpeoJ27zyUjpPyfYXSZw",
  authDomain: "studymate-e2268.firebaseapp.com",
  databaseURL: "https://studymate-e2268-default-rtdb.firebaseio.com",
  projectId: "studymate-e2268",
  storageBucket: "studymate-e2268.appspot.com", // ✅ fixed this line
  messagingSenderId: "983818270750",
  appId: "1:983818270750:web:ac96e821c515a62f84960f",
  measurementId: "G-BL9EM2JTXD"
};

// ✅ Initialize Firebase once — avoid double initialization
const app = getApps().length ? getApp() : initializeApp(firebaseConfig);

// ✅ Initialize analytics only if supported (prevents SSR crash)
let analytics;
if (typeof window !== "undefined") {
  isSupported().then((supported) => {
    if (supported) {
      analytics = getAnalytics(app);
    }
  });
}

// ✅ Initialize Auth
const auth = getAuth(app);
const provider = new GoogleAuthProvider();

// ✅ Add Google Calendar access permission
provider.addScope("https://www.googleapis.com/auth/calendar");

// ✅ Force account chooser every time (and consent)
provider.setCustomParameters({
  access_type: "offline",
  prompt: "consent",
});

// ✅ Initialize Realtime Database
const db = getDatabase(app);

// ✅ Export initialized instances
export { auth, provider, db };
