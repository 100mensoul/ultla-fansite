import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js";
import {
  getAuth,
  signInAnonymously,
  onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js";
import {
  getFirestore,
  collection,
  addDoc,
  serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";
import {
  getStorage,
  ref,
  uploadBytes,
  getDownloadURL
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-storage.js";

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
const storage = getStorage(app);

let currentUID = null;

signInAnonymously(auth)
  .catch((error) => {
    alert("ログインに失敗しました：" + error.message);
  });

onAuthStateChanged(auth, (user) => {
  if (user) {
    currentUID = user.uid;
  }
});

document.getElementById("memoForm").addEventListener("submit", async (e) => {
  e.preventDefault();

  if (!currentUID) {
    alert("ユーザー認証に失敗しました。再読み込みしてください。");
    return;
  }

  const content = document.getElementById("contentInput").value.trim();
  const tagsRaw = document.getElementById("tagsInput").value.trim();
  const isPublic = document.getElementById("isPublicCheckbox").checked;
  const imageFile = document.getElementById("imageInput").files[0];

  const tags = tagsRaw ? tagsRaw.split(",").map(tag => tag.trim()) : [];

  let imageUrl = "";

  if (imageFile) {
    const imageRef = ref(storage, `sharedMemos/${currentUID}/${Date.now()}_${imageFile.name}`);
    try {
      const snapshot = await uploadBytes(imageRef, imageFile);
      imageUrl = await getDownloadURL(snapshot.ref);
    } catch (error) {
      alert("画像アップロード失敗：" + error.message);
      return;
    }
  }

  const memoData = {
    content,
    tags,
    isPublic,
    createdAt: serverTimestamp(),
    imageUrl,
    uid: currentUID
  };

  try {
    // Firestoreに保存（非公開メモも含む）
    await addDoc(collection(db, "memos"), memoData);

    // 公開ONなら別コレクションにも保存
    if (isPublic) {
      await addDoc(collection(db, "sharedMemos"), memoData);
    }

    document.getElementById("statusMessage").textContent = "保存成功しました。";
    document.getElementById("memoForm").reset();
  } catch (error) {
    alert("投稿に失敗しました：" + error.message);
  }
});