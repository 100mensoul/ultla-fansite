// firebase-test.js - ULTLAラボ用Firebase設定
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js";
import { getAuth, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";
import { getStorage } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-storage.js";

const firebaseConfig = {
  apiKey: "AIzaSyCtDPnYex-KL2hbHAQe5fYSPv9rz9xTa9A",
  authDomain: "u2memo-36f61.firebaseapp.com",
  projectId: "u2memo-36f61",
  storageBucket: "u2memo-36f61.firebasestorage.app",
  messagingSenderId: "14274931072",
  appId: "1:14274931072:web:5d9c9026905fdc0b383965"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);  
const storage = getStorage(app);

// ULTLAラボ用：自動ログインしないバージョン
const authReady = new Promise((resolve, reject) => {
  const unsubscribe = onAuthStateChanged(auth, user => {
    unsubscribe(); // 監視を解除
    
    console.log('ULTLAラボ認証状態確認:', user ? `ログイン済み (${user.uid})` : 'ログインしていません');
    
    // ユーザーがいてもいなくても、そのまま状態を返す
    resolve(user);
    
  }, error => {
    unsubscribe(); // エラー時も監視を解除
    console.error("ULTLAラボ認証状態の確認中にエラーが発生しました:", error);
    reject(new Error("認証状態の確認に失敗しました。"));
  });
});

// デバッグ用：認証状態をログ出力
authReady.then(user => {
  if (user) {
    console.log('ULTLAラボ初期認証状態: ログイン済み');
    console.log('- ユーザーID:', user.uid);
    console.log('- 匿名ユーザー:', user.isAnonymous);
    console.log('- メール:', user.email || '未設定');
    console.log('- 表示名:', user.displayName || '未設定');
  } else {
    console.log('ULTLAラボ初期認証状態: ログインしていません');
  }
}).catch(error => {
  console.error('ULTLAラボ認証状態確認エラー:', error);
});

export { app, auth, db, storage, authReady };