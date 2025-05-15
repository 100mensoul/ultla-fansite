// firebase.js
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.10.0/firebase-app.js";
import { getAuth, signInAnonymously, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.10.0/firebase-auth.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/10.10.0/firebase-firestore.js";
import { getStorage } from "https://www.gstatic.com/firebasejs/10.10.0/firebase-storage.js";

const firebaseConfig = {
  apiKey: "AIzaSyCtDPnYex-KL2hbHAQe5fYSPv9rz9xTa9A",
  authDomain: "u2memo-36f61.firebaseapp.com",
  projectId: "u2memo-36f61",
  storageBucket: "u2memo-36f61.appspot.com",
  messagingSenderId: "14274931072",
  appId: "1:14274931072:web:5d9c9026905fdc0b383965"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const storage = getStorage(app);

// ログイン完了を待つ Promise を提供
const authReady = new Promise((resolve, reject) => {
  onAuthStateChanged(auth, user => {
    if (user) {
      resolve(user);
    } else {
      signInAnonymously(auth).catch(reject);
    }
  });
});

export { app, auth, db, storage, authReady };