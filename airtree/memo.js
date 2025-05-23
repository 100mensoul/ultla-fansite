// memo.js（修正版）
import { db, storage, authReady } from './firebase.js';
import {
  collection,
  addDoc,
  serverTimestamp,
  query,
  where,
  orderBy,
  onSnapshot,
  getDocs
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";
import {
  ref,
  uploadBytes,
  getDownloadURL
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-storage.js";

const memoForm = document.getElementById("memoForm");
const imageInput = document.getElementById("imageInput");
const contentInput = document.getElementById("contentInput");
const tagsInput = document.getElementById("tagsInput");
const isPublicCheckbox = document.getElementById("isPublicCheckbox");
const statusMessage = document.getElementById("statusMessage");
const memoListContainer = document.getElementById("memoListContainer");
const loadingMessage = document.getElementById("loadingMessage");

let currentUID = null;

memoForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  statusMessage.textContent = "保存処理中です...";
  statusMessage.style.color = "blue";

  if (!currentUID) {
    statusMessage.textContent = "エラー: ユーザー認証が完了していません。ページを再読み込みしてください。";
    statusMessage.style.color = "red";
    try {
      const user = await authReady;
      if (!user || !user.uid) throw new Error("ユーザー認証情報が取得できませんでした。");
      currentUID = user.uid;
    } catch (authError) {
      console.error("認証再試行エラー:", authError);
      statusMessage.textContent = "エラー: " + authError.message + " ページを再読み込みしてください。";
      statusMessage.style.color = "red";
      return;
    }
  }

  const content = contentInput.value.trim();
  const tagsRaw = tagsInput.value.trim();
  const isPublic = isPublicCheckbox.checked;
  const imageFile = imageInput.files[0];

  if (!content && !imageFile) {
    statusMessage.textContent = "メモ内容を入力するか、画像を選択してください。";
    statusMessage.style.color = "orange";
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
    console.log("メモが保存されました。ID:", docRef.id);
    
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

// escapeHTML 関数（安全版）
function escapeHTML(str) {
  if (typeof str !== 'string') return '';
  return str.replace(/[&<>"']/g, function (match) {
    return {
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#39;',
    }[match];
  });
}

// メモを個別にHTMLとして生成
function createMemoElement(memo, memoId) {
  const memoElement = document.createElement('div');
  memoElement.classList.add('memo-item');
  memoElement.setAttribute('data-id', memoId);

  let htmlContent = `<h3>メモ内容:</h3><p>${escapeHTML(memo.content) || '記載なし'}</p>`;

  if (memo.imageUrl) {
    htmlContent += `<h4>写真:</h4><img src="${escapeHTML(memo.imageUrl)}" alt="投稿画像">`;
  }

  if (memo.tags && memo.tags.length > 0) {
    htmlContent += `<h4>タグ:</h4><p>${memo.tags.map(tag => `<span class="tag">${escapeHTML(tag)}</span>`).join(' ')}</p>`;
  }

  htmlContent += `<p><small>公開設定: ${memo.isPublic ? '公開' : '非公開'}</small></p>`;

  if (memo.project) {
    htmlContent += `<p><small>プロジェクト: ${escapeHTML(memo.project)}</small></p>`;
  }

  // createdAt が存在する場合のみ日時を表示
  if (memo.createdAt && memo.createdAt.toDate) {
    try {
      const createdAtDate = memo.createdAt.toDate();
      htmlContent += `<p><small>作成日時: ${createdAtDate.toLocaleString('ja-JP')}</small></p>`;
    } catch (dateError) {
      console.warn("日時の変換に失敗:", dateError);
      htmlContent += `<p><small>作成日時: 取得できませんでした</small></p>`;
    }
  }

  memoElement.innerHTML = htmlContent;
  return memoElement;
}

// ユーザーのメモをリアルタイムで表示（修正版）
function displayUserMemos(userId) {
  if (!userId) {
    loadingMessage.textContent = "ユーザーIDが取得できませんでした。";
    loadingMessage.style.color = "red";
    return;
  }

  console.log("メモを読み込み中... ユーザーID:", userId);
  
  const memosRef = collection(db, "memos");
  
  // まずは orderBy なしでクエリを試す
  const simpleQuery = query(memosRef, where("uid", "==", userId));
  
  onSnapshot(simpleQuery, (querySnapshot) => {
    console.log("クエリ結果を受信:", querySnapshot.size, "件");
    
    // コンテナをクリア
    memoListContainer.innerHTML = '';

    if (querySnapshot.empty) {
      console.log("メモが見つかりませんでした");
      loadingMessage.textContent = "まだ投稿がありません。";
      loadingMessage.style.display = 'block';
      loadingMessage.style.color = '#666';
      memoListContainer.appendChild(loadingMessage);
    } else {
      loadingMessage.style.display = 'none';
      
      // メモを配列に格納してソート
      const memos = [];
      querySnapshot.forEach((doc) => {
        const memo = doc.data();
        const memoId = doc.id;
        console.log("メモデータ:", { id: memoId, memo });
        memos.push({ id: memoId, data: memo });
      });
      
      // 手動でソート（createdAt の降順）
      memos.sort((a, b) => {
        const aTime = a.data.createdAt?.toDate?.() || new Date(0);
        const bTime = b.data.createdAt?.toDate?.() || new Date(0);
        return bTime - aTime;
      });
      
      // ソート済みのメモを表示
      memos.forEach(({ id, data }) => {
        const memoElement = createMemoElement(data, id);
        memoListContainer.appendChild(memoElement);
      });
      
      console.log("メモの表示完了:", memos.length, "件");
    }
  }, (error) => {
    console.error("メモの読み込みエラー:", error);
    console.error("エラーの詳細:", error.code, error.message);
    
    loadingMessage.textContent = `メモの読み込みに失敗しました: ${error.message}`;
    loadingMessage.style.display = 'block';
    loadingMessage.style.color = 'red';
    memoListContainer.innerHTML = '';
    memoListContainer.appendChild(loadingMessage);
    
    // エラーの種類によって対処法を提案
    if (error.code === 'failed-precondition') {
      console.log("インデックスが必要です。Firebaseコンソールでインデックスを作成してください。");
    } else if (error.code === 'permission-denied') {
      console.log("権限エラー。Firestoreのセキュリティルールを確認してください。");
    }
  });
}

// 認証完了後、ユーザーのメモを表示
authReady.then(async (user) => {
  console.log("認証完了:", user);
  if (user && user.uid) {
    currentUID = user.uid;
    console.log("ユーザーUID設定:", currentUID);
    displayUserMemos(currentUID);
  } else {
    console.log("ユーザー認証失敗");
    currentUID = null;
    memoListContainer.innerHTML = '<p>ログインしていません。</p>';
    loadingMessage.style.display = 'none';
  }
}).catch(error => {
  console.error("認証処理エラー:", error);
  memoListContainer.innerHTML = '<p>認証中にエラーが発生しました。</p>';
  loadingMessage.style.display = 'none';
});
