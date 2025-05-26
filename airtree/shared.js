// shared.js（新版v3・シェア機能）
import { db, authReady, auth } from './firebase-test.js';
import {
  collection,
  query,
  where,
  orderBy,
  onSnapshot,
  getDocs
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";
import {
  signOut
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js";

// DOM要素の取得
const authStatus = document.getElementById("authStatus");
const loginInfo = document.getElementById("loginInfo");
const notLoginInfo = document.getElementById("notLoginInfo");
const currentUser = document.getElementById("currentUser");
const logoutBtn = document.getElementById("logoutBtn");

const tagFilterInput = document.getElementById("tagFilterInput");
const myOnlyCheckbox = document.getElementById("myOnlyCheckbox");
const clearFilterBtn = document.getElementById("clearFilterBtn");
const postsCount = document.getElementById("postsCount");
const sharedMemosContainer = document.getElementById("sharedMemosContainer");
const loadingMessage = document.getElementById("loadingMessage");

let currentUID = null;
let allSharedMemos = []; // 全てのシェア投稿を保持

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
    setTimeout(() => {
      window.location.href = "auth-test.html";
    }, 1000);
  } catch (error) {
    console.error("ログアウトエラー:", error);
    alert("ログアウトに失敗しました: " + error.message);
  }
}

// escapeHTML 関数
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

// シェア投稿のHTML要素を作成
function createSharedMemoElement(memo, memoId) {
  const memoElement = document.createElement('div');
  memoElement.classList.add('memo-item');
  memoElement.setAttribute('data-id', memoId);
  memoElement.style.position = 'relative';

  let htmlContent = '';

  // 画像表示
  if (memo.imageUrl) {
    htmlContent += `<img src="${escapeHTML(memo.imageUrl)}" alt="シェア画像" style="width: 100%; max-width: 400px; height: auto; border-radius: 6px; margin-bottom: 10px;">`;
  }

  // メモ内容
  if (memo.content) {
    htmlContent += `<h3>📝 ${escapeHTML(memo.content)}</h3>`;
  }

  // タグ表示
  if (memo.tags && memo.tags.length > 0) {
    htmlContent += `<div style="margin-bottom: 10px;">${memo.tags.map(tag => `<span class="tag">${escapeHTML(tag)}</span>`).join(' ')}</div>`;
  }

  // 投稿者情報（仮）
  const authorName = memo.authorName || '匿名ユーザー';
  htmlContent += `<div style="color: #666; font-size: 0.9em; margin-bottom: 5px;">👤 投稿者: ${escapeHTML(authorName)}</div>`;

  // 自分の投稿の場合の表示
  if (memo.uid === currentUID) {
    htmlContent += `<div style="color: #007bff; font-size: 0.8em; font-weight: bold; margin-bottom: 5px;">✨ あなたの投稿</div>`;
  }

  // 投稿日時
  if (memo.createdAt && memo.createdAt.toDate) {
    try {
      const createdAtDate = memo.createdAt.toDate();
      htmlContent += `<div style="color: #777; font-size: 0.8em;">🕐 ${createdAtDate.toLocaleString('ja-JP')}</div>`;
    } catch (dateError) {
      console.warn("日時の変換に失敗:", dateError);
    }
  }

  memoElement.innerHTML = htmlContent;
  return memoElement;
}

