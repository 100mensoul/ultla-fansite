// memo-auth.js（認証統合版）
import { db, storage, authReady } from './firebase-test.js';
import {
  collection,
  addDoc,
  serverTimestamp,
  query,
  where,
  orderBy,
  onSnapshot
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";
import {
  ref,
  uploadBytes,
  getDownloadURL
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-storage.js";
import {
  signOut
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js";
import { auth } from './firebase-test.js';

// DOM要素の取得
const memoForm = document.getElementById("memoForm");
const imageInput = document.getElementById("imageInput");
const contentInput = document.getElementById("contentInput");
const tagsInput = document.getElementById("tagsInput");
const isPublicCheckbox = document.getElementById("isPublicCheckbox");
const statusMessage = document.getElementById("statusMessage");
const memoListContainer = document.getElementById("memoListContainer");
const loadingMessage = document.getElementById("loadingMessage");

// 認証状態表示要素
const authStatus = document.getElementById("authStatus");
const loginInfo = document.getElementById("loginInfo");
const notLoginInfo = document.getElementById("notLoginInfo");
const currentUser = document.getElementById("currentUser");
const logoutBtn = document.getElementById("logoutBtn");

let currentUID = null;

// 認証状態表示の更新
function updateAuthDisplay(user) {
  if (user) {
    const displayText = user.email || `匿名ユーザー (${user.uid.substring(0, 8)}...)`;
    const authMethod = user.isAnonymous ? '匿名' : (user.providerData[0]?.providerId === 'google.com' ? 'Google' : 'メール');
    currentUser.textContent = `${displayText} (${authMethod}認証)`;
    loginInfo.style.display = 'block';
    notLoginInfo.style.display = 'none';
  } else {
    loginInfo.style.display = 'none';
    notLoginInfo.style.display = 'block';
  }
}

// ログアウト処理
async function handleLogout() {
  try {
    await signOut(auth);
    statusMessage.textContent = "ログアウトしました。ログインページに移動します...";
    statusMessage.style.color = "blue";
    
    // 1秒後にログインページにリダイレクト
    setTimeout(() => {
      window.location.href = "auth-test.html";
    }, 1000);
    
  } catch (error) {
    console.error("ログアウトエラー:", error);
    statusMessage.textContent = "ログアウトに失敗しました: " + error.message;
    statusMessage.style.color = "red";
  }
}

// ログアウトボタンのイベントリスナー
logoutBtn.addEventListener('click', handleLogout);

// メモ投稿処理
memoForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  
  if (!currentUID) {
    statusMessage.textContent = "ログインが必要です。ログインページからログインしてください。";
    statusMessage.style.color = "red";
    return;
  }

  statusMessage.textContent = "保存処理中です...";
  statusMessage.style.color = "blue";

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

// ユーザーのメモをリアルタイムで表示
function displayUserMemos(userId) {
  if (!userId) {
    loadingMessage.textContent = "ログインしてください。";
    loadingMessage.style.color = "orange";
    return;
  }

  console.log("メモを読み込み中... ユーザーID:", userId);
  
  const memosRef = collection(db, "memos");
  const simpleQuery = query(memosRef, where("uid", "==", userId));
  
  onSnapshot(simpleQuery, (querySnapshot) => {
    console.log("クエリ結果を受信:", querySnapshot.size, "件");
    
    memoListContainer.innerHTML = '';

    if (querySnapshot.empty) {
      console.log("メモが見つかりませんでした");
      loadingMessage.textContent = "まだ投稿がありません。";
      loadingMessage.style.display = 'block';
      loadingMessage.style.color = '#666';
      memoListContainer.appendChild(loadingMessage);
    } else {
      loadingMessage.style.display = 'none';
      
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
      
      memos.forEach(({ id, data }) => {
        const memoElement = createMemoElement(data, id);
        memoListContainer.appendChild(memoElement);
      });
      
      console.log("メモの表示完了:", memos.length, "件");
    }
  }, (error) => {
    console.error("メモの読み込みエラー:", error);
    loadingMessage.textContent = `メモの読み込みに失敗しました: ${error.message}`;
    loadingMessage.style.display = 'block';
    loadingMessage.style.color = 'red';
    memoListContainer.innerHTML = '';
    memoListContainer.appendChild(loadingMessage);
  });
}

// 認証完了後の処理
authReady.then(async (user) => {
  console.log("認証完了:", user);
  updateAuthDisplay(user);
  
  if (user && user.uid) {
    currentUID = user.uid;
    console.log("ユーザーUID設定:", currentUID);
    displayUserMemos(currentUID);
  } else {
    console.log("未ログイン状態");
    currentUID = null;
    loadingMessage.textContent = 'ログインしてください。';
    loadingMessage.style.display = 'block';
    loadingMessage.style.color = 'orange';
    memoListContainer.innerHTML = '';
    memoListContainer.appendChild(loadingMessage);
  }
}).catch(error => {
  console.error("認証処理エラー:", error);
  updateAuthDisplay(null);
  memoListContainer.innerHTML = '<p>認証中にエラーが発生しました。</p>';
  loadingMessage.style.display = 'none';
});
