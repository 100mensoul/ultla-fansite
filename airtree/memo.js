既存のコードと、改良コードを比較したい。改良コードに直したいが、抜けやミスがあると困る。まず改良コードを貼ります。その次に既存のコードを貼るので、待ってね。// memo.js

// 既存のインポートに追加
import { db, storage, authReady } from './firebase.js';
import {
  collection,
  addDoc,
  serverTimestamp,
  query,          // 追加
  where,          // 追加
  orderBy,        // 追加
  onSnapshot      // 追加 (リアルタイムリスナー用)
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";
import {
  ref,
  uploadBytes,
  getDownloadURL
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-storage.js";

// DOM要素の取得 (既存のに加えて一覧表示用要素を取得)
const memoForm = document.getElementById("memoForm");
const imageInput = document.getElementById("imageInput");
const contentInput = document.getElementById("contentInput");
const tagsInput = document.getElementById("tagsInput");
const isPublicCheckbox = document.getElementById("isPublicCheckbox");
const statusMessage = document.getElementById("statusMessage");
const memoListContainer = document.getElementById("memoListContainer"); // 追加
const loadingMessage = document.getElementById("loadingMessage");       // 追加

// --- 既存のフォーム送信処理 (memoForm.addEventListener) はこの下にそのまま残します ---
memoForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  statusMessage.textContent = "保存処理中です...";
  statusMessage.style.color = "blue";

  let currentUser;
  try {
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
  const content = contentInput.value.trim();
  const tagsRaw = tagsInput.value.trim();
  const isPublic = isPublicCheckbox.checked;
  const imageFile = imageInput.files[0];

  if (!content && !imageFile) {
    statusMessage.textContent = "メモ内容を入力するか、画像を選択してください。";
    statusMessage.style.color = "orange";
    setTimeout(() => { statusMessage.textContent = ""; }, 3000);
    return;
  }
  const tags = tagsRaw ? tagsRaw.split(",").map(tag => tag.trim().toLowerCase()).filter(tag => tag !== "") : [];
  let imageUrl = "";
  let imageStoragePath = "";

  if (imageFile) {
    const fileName = `${currentUID}_${Date.now()}_${imageFile.name}`;
    const imageRef = ref(storage, `memos_images/${fileName}`);
    try {
      statusMessage.textContent = "画像をアップロード中です...";
      const snapshot = await uploadBytes(imageRef, imageFile);
      imageUrl = await getDownloadURL(snapshot.ref);
      imageStoragePath = snapshot.ref.fullPath;
      statusMessage.textContent = "画像アップロード完了。データを保存します...";
    } catch (error) {
      console.error("画像アップロード失敗:", error);
      statusMessage.textContent = "画像アップロード失敗: " + error.message;
      statusMessage.style.color = "red";
      return;
    }
  }
  const memoData = {
    uid: currentUID,
    content,
    tags,
    isPublic,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
    imageUrl,
    imageStoragePath
  };
  try {
    const docRef = await addDoc(collection(db, "memos"), memoData);
    if (isPublic) {
      const sharedMemoData = { ...memoData, originalMemoId: docRef.id };
      await addDoc(collection(db, "sharedMemos"), sharedMemoData);
    }
    statusMessage.textContent = "メモが正常に保存されました！";
    statusMessage.style.color = "green";
    memoForm.reset();
    imageInput.value = "";
    setTimeout(() => { statusMessage.textContent = ""; }, 5000);
  } catch (error) {
    console.error("Firestoreへの保存に失敗しました: ", error);
    statusMessage.textContent = "投稿に失敗しました: " + error.message;
    statusMessage.style.color = "red";
  }
});
// --- 既存のフォーム送信処理ここまで ---


// HTML特殊文字をエスケープする関数 (XSS対策)
function escapeHTML(str) {
  if (typeof str !== 'string') return '';
  return str.replace(/[&<>"']/g, function(match) {
    return {
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#39;',
    }[match];
  });
}




// 個々のメモ要素を生成する関数
function createMemoElement(memoData, memoId) {
  const article = document.createElement('article');
  article.classList.add('memo-item');
  article.dataset.id = memoId; // データ属性としてドキュメントIDを保持

  let tagsHtml = '';
  if (memoData.tags && memoData.tags.length > 0) {
    tagsHtml = `<p class="tags">タグ: ${memoData.tags.map(tag => `<span class="tag">${escapeHTML(tag)}</span>`).join(' ')}</p>`;
  }

  let imageHtml = '';
  if (memoData.imageUrl) {
    imageHtml = `<img src="${escapeHTML(memoData.imageUrl)}" alt="メモ画像" style="max-width: 100%; height: auto; margin-top: 10px; border-radius: 4px;">`;
  }

  const createdAt = memoData.createdAt ? memoData.createdAt.toDate().toLocaleString('ja-JP') : '日時不明';

  article.innerHTML = `
    <h3>${escapeHTML(memoData.content) || '(内容は記述されていません)'}</h3>
    ${imageHtml}
    ${tagsHtml}
    <p class="timestamp">作成日時: ${createdAt}</p>
    <p class="public-status">${memoData.isPublic ? '公開中' : '非公開'}</p>
  `;
  // ここに編集ボタンや削除ボタンを追加することも可能です
  return article;
}

// ユーザーのメモをFirestoreから読み込んで表示する関数
async function displayUserMemos(userId) {
  if (!userId) {
    loadingMessage.textContent = "ユーザーIDが取得できませんでした。";
    loadingMessage.style.color = "red";
    return;
  }

  const memosCollectionRef = collection(db, "memos");
  const q = query(memosCollectionRef, where("uid", "==", userId), orderBy("createdAt", "desc"));

  // onSnapshotでリアルタイムにデータの変更を監視
  onSnapshot(q, (querySnapshot) => {
    // memoListContainerの中身を一度クリア
    memoListContainer.innerHTML = '';

    if (querySnapshot.empty) {
      loadingMessage.textContent = "あなたの投稿はまだありません。";
      loadingMessage.style.display = 'block'; // 表示
      memoListContainer.appendChild(loadingMessage); // コンテナ内にメッセージを移動
    } else {
      loadingMessage.style.display = 'none'; // データがあればローディングメッセージを隠す
      querySnapshot.forEach((doc) => {
        const memoData = doc.data();
        const memoElement = createMemoElement(memoData, doc.id);
        memoListContainer.appendChild(memoElement);
      });
    }
  }, (error) => {
    console.error("メモの読み込み中にエラーが発生しました: ", error);
    loadingMessage.textContent = "メモの読み込みに失敗しました。エラーの詳細はコンソールを確認してください。";
    loadingMessage.style.display = 'block'; // 表示
    loadingMessage.style.color = "red";
    memoListContainer.appendChild(loadingMessage); // コンテナ内にメッセージを移動
  });
}

// ページ読み込み時、認証が完了したらメモ一覧を表示
authReady
  .then(user => {
    if (user && user.uid) {
      displayUserMemos(user.uid);
    } else {
      // 通常、authReadyのロジックでここまで到達しないはず (匿名ユーザーが作られるため)
      // ただし、万が一のフォールバック
      loadingMessage.textContent = "ユーザー認証に失敗しました。ページを再読み込みしてください。";
      loadingMessage.style.color = "red";
      console.error("authReady resolved without a user or uid.");
    }
  })
  .catch(error => {
    // authReadyがrejectされた場合 (匿名サインインも失敗した場合など)
    console.error("認証処理中にエラー:", error);
    loadingMessage.textContent = "認証エラー: " + error.message + " ページを再読み込みするか、管理者にお問い合わせください。";
    loadingMessage.style.color = "red";
  });
