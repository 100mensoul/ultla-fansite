// memo.js
import { db, storage, authReady } from './firebase.js'; // firebase.jsからインポート
import {
  collection,
  addDoc,
  serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";
import {
  ref,
  uploadBytes,
  getDownloadURL
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-storage.js";

// DOM要素の取得
const memoForm = document.getElementById("memoForm");
const imageInput = document.getElementById("imageInput");
const contentInput = document.getElementById("contentInput");
const tagsInput = document.getElementById("tagsInput");
const isPublicCheckbox = document.getElementById("isPublicCheckbox");
const statusMessage = document.getElementById("statusMessage");

memoForm.addEventListener("submit", async (e) => {
  e.preventDefault(); // デフォルトのフォーム送信をキャンセル

  statusMessage.textContent = "保存処理中です...";
  statusMessage.style.color = "blue";

  let currentUser;
  try {
    // firebase.jsのauthReadyを待ってユーザー情報を取得
    currentUser = await authReady;
    if (!currentUser || !currentUser.uid) {
      throw new Error("ユーザー認証情報が取得できませんでした。");
    }
  } catch (error) {
    console.error("認証エラー:", error);
    statusMessage.textContent = "エラー: " + error.message + " ページを再読み込みしてください。";
    statusMessage.style.color = "red";
    return;
  }

  const currentUID = currentUser.uid;

  // フォームデータの取得
  const content = contentInput.value.trim();
  const tagsRaw = tagsInput.value.trim();
  const isPublic = isPublicCheckbox.checked;
  const imageFile = imageInput.files[0];

  // バリデーション: メモ内容または画像が必須
  if (!content && !imageFile) {
    statusMessage.textContent = "メモ内容を入力するか、画像を選択してください。";
    statusMessage.style.color = "orange";
    return;
  }

  const tags = tagsRaw ? tagsRaw.split(",").map(tag => tag.trim().toLowerCase()).filter(tag => tag !== "") : [];

  let imageUrl = "";
  let imageStoragePath = ""; // Storage内のパスを保存する変数

  // 画像ファイルがある場合の処理
  if (imageFile) {
    // ファイル名をユーザーIDとタイムスタンプで一意にする
    const fileName = `${currentUID}_${Date.now()}_${imageFile.name}`;
    // 保存場所を 'memos_images/ユーザーID/ファイル名' に変更（より整理しやすくするため）
    const imageRef = ref(storage, `memos_images/${currentUID}/${fileName}`);
    try {
      statusMessage.textContent = "画像をアップロード中です...";
      const snapshot = await uploadBytes(imageRef, imageFile);
      imageUrl = await getDownloadURL(snapshot.ref);
      imageStoragePath = snapshot.ref.fullPath; // Storage上のフルパスを保存
      statusMessage.textContent = "画像アップロード完了。データを保存します...";
    } catch (error) {
      console.error("画像アップロード失敗:", error);
      statusMessage.textContent = "画像アップロード失敗: " + error.message;
      statusMessage.style.color = "red";
      return;
    }
  }

  // Firestoreに保存するデータ
  const memoData = {
    uid: currentUID,
    content,
    tags,
    isPublic,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(), // 作成時と更新時両方で使えるように
    imageUrl, // 画像のURL（なければ空文字）
    imageStoragePath, // 画像のStorageパス（なければ空文字）
  };

  try {
    // 1. 全てのメモを `memos` コレクションに保存 (ユーザー個人のメモ)
    // このコレクションはユーザー自身のメモ置き場
    const docRefMemos = await addDoc(collection(db, "memos"), memoData);
    console.log("個人メモ保存成功 ID: ", docRefMemos.id);

    // 2. `isPublic` が true の場合、`sharedMemos` コレクションにも保存
    if (isPublic) {
      // sharedMemos には、元の memos ドキュメントのIDも入れておくと関連付けしやすい
      const sharedMemoData = { ...memoData, originalMemoId: docRefMemos.id };
      const docRefShared = await addDoc(collection(db, "sharedMemos"), sharedMemoData);
      console.log("共有メモ保存成功 ID: ", docRefShared.id);
      statusMessage.textContent = "メモが公開され、共有されました！";
    } else {
      statusMessage.textContent = "メモが非公開で保存されました。";
    }
    statusMessage.style.color = "green";

    memoForm.reset(); // フォームをリセット
    imageInput.value = ""; // type="file" のリセット

    // 数秒後にメッセージをクリア
    setTimeout(() => {
      statusMessage.textContent = "";
    }, 5000);

  } catch (error) {
    console.error("Firestoreへの保存に失敗しました: ", error);
    statusMessage.textContent = "投稿に失敗しました: " + error.message;
    statusMessage.style.color = "red";
  }
});
