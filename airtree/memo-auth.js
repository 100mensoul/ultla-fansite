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
  getDocs
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
const checkUsernameBtn = document.getElementById('checkUsernameBtn');
const saveUsernameBtn = document.getElementById('saveUsernameBtn');
const cancelUsernameBtn = document.getElementById('cancelUsernameBtn');
const usernameError = document.getElementById('usernameError');
const usernameSuccess = document.getElementById('usernameSuccess');

let usernameAvailable = false;

function showError(message) {
  usernameError.textContent = message;
  usernameError.style.display = 'block';
  usernameSuccess.style.display = 'none';
  saveUsernameBtn.disabled = true;
  usernameAvailable = false;
}

function showSuccess(message) {
  usernameSuccess.textContent = message;
  usernameSuccess.style.display = 'block';
  usernameError.style.display = 'none';
  saveUsernameBtn.disabled = false;
  usernameAvailable = true;
}

function clearMessages() {
  usernameError.style.display = 'none';
  usernameSuccess.style.display = 'none';
  saveUsernameBtn.disabled = true;
  usernameAvailable = false;
}

async function checkUsername() {
  const username = usernameInput.value.trim();
  
  if (!username) {
    showError('ユーザーネームを入力してください');
    return;
  }
  
  if (username.length < 3) {
    showError('ユーザーネームは3文字以上で入力してください');
    return;
  }
  
  if (username.length > 20) {
    showError('ユーザーネームは20文字以下で入力してください');
    return;
  }
  
  checkUsernameBtn.disabled = true;
  checkUsernameBtn.textContent = 'チェック中...';
  
  try {
    const exists = await checkUsernameExists(username, currentUID);
    
    if (exists) {
      showError('このユーザーネームは既に使用されています');
    } else {
      showSuccess('このユーザーネームは使用できます！');
    }
  } catch (error) {
    showError('チェック中にエラーが発生しました');
    console.error('ユーザーネームチェックエラー:', error);
  } finally {
    checkUsernameBtn.disabled = false;
    checkUsernameBtn.textContent = '重複チェック';
  }
}

async function saveProfile() {
  if (!usernameAvailable) {
    showError('まず重複チェックを行ってください');
    return;
  }
  
  const username = usernameInput.value.trim();
  const displayName = displayNameInput.value.trim();
  
  saveUsernameBtn.disabled = true;
  saveUsernameBtn.textContent = '保存中...';
  
  try {
    const success = await updateUserProfile(currentUID, username, displayName);
    
    if (success) {
      userProfile = await getUserProfile(currentUID);
      closeModal();
      statusMessage.textContent = 'ユーザーネームが設定されました！公開投稿を続けることができます。';
      statusMessage.style.color = 'green';
      setTimeout(() => { statusMessage.textContent = ""; }, 5000);
    } else {
      showError('設定に失敗しました。もう一度お試しください。');
    }
  } catch (error) {
    showError('設定中にエラーが発生しました');
    console.error('プロフィール保存エラー:', error);
  } finally {
    saveUsernameBtn.disabled = false;
    saveUsernameBtn.textContent = '設定完了';
  }
}

function openUsernameModal(uid) {
  currentUID = uid;
  usernameModal.style.display = 'block';
  usernameInput.focus();
  clearMessages();
}

function closeModal() {
  usernameModal.style.display = 'none';
  usernameInput.value = '';
  displayNameInput.value = '';
  clearMessages();
}

// イベントリスナー
checkUsernameBtn.addEventListener('click', checkUsername);
saveUsernameBtn.addEventListener('click', saveProfile);
cancelUsernameBtn.addEventListener('click', closeModal);
usernameInput.addEventListener('input', clearMessages);
usernameInput.addEventListener('keypress', (e) => {
  if (e.key === 'Enter') checkUsername();
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