// フィルターに基づいて投稿を表示
function displayFilteredMemos() {
  const searchKeyword = tagFilterInput.value.trim().toLowerCase();
  const myOnly = myOnlyCheckbox.checked;

  let filteredMemos = allSharedMemos;

  // キーワード検索（タグ + メモ内容）
  if (searchKeyword) {
    const searchTerms = searchKeyword.split(',').map(term => term.trim()).filter(term => term !== '');
    filteredMemos = filteredMemos.filter(memo => {
      // タグでの検索
      const tagMatch = memo.data.tags && memo.data.tags.some(tag => 
        searchTerms.some(searchTerm => tag.toLowerCase().includes(searchTerm))
      );
      
      // メモ内容での検索
      const contentMatch = memo.data.content && 
        searchTerms.some(searchTerm => memo.data.content.toLowerCase().includes(searchTerm));
      
      return tagMatch || contentMatch;
    });
  }

  // 自分の投稿のみフィルター
  if (myOnly && currentUID) {
    filteredMemos = filteredMemos.filter(memo => memo.data.uid === currentUID);
  }

  // 投稿件数表示
  const searchInfo = searchKeyword ? ` (「${searchKeyword}」で検索)` : '';
  postsCount.textContent = `${filteredMemos.length}件の投稿が見つかりました${searchInfo}`;

  // 表示更新
  sharedMemosContainer.innerHTML = '';
  loadingMessage.style.display = 'none';

  if (filteredMemos.length === 0) {
    const emptyMessage = document.createElement('p');
    const message = searchKeyword ? 
      `「${searchKeyword}」に一致する投稿がありません。` : 
      '条件に一致する投稿がありません。';
    emptyMessage.textContent = message;
    emptyMessage.style.textAlign = 'center';
    emptyMessage.style.color = '#666';
    emptyMessage.style.padding = '40px 20px';
    sharedMemosContainer.appendChild(emptyMessage);
  } else {
    filteredMemos.forEach(({ id, data }) => {
      const memoElement = createSharedMemoElement(data, id);
      sharedMemosContainer.appendChild(memoElement);
    });
  }
}

// シェア投稿を読み込み
function loadSharedMemos() {
  console.log("シェア投稿を読み込み中...");
  
  const sharedMemosRef = collection(db, "sharedMemos");
  const q = query(sharedMemosRef, where("isPublic", "==", true));
  
  onSnapshot(q, (querySnapshot) => {
    console.log("シェア投稿を受信:", querySnapshot.size, "件");
    
    allSharedMemos = [];
    
    querySnapshot.forEach((doc) => {
      const memo = doc.data();
      const memoId = doc.id;
      console.log("シェア投稿データ:", { id: memoId, memo });
      allSharedMemos.push({ id: memoId, data: memo });
    });
    
    // 日時でソート（新しい順）
    allSharedMemos.sort((a, b) => {
      const aTime = a.data.createdAt?.toDate?.() || new Date(0);
      const bTime = b.data.createdAt?.toDate?.() || new Date(0);
      return bTime - aTime;
    });
    
    displayFilteredMemos();
    console.log("シェア投稿の表示完了:", allSharedMemos.length, "件");
    
  }, (error) => {
    console.error("シェア投稿の読み込みエラー:", error);
    sharedMemosContainer.innerHTML = `<p style="color: red; text-align: center;">シェア投稿の読み込みに失敗しました: ${error.message}</p>`;
  });
}

// フィルタークリア
function clearFilters() {
  tagFilterInput.value = '';
  myOnlyCheckbox.checked = false;
  displayFilteredMemos();
}

// イベントリスナーの設定
logoutBtn.addEventListener('click', handleLogout);
tagFilterInput.addEventListener('input', displayFilteredMemos);
myOnlyCheckbox.addEventListener('change', displayFilteredMemos);
clearFilterBtn.addEventListener('click', clearFilters);

// 認証完了後の処理
authReady.then(async (user) => {
  console.log("認証完了:", user);
  updateAuthDisplay(user);
  
  if (user && user.uid) {
    currentUID = user.uid;
    console.log("ユーザーUID設定:", currentUID);
    loadSharedMemos();
  } else {
    console.log("未ログイン状態");
    currentUID = null;
    sharedMemosContainer.innerHTML = '<p style="color: orange; text-align: center;">ログインが必要です。</p>';
  }
}).catch(error => {
  console.error("認証処理エラー:", error);
  updateAuthDisplay(null);
  sharedMemosContainer.innerHTML = '<p style="color: red; text-align: center;">認証中にエラーが発生しました。</p>';
});

console.log("shared.js が読み込まれました");
