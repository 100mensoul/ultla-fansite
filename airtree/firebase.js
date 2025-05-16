// firebase.js
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js";
import { getAuth, signInAnonymously, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";
import { getStorage } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-storage.js";

const firebaseConfig = {
  apiKey: "AIzaSyCtDPnYex-KL2hbHAQe5fYSPv9rz9xTa9A", // ★必ずご自身のキーに置き換えてください
  authDomain: "u2memo-36f61.firebaseapp.com",
  // databaseURL: "https://u2memo-36f61-default-rtdb.asia-southeast1.firebasedatabase.app", // Firestore使用時は通常不要
  projectId: "u2memo-36f61",
  storageBucket: "u2memo-36f61.appspot.com",
  messagingSenderId: "14274931072",
  appId: "1:14274931072:web:5d9c9026905fdc0b383965"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const storage = getStorage(app);

// 匿名ログイン処理とユーザー準備完了を通知するPromise
const authReady = new Promise((resolve, reject) => {
  const unsubscribe = onAuthStateChanged(auth, user => {
    unsubscribe(); // ユーザー情報が得られたら、または最初の試行で監視を解除
    if (user) {
      resolve(user);
    } else {
      // ユーザーがいない場合は匿名でサインイン
      signInAnonymously(auth)
        .then((userCredential) => {
          resolve(userCredential.user); // 匿名サインイン成功時のユーザーをresolve
        })
        .catch(error => {
          console.error("匿名サインインに失敗しました:", error);
          reject(new Error("認証に失敗しました。Firebaseコンソールで匿名ログインが有効になっているか確認してください。"));
        });
    }
  }, error => { // onAuthStateChanged 自体のエラーハンドリング
    unsubscribe(); // エラー時も監視を解除
    console.error("認証状態の確認中にエラーが発生しました:", error);
    reject(new Error("認証状態の確認に失敗しました。"));
  });
});

export { app, auth, db, storage, authReady };
