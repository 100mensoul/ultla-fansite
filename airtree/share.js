import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js";
import {
  getAuth,
  signInAnonymously,
  onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js";
import {
  getFirestore,
  collection,
  query,
  where,
  getDocs,
  orderBy
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";

// Firebase設定
const firebaseConfig = {
  apiKey: "AIzaSyCtDPnYex-KL2hbHAQe5fYSPv9rz9xTa9A",
  authDomain: "u2memo-36f61.firebaseapp.com",
  projectId: "u2memo-36f61",
  storageBucket: "u2memo-36f61.appspot.com",
  messagingSenderId: "14274931072",
  appId: "1:14274931072:web:5d9c9026905fdc0b383965"
};

// 初期化
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

let currentUID = null;

signInAnonymously(auth)
  .catch((error) => {
    alert("ログイン失敗：" + error.message);
  });

onAuthStateChanged(auth, (user) => {
  if (user) {
    currentUID = user.uid;
    loadMemos();
  }
});

document.getElementById("tagFilterInput").addEventListener("input", loadMemos);
document.getElementById("myOnlyCheckbox").addEventListener("change", loadMemos);

async function loadMemos() {
  const tag = document.getElementById("tagFilterInput").value.trim();
  const myOnly = document.getElementById("myOnlyCheckbox").checked;

  let q = collection(db, "sharedMemos");

  let filters = [where("isPublic", "==", true)];

  if (tag) {
    filters.push(where("tags", "array-contains", tag));
  }

  if (myOnly && currentUID) {
    filters.push(where("uid", "==", currentUID));
  }

  q = query(q, ...filters, orderBy("createdAt", "desc"));

  try {
    const snapshot = await getDocs(q);
    const list = document.getElementById("memoList");
    list.innerHTML = "";

    snapshot.forEach(doc => {
      const data = doc.data();

      const div = document.createElement("div");
      div.className = "memo-item";

      if (data.imageUrl) {
        const img = document.createElement("img");
        img.src = data.imageUrl;
        img.alt = "image";
        img.style.maxWidth = "200px";
        div.appendChild(img);
      }

      const p = document.createElement("p");
      p.textContent = data.content;
      div.appendChild(p);

      const tagLine = document.createElement("small");
      tagLine.textContent = `タグ: ${data.tags.join(", ")}`;
      div.appendChild(tagLine);

      list.appendChild(div);
    });
  } catch (e) {
    document.getElementById("memoList").innerHTML = `読み込みエラー: ${e.message}`;
  }
}