// memo-auth.js（統合版・profile-manager.js の機能を直接統合）
import { db, storage, authReady } from './firebase-test.js';
import {
  collection,
  addDoc,
  serverTimestamp,
  query,
  where,
  orderBy,
  onSnapshot,
  doc,
  getDoc,
  setDoc,
  getDocs,
  updateDoc,
  deleteDoc
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
const newPostTagSuggestions = document.getElementById("newPostTagSuggestions");

// 認証状態表示要素
const authStatus = document.getElementById("authStatus");
const loginInfo = document.getElementById("loginInfo");
const notLoginInfo = document.getElementById("notLoginInfo");
const currentUser = document.getElementById("currentUser");
const logoutBtn = document.getElementById("logoutBtn");
const editProfileBtn = document.getElementById("editProfileBtn");

let currentUID = null;
let userProfile = null;

// プロフィール管理機能（統合版）
async function getUserProfile(uid) {
  if (!uid) return null;
  try {
    const profileRef = doc(db, "userProfiles", uid);
    const profileSnap = await getDoc(profileRef);
    return profileSnap.exists() ? profileSnap.data() : null;
  } catch (error) {
    console.error("プロフィール取得エラー:", error);
    return null;
  }
}

async function updateUserProfile(uid, username, displayName = '') {
  if (!uid || !username) return false;
  try {
    const profileRef = doc(db, "userProfiles", uid);
    const profileData = {
      uid,
      username: username.trim(),
      displayName: displayName.trim() || username.trim(),
      updatedAt: serverTimestamp()
    };
    
    const existingProfile = await getDoc(profileRef);
    if (!existingProfile.exists()) {
      profileData.createdAt = serverTimestamp();
    }
    
    await setDoc(profileRef, profileData, { merge: true });
    return true;
  } catch (error) {
    console.error("プロフィール更新エラー:", error);
    return false;
  }
}

async function checkUsernameExists(username, currentUid = null) {
  if (!username) return false;
  try {
    const profilesRef = collection(db, "userProfiles");
    const q = query(profilesRef, where("username", "==", username.trim()));
    const querySnapshot = await getDocs(q);
    
    const duplicateUsers = querySnapshot.docs.filter(doc => 
      currentUid ? doc.id !== currentUid : true
    );
    return duplicateUsers.length > 0;
  } catch (error) {
    console.error("ユーザーネーム重複チェックエラー:", error);
    return false;
  }
}

async function isProfileComplete(uid) {
  const profile = await getUserProfile(uid);
  return profile && profile.username && profile.username.trim() !== '';
}

// メモ編集・削除に必要な新しい関数を追加
async function updateMemoDocument(memoId, updateData) {
  try {
    const memoRef = doc(db, "memos", memoId);
    await updateDoc(memoRef, {
      ...updateData,
      updatedAt: serverTimestamp()
    });
    return true;
  } catch (error) {
    console.error("メモ更新エラー:", error);
    return false;
  }
}

// sharedMemos コレクションとの同期
async function syncWithSharedMemos(memoId, memoData, isPublic) {
  try {
    const sharedMemosRef = collection(db, "sharedMemos");
    const q = query(sharedMemosRef, where("originalMemoId", "==", memoId));
    const querySnapshot = await getDocs(q);
    
    if (isPublic) {
      // 公開する場合
      if (querySnapshot.empty) {
        // 新規追加 - 元のメモのcreatedAtを保持
        const originalMemoRef = doc(db, "memos", memoId);
        const originalMemoSnap = await getDoc(originalMemoRef);
        const originalMemo = originalMemoSnap.data();
        
        const sharedMemoData = { 
          ...memoData, 
          originalMemoId: memoId,
          createdAt: originalMemo.createdAt, // 🔥 元の作成日時を保持
          updatedAt: serverTimestamp()
        };
        await addDoc(sharedMemosRef, sharedMemoData);
        console.log("sharedMemos に新規追加（元のcreatedAtを保持）");
      } else {
        // 既存を更新 - createdAtは変更しない
        const sharedDoc = querySnapshot.docs[0];
        const updateSharedData = { ...memoData };
        delete updateSharedData.createdAt; // createdAtは更新しない
        updateSharedData.updatedAt = serverTimestamp();
        
        await updateDoc(doc(db, "sharedMemos", sharedDoc.id), updateSharedData);
        console.log("sharedMemos を更新（createdAtは保持）");
      }
    } else {
      // 非公開にする場合
      if (!querySnapshot.empty) {
        // sharedMemos から削除
        const sharedDoc = querySnapshot.docs[0];
        await deleteDoc(doc(db, "sharedMemos", sharedDoc.id));
        console.log("sharedMemos から削除");
      }
    }
    return true;
  } catch (error) {
    console.error("sharedMemos 同期エラー:", error);
    return false;
  }
}

// 認証状態表示の更新
async function updateAuthDisplay(user) {
  if (user) {
    // ユーザープロフィールを取得してユーザーネームを表示
    const profile = await getUserProfile(user.uid);
    let displayText;
    let authMethod;
    
    if (profile && profile.username) {
      displayText = `${profile.username}さん、こんにちは！`;
    } else {
      const email = user.email || `匿名ユーザー (${user.uid.substring(0, 8)}...)`;
      displayText = email;
    }
    
    authMethod = user.isAnonymous ? '匿名' : (user.providerData[0]?.providerId === 'google.com' ? 'Google' : 'メール');
    
    currentUser.innerHTML = `${displayText} <small style="color: #666;">(${authMethod}認証)</small>`;
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

// プロフィール編集ボタンのイベントリスナー
editProfileBtn.addEventListener('click', () => {
  openUsernameModal(currentUID, true); // 編集モードで開く
});

// メモ投稿処理
memoForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  
  if (!currentUID) {
    statusMessage.textContent = "ログインが必要です。ログインページからログインしてください。";
    statusMessage.style.color = "red";
    return;
  }

  const isPublic = isPublicCheckbox.checked;
  
  // 公開投稿の場合、ユーザーネーム設定をチェック
  if (isPublic) {
    const profileComplete = await isProfileComplete(currentUID);
    if (!profileComplete) {
      statusMessage.textContent = "公開投稿にはユーザーネーム設定が必要です。";
      statusMessage.style.color = "orange";
      openUsernameModal(currentUID);
      return;
    }
  }

  statusMessage.textContent = "保存処理中です...";
  statusMessage.style.color = "blue";

  const content = contentInput.value.trim();
  const tagsRaw = tagsInput.value.trim();
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

  const currentUserProfile = await getUserProfile(currentUID);
  const authorName = currentUserProfile ? currentUserProfile.displayName : '匿名ユーザー';

  const memoData = {
    uid: currentUID,
    content,
    tags,
    isPublic,
    authorName,
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
  memoElement.style.position = 'relative';

  let htmlContent = `<h3>メモ内容:</h3><p>${escapeHTML(memo.content) || '記載なし'}</p>`;

  if (memo.imageUrl) {
    htmlContent += `<h4>写真:</h4><img src="${escapeHTML(memo.imageUrl)}" alt="投稿画像">`;
  }

  if (memo.tags && memo.tags.length > 0) {
    htmlContent += `<h4>タグ:</h4><p>${memo.tags.map(tag => `<span class="tag">${escapeHTML(tag)}</span>`).join(' ')}</p>`;
  }

  htmlContent += `<p><small>公開設定: ${memo.isPublic ? '🌟 公開中' : '🔒 非公開'}</small></p>`;

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

  // 編集・削除ボタンを追加（本人の投稿のみ）
  if (memo.uid === currentUID) {
    htmlContent += `
      <div style="margin-top: 15px; padding-top: 10px; border-top: 1px solid #eee; text-align: right;">
        <button class="edit-memo-btn" data-memo-id="${memoId}" style="
          padding: 6px 12px; 
          background: #17a2b8; 
          color: white; 
          border: none; 
          border-radius: 4px; 
          cursor: pointer; 
          font-size: 12px;
          margin-right: 8px;
        ">✏️ 編集</button>
        <button class="delete-memo-btn" data-memo-id="${memoId}" style="
          padding: 6px 12px; 
          background: #dc3545; 
          color: white; 
          border: none; 
          border-radius: 4px; 
          cursor: pointer; 
          font-size: 12px;
        ">🗑️ 削除</button>
      </div>
    `;
  }

  memoElement.innerHTML = htmlContent;
  
  // ボタンのイベントリスナーを追加
  const editBtn = memoElement.querySelector('.edit-memo-btn');
  const deleteBtn = memoElement.querySelector('.delete-memo-btn');
  
  if (editBtn) {
    editBtn.addEventListener('click', () => openEditModal(memoId, memo));
  }
  
  if (deleteBtn) {
    deleteBtn.addEventListener('click', () => deleteMemo(memoId, memo));
  }

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

// ユーザーネーム設定モーダル関連
const usernameModal = document.getElementById('usernameModal');
const usernameInput = document.getElementById('usernameInput');
const displayNameInput = document.getElementById('displayNameInput');
const enableDuplicateCheck = document.getElementById('enableDuplicateCheck');
const duplicateCheckSection = document.getElementById('duplicateCheckSection');
const checkUsernameBtn = document.getElementById('checkUsernameBtn');
const saveUsernameBtn = document.getElementById('saveUsernameBtn');
const cancelUsernameBtn = document.getElementById('cancelUsernameBtn');
const checkResult = document.getElementById('checkResult');

let usernameAvailable = false;
let isEditMode = false;

function showCheckResult(message, isSuccess = false) {
  checkResult.textContent = message;
  checkResult.style.color = isSuccess ? 'green' : 'red';
  checkResult.style.display = 'block';
}

function clearCheckResult() {
  checkResult.style.display = 'none';
  usernameAvailable = false;
}

// 重複チェック表示切り替え
enableDuplicateCheck.addEventListener('change', () => {
  duplicateCheckSection.style.display = enableDuplicateCheck.checked ? 'block' : 'none';
  clearCheckResult();
});

async function checkUsername() {
  const username = usernameInput.value.trim();
  
  if (!username) {
    showCheckResult('ユーザーネームを入力してください');
    return;
  }
  
  if (username.length < 3) {
    showCheckResult('ユーザーネームは3文字以上で入力してください');
    return;
  }
  
  if (username.length > 20) {
    showCheckResult('ユーザーネームは20文字以下で入力してください');
    return;
  }
  
  checkUsernameBtn.disabled = true;
  checkUsernameBtn.textContent = 'チェック中...';
  
  try {
    const exists = await checkUsernameExists(username, currentUID);
    
    if (exists) {
      showCheckResult('このユーザーネームは既に使用されています');
      usernameAvailable = false;
    } else {
      showCheckResult('このユーザーネームは使用できます！', true);
      usernameAvailable = true;
    }
  } catch (error) {
    showCheckResult('チェック中にエラーが発生しました');
    console.error('ユーザーネームチェックエラー:', error);
  } finally {
    checkUsernameBtn.disabled = false;
    checkUsernameBtn.textContent = '重複チェック実行';
  }
}

async function saveProfile() {
  const username = usernameInput.value.trim();
  const displayName = displayNameInput.value.trim();
  
  // 基本バリデーション
  if (!username) {
    showCheckResult('ユーザーネームを入力してください');
    return;
  }
  
  if (username.length < 3 || username.length > 20) {
    showCheckResult('ユーザーネームは3文字以上、20文字以下で入力してください');
    return;
  }
  
  // 重複チェックが有効で、まだチェックしていない場合の警告
  if (enableDuplicateCheck.checked && !usernameAvailable) {
    showCheckResult('重複チェックを実行してください');
    return;
  }
  
  saveUsernameBtn.disabled = true;
  saveUsernameBtn.textContent = '保存中...';
  
  try {
    const success = await updateUserProfile(currentUID, username, displayName);
    
    if (success) {
      userProfile = await getUserProfile(currentUID);
      await updateAuthDisplay({ uid: currentUID, email: null, isAnonymous: false, providerData: [{ providerId: 'password' }] });
      closeModal();
      
      const message = isEditMode ? 
        'プロフィールが更新されました！' : 
        'プロフィールが設定されました！公開投稿を続けることができます。';
      
      statusMessage.textContent = message;
      statusMessage.style.color = 'green';
      setTimeout(() => { statusMessage.textContent = ""; }, 5000);
    } else {
      showCheckResult('設定に失敗しました。もう一度お試しください。');
    }
  } catch (error) {
    showCheckResult('設定中にエラーが発生しました');
    console.error('プロフィール保存エラー:', error);
  } finally {
    saveUsernameBtn.disabled = false;
    saveUsernameBtn.textContent = '💾 設定完了';
  }
}

function openUsernameModal(uid, editMode = false) {
  currentUID = uid;
  isEditMode = editMode;
  
  // 編集モードの場合、既存データを読み込み
  if (editMode && userProfile) {
    usernameInput.value = userProfile.username || '';
    displayNameInput.value = userProfile.displayName || '';
  }
  
  usernameModal.style.display = 'block';
  usernameInput.focus();
  clearCheckResult();
  enableDuplicateCheck.checked = false;
  duplicateCheckSection.style.display = 'none';
}

function closeModal() {
  usernameModal.style.display = 'none';
  usernameInput.value = '';
  displayNameInput.value = '';
  enableDuplicateCheck.checked = false;
  duplicateCheckSection.style.display = 'none';
  clearCheckResult();
  isEditMode = false;
}

// イベントリスナー
checkUsernameBtn.addEventListener('click', checkUsername);
saveUsernameBtn.addEventListener('click', saveProfile);
cancelUsernameBtn.addEventListener('click', closeModal);
usernameInput.addEventListener('input', clearCheckResult);
usernameInput.addEventListener('keypress', (e) => {
  if (e.key === 'Enter') {
    if (enableDuplicateCheck.checked) {
      checkUsername();
    } else {
      saveProfile();
    }
  }
});
usernameModal.addEventListener('click', (e) => {
  if (e.target === usernameModal) closeModal();
});

// 認証完了後の処理
authReady.then(async (user) => {
  console.log("認証完了:", user);
  updateAuthDisplay(user);
  
  if (user && user.uid) {
    currentUID = user.uid;
    console.log("ユーザーUID設定:", currentUID);
    userProfile = await getUserProfile(currentUID);
    console.log("ユーザープロフィール:", userProfile);
    
    // ユーザーのタグを読み込み
    await loadUserTags();
    
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

// === メモ編集・削除機能 ===

// 編集モーダル関連要素
const editMemoModal = document.getElementById('editMemoModal');
const currentImageSection = document.getElementById('currentImageSection');
const currentImage = document.getElementById('currentImage');
const editImageInput = document.getElementById('editImageInput');
const editContentInput = document.getElementById('editContentInput');
const editTagsInput = document.getElementById('editTagsInput');
const editIsPublicCheckbox = document.getElementById('editIsPublicCheckbox');
const editStatusMessage = document.getElementById('editStatusMessage');
const saveEditBtn = document.getElementById('saveEditBtn');
const cancelEditBtn = document.getElementById('cancelEditBtn');
const tagSuggestions = document.getElementById('tagSuggestions');

let currentEditingMemoId = null;
let currentEditingMemo = null;
let allUserTags = []; // ユーザーの全タグを保持

// ユーザーの使用済みタグを取得
async function loadUserTags() {
  try {
    const memosRef = collection(db, "memos");
    const q = query(memosRef, where("uid", "==", currentUID));
    const querySnapshot = await getDocs(q);
    
    const tagsSet = new Set();
    querySnapshot.forEach((doc) => {
      const memo = doc.data();
      if (memo.tags && Array.isArray(memo.tags)) {
        memo.tags.forEach(tag => tagsSet.add(tag.toLowerCase()));
      }
    });
    
    allUserTags = Array.from(tagsSet).sort();
    console.log("ユーザータグ読み込み完了:", allUserTags);
    
    // タグ読み込み後に自動補完機能を初期化
    initializeTagAutocomplete();
  } catch (error) {
    console.error("タグ読み込みエラー:", error);
  }
}

// 改良版タグサジェスト表示
function showTagSuggestions(input, suggestionsContainer, suggestions) {
  if (suggestions.length === 0) {
    suggestionsContainer.style.display = 'none';
    return;
  }
  
  suggestionsContainer.innerHTML = '';
  suggestions.forEach(tag => {
    const suggestionDiv = document.createElement('div');
    suggestionDiv.textContent = tag;
    suggestionDiv.style.cssText = `
      padding: 8px 12px;
      cursor: pointer;
      border-bottom: 1px solid #eee;
      font-size: 14px;
      transition: background-color 0.2s;
    `;
    
    suggestionDiv.addEventListener('mouseenter', () => {
      suggestionDiv.style.backgroundColor = '#f0f8ff';
    });
    
    suggestionDiv.addEventListener('mouseleave', () => {
      suggestionDiv.style.backgroundColor = 'white';
    });
    
    suggestionDiv.addEventListener('click', () => {
      // 現在の入力値を取得
      const currentValue = input.value;
      const lastCommaIndex = currentValue.lastIndexOf(',');
      
      let newValue;
      if (lastCommaIndex === -1) {
        // カンマがない場合（最初のタグ）
        newValue = tag;
      } else {
        // カンマがある場合（追加のタグ）
        const beforeLastTag = currentValue.substring(0, lastCommaIndex + 1);
        newValue = beforeLastTag + ' ' + tag;
      }
      
      // 既に同じタグがないかチェック
      const existingTags = newValue.split(',').map(t => t.trim().toLowerCase());
      const uniqueTags = [...new Set(existingTags)].filter(t => t !== '');
      
      input.value = uniqueTags.join(', ') + (uniqueTags.length > 0 ? ', ' : '');
      suggestionsContainer.style.display = 'none';
      input.focus();
    });
    
    suggestionsContainer.appendChild(suggestionDiv);
  });
  
  suggestionsContainer.style.display = 'block';
}

// 改良版タグ入力ハンドラー（予測変換的動作）
function setupTagAutocomplete(input, suggestionsContainer) {
  let hideTimeout;

  input.addEventListener('input', (e) => {
    clearTimeout(hideTimeout);
    
    const value = e.target.value;
    const lastCommaIndex = value.lastIndexOf(',');
    const currentTag = lastCommaIndex === -1 ? 
      value.trim().toLowerCase() : 
      value.substring(lastCommaIndex + 1).trim().toLowerCase();
    
    // 予測変換的動作：1文字以上で候補表示
    if (currentTag.length >= 1) {
      const matchingTags = allUserTags.filter(tag => 
        tag.includes(currentTag) && tag !== currentTag
      ).slice(0, 8); // 最大8個まで表示
      
      showTagSuggestions(input, suggestionsContainer, matchingTags);
    } else if (value.trim() === '') {
      // 完全に空の場合は人気タグを表示
      const popularTags = allUserTags.slice(0, 5);
      showTagSuggestions(input, suggestionsContainer, popularTags);
    } else {
      suggestionsContainer.style.display = 'none';
    }
  });

  // フォーカス時の動作
  input.addEventListener('focus', (e) => {
    clearTimeout(hideTimeout);
    
    const value = e.target.value;
    if (value.trim() === '' && allUserTags.length > 0) {
      // 空の場合は人気タグを表示
      const popularTags = allUserTags.slice(0, 5);
      showTagSuggestions(input, suggestionsContainer, popularTags);
    } else if (value.length >= 1) {
      // 既に入力がある場合は現在の入力に基づいて表示
      const lastCommaIndex = value.lastIndexOf(',');
      const currentTag = lastCommaIndex === -1 ? 
        value.trim().toLowerCase() : 
        value.substring(lastCommaIndex + 1).trim().toLowerCase();
      
      if (currentTag.length >= 1) {
        const matchingTags = allUserTags.filter(tag => 
          tag.includes(currentTag) && tag !== currentTag
        ).slice(0, 8);
        
        showTagSuggestions(input, suggestionsContainer, matchingTags);
      }
    }
  });

  // ブラー時の動作（少し遅延）
  input.addEventListener('blur', () => {
    hideTimeout = setTimeout(() => {
      suggestionsContainer.style.display = 'none';
    }, 200);
  });

  // Enterキーで最初の候補を選択
  input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && suggestionsContainer.style.display === 'block') {
      const firstSuggestion = suggestionsContainer.querySelector('div');
      if (firstSuggestion) {
        e.preventDefault();
        firstSuggestion.click();
      }
    } else if (e.key === 'Escape') {
      suggestionsContainer.style.display = 'none';
    }
  });
}

// 新規投稿とエディットの両方にタグ自動補完を設定
function initializeTagAutocomplete() {
  if (allUserTags.length > 0) {
    // 新規投稿フォーム
    setupTagAutocomplete(tagsInput, newPostTagSuggestions);
    
    // 編集モーダル
    setupTagAutocomplete(editTagsInput, tagSuggestions);
    
    console.log('タグ自動補完機能を初期化:', allUserTags.length, '件のタグ');
  }
}

// 編集モーダルを開く
function openEditModal(memoId, memo) {
  currentEditingMemoId = memoId;
  currentEditingMemo = memo;
  
  // 現在の値をフォームに設定
  editContentInput.value = memo.content || '';
  editTagsInput.value = memo.tags ? memo.tags.join(', ') : '';
  editIsPublicCheckbox.checked = memo.isPublic || false;
  
  // 現在の画像を表示
  if (memo.imageUrl) {
    currentImage.src = memo.imageUrl;
    currentImageSection.style.display = 'block';
  } else {
    currentImageSection.style.display = 'none';
  }
  
  // 新しい画像選択をクリア
  editImageInput.value = '';
  editStatusMessage.textContent = '';
  
  editMemoModal.style.display = 'block';
}

// 編集モーダルを閉じる
function closeEditModal() {
  editMemoModal.style.display = 'none';
  currentEditingMemoId = null;
  currentEditingMemo = null;
  editStatusMessage.textContent = '';
}

// メモ削除（確認ダイアログ付き）
function deleteMemo(memoId, memo) {
  const confirmMessage = memo.content ? 
    `「${memo.content.substring(0, 30)}...」を削除しますか？` : 
    'このメモを削除しますか？';
  
  if (confirm(confirmMessage + '\n\n※この操作は取り消せません。')) {
    // 実際の削除処理は段階5で実装
    statusMessage.textContent = '削除機能は段階5で実装予定です。';
    statusMessage.style.color = 'orange';
    setTimeout(() => { statusMessage.textContent = ""; }, 3000);
  }
}

// 編集保存（段階2：公開設定変更機能）
async function saveEdit() {
  if (!currentEditingMemoId || !currentEditingMemo) {
    editStatusMessage.textContent = 'エラー: 編集データが見つかりません。';
    editStatusMessage.style.color = 'red';
    return;
  }

  // 公開設定を変更する場合のプロフィールチェック
  const newIsPublic = editIsPublicCheckbox.checked;
  const oldIsPublic = currentEditingMemo.isPublic;
  
  if (newIsPublic && !oldIsPublic) {
    // 非公開→公開にする場合、ユーザーネーム設定をチェック
    const profileComplete = await isProfileComplete(currentUID);
    if (!profileComplete) {
      editStatusMessage.textContent = '公開投稿にはユーザーネーム設定が必要です。';
      editStatusMessage.style.color = 'orange';
      return;
    }
  }

  saveEditBtn.disabled = true;
  saveEditBtn.textContent = '保存中...';
  editStatusMessage.textContent = '変更を保存しています...';
  editStatusMessage.style.color = 'blue';

  try {
    // 更新データを準備
    const content = editContentInput.value.trim();
    const tagsRaw = editTagsInput.value.trim();
    const tags = tagsRaw ? tagsRaw.split(",").map(tag => tag.trim().toLowerCase()).filter(tag => tag !== "") : [];
    
    // 基本的な更新データ
    const updateData = {
      content,
      tags,
      isPublic: newIsPublic,
      updatedAt: serverTimestamp()
    };

    // TODO: 段階4で画像更新機能を実装
    // 現在は既存の画像情報を保持
    if (currentEditingMemo.imageUrl) {
      updateData.imageUrl = currentEditingMemo.imageUrl;
      updateData.imageStoragePath = currentEditingMemo.imageStoragePath;
    }

    // ユーザー情報を取得して authorName を更新
    const currentUserProfile = await getUserProfile(currentUID);
    updateData.authorName = currentUserProfile ? currentUserProfile.displayName : '匿名ユーザー';

    // メモを更新
    const memoUpdateSuccess = await updateMemoDocument(currentEditingMemoId, updateData);
    
    if (!memoUpdateSuccess) {
      throw new Error('メモの更新に失敗しました');
    }

    // sharedMemos コレクションと同期
    const syncSuccess = await syncWithSharedMemos(currentEditingMemoId, updateData, newIsPublic);
    
    if (!syncSuccess) {
      console.warn('sharedMemos の同期に失敗しましたが、メモの更新は成功しました');
    }

    // 成功メッセージ
    let successMessage = 'メモが正常に更新されました！';
    if (newIsPublic !== oldIsPublic) {
      successMessage += newIsPublic ? ' (公開されました)' : ' (非公開になりました)';
    }

    editStatusMessage.textContent = successMessage;
    editStatusMessage.style.color = 'green';

    // 2秒後にモーダルを閉じる
    setTimeout(() => {
      closeEditModal();
      statusMessage.textContent = successMessage;
      statusMessage.style.color = 'green';
      setTimeout(() => { statusMessage.textContent = ""; }, 3000);
    }, 2000);

  } catch (error) {
    console.error('メモ更新エラー:', error);
    editStatusMessage.textContent = `更新に失敗しました: ${error.message}`;
    editStatusMessage.style.color = 'red';
  } finally {
    saveEditBtn.disabled = false;
    saveEditBtn.textContent = '💾 変更を保存';
  }
}

// イベントリスナー
saveEditBtn.addEventListener('click', saveEdit);
cancelEditBtn.addEventListener('click', closeEditModal);

// モーダル外クリックで閉じる
editMemoModal.addEventListener('click', (e) => {
  if (e.target === editMemoModal) {
    closeEditModal();
  }
});
