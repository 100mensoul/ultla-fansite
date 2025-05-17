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
  let currentUID; // currentUID をここで宣言

  // 1. ユーザー認証情報を取得
  try {
    currentUser = await authReady;
    if (!currentUser || !currentUser.uid) {
      throw new Error("ユーザー認証情報が取得できませんでした。ページを再読み込みしてください。");
    }
    currentUID = currentUser.uid; // currentUser が確定した後に currentUID を設定
  } catch (error) {
    console.error("認証エラー:", error);
    statusMessage.textContent = "エラー: " + error.message;
    statusMessage.style.color = "red";
    return;
  }

  // 2. フォームデータの取得
  const content = contentInput.value.trim();
  const tagsRaw = tagsInput.value.trim();
  const isPublic = isPublicCheckbox.checked;
  const imageFile = imageInput.files[0]; // imageFile をここで定義

  // 3. バリデーション: メモ内容または画像が必須
  if (!content && !imageFile) {
    statusMessage.textContent = "メモ内容を入力するか、画像を選択してください。";
    statusMessage.style.color = "orange";
    return;
  }

  const tags = tagsRaw ? tagsRaw.split(",").map(tag => tag.trim().toLowerCase()).filter(tag => tag !== "") : [];

  let imageUrl = "";
  let imageStoragePath = "";

  // 4. 画像ファイルがある場合の処理 (currentUID と imageFile が定義された後)
  if (imageFile) {
    const fileName = `${currentUID}_${Date.now()}_${imageFile.name}`;
    const imageRef = ref(storage, `memos_images/${currentUID}/${fileName}`); // パスを修正
    try {
      statusMessage.textContent = "画像をアップロード中です...";
      const snapshot = await uploadBytes(imageRef, imageFile);
      imageUrl = await getDownloadURL(snapshot.ref);
      imageStoragePath = snapshot.ref.fullPath;
      statusMessage.textContent = "画像アップロード完了。データを保存します...";
    } catch (error) {
      console.error("画像アップロード失敗 (エラーオブジェクト全体):", error); // ★詳細なエラー出力
      console.error("エラーコード:", error.code);
      console.error("エラーメッセージ:", error.message);
      statusMessage.textContent = "画像アップロード失敗: " + error.message + " (詳細はコンソールを確認)";
      statusMessage.style.color = "red";
      return; // アップロード失敗時はここで処理を中断
    }
  }

  // 5. Firestoreに保存するデータ
  const memoData = {
    uid: currentUID,
    content,
    tags,
    isPublic,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
    imageUrl,
    imageStoragePath,
  };

  // 6. Firestoreへの保存処理
  try {
    const docRefMemos = await addDoc(collection(db, "memos"), memoData);
    console.log("個人メモ保存成功 ID: ", docRefMemos.id);

    if (isPublic) {
      const sharedMemoData = { ...memoData, originalMemoId: docRefMemos.id };
      const docRefShared = await addDoc(collection(db, "sharedMemos"), sharedMemoData);
      console.log("共有メモ保存成功 ID: ", docRefShared.id);
      statusMessage.textContent = "メモが公開され、共有されました！";
    } else {
      statusMessage.textContent = "メモが非公開で保存されました。";
    }
    statusMessage.style.color = "green";

    memoForm.reset();
    imageInput.value = "";

    setTimeout(() => {
      statusMessage.textContent = "";
    }, 5000);

  } catch (error) {
    console.error("Firestoreへの保存に失敗しました: ", error);
    statusMessage.textContent = "投稿に失敗しました: " + error.message;
    statusMessage.style.color = "red";
  }
});
