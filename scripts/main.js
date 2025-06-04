// Initialize Firebase and enforce Google authentication before showing the app
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.11.0/firebase-app.js";
import { getAuth, onAuthStateChanged, GoogleAuthProvider, signInWithPopup } from "https://www.gstatic.com/firebasejs/10.11.0/firebase-auth.js";

const firebaseConfigFromHost = typeof __firebase_config !== 'undefined' ? __firebase_config : null;
const firebaseConfig = firebaseConfigFromHost ? JSON.parse(firebaseConfigFromHost) : {
    apiKey: "AIzaSyCsDIUOYmxLhvw_uL-lvYFu89AtfIfwhH0",
    authDomain: "doichecker.firebaseapp.com",
    projectId: "doichecker",
    storageBucket: "doichecker.firebasestorage.app",
    messagingSenderId: "798815713057",
    appId: "1:798815713057:web:ffb823337b7acbfba27060",
    measurementId: "G-8N4P8YW0WK"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const provider = new GoogleAuthProvider();

function showApp() {
  document.getElementById('app').classList.remove('hidden');
  document.getElementById('login-screen').classList.add('hidden');
}

function showLogin() {
  document.getElementById('app').classList.add('hidden');
  document.getElementById('login-screen').classList.remove('hidden');
}

onAuthStateChanged(auth, (user) => {
  if (user) {
    showApp();
  } else {
    showLogin();
  }
});

export function login() {
  signInWithPopup(auth, provider).catch((err) => console.error(err));
}

// expose login globally for inline onclick handler
window.login = login;
