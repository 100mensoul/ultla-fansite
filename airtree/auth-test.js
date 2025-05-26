// auth-test.js - ログイン機能のテスト用ファイル
import { auth } from './firebase-test.js';
import {
  signInWithPopup,
  GoogleAuthProvider,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signInAnonymously,
  signOut,
  onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js";

// DOM要素の取得
const statusMessage = document.getElementById('statusMessage');
const loginSection = document.getElementById('loginSection');
const userInfo = document.getElementById('userInfo');

const googleLoginBtn = document.getElementById('googleLoginBtn');
const emailToggleBtn = document.getElementById('emailToggleBtn');
const emailForm = document.getElementById('emailForm');
const anonymousLoginBtn = document.getElementById('anonymousLoginBtn');
const logoutBtn = document.getElementById('logoutBtn');

const emailInput = document.getElementById('emailInput');
const passwordInput = document.getElementById('passwordInput');
const loginEmailBtn = document.getElementById('loginEmailBtn');
const registerEmailBtn = document.getElementById('registerEmailBtn');

const userId = document.getElementById('userId');
const authProvider = document.getElementById('authProvider');
const userEmail = document.getElementById('userEmail');
const displayName = document.getElementById('displayName');

// ステータスメッセージを表示する関数
function showStatus(message, type = 'info') {
  statusMessage.textContent = message;
  statusMessage.className = `status-message status-${type}`;
  statusMessage.style.display = 'block';
  
  // 5秒後に自動で非表示
  setTimeout(() => {
    statusMessage.style.display = 'none';
  }, 5000);
}

// ユーザー情報を表示する関数
function displayUserInfo(user) {
  console.log('ログインユーザー:', user);
  
  loginSection.style.display = 'none';
  userInfo.style.display = 'block';
  
  userId.textContent = user.uid;
  userEmail.textContent = user.email || '未設定';
  displayName.textContent = user.displayName || '未設定';
  
  // 認証プロバイダーを判定
  let provider = '不明';
  if (user.isAnonymous) {
    provider = '匿名認証';
  } else if (user.providerData && user.providerData.length > 0) {
    const providerInfo = user.providerData[0];
    switch (providerInfo.providerId) {
      case 'google.com':
        provider = 'Google';
        break;
      case 'password':
        provider = 'メールアドレス';
        break;
      default:
        provider = providerInfo.providerId;
    }
  }
  authProvider.textContent = provider;
  
  showStatus(`${provider}でログインしました！`, 'success');
}

// ログアウト処理
function handleLogout() {
  loginSection.style.display = 'block';
  userInfo.style.display = 'none';
  showStatus('ログアウトしました', 'info');
}

// Googleログイン
async function signInWithGoogle() {
  try {
    showStatus('Googleログイン中...', 'info');
    const provider = new GoogleAuthProvider();
    const result = await signInWithPopup(auth, provider);
    console.log('Googleログイン成功:', result.user);
  } catch (error) {
    console.error('Googleログインエラー:', error);
    showStatus(`Googleログインに失敗しました: ${error.message}`, 'error');
  }
}

// メールアドレスでログイン
async function signInWithEmail() {
  const email = emailInput.value.trim();
  const password = passwordInput.value.trim();
  
  if (!email || !password) {
    showStatus('メールアドレスとパスワードを入力してください', 'error');
    return;
  }
  
  try {
    showStatus('ログイン中...', 'info');
    const result = await signInWithEmailAndPassword(auth, email, password);
    console.log('メールログイン成功:', result.user);
    emailInput.value = '';
    passwordInput.value = '';
  } catch (error) {
    console.error('メールログインエラー:', error);
    let errorMessage = 'ログインに失敗しました';
    
    switch (error.code) {
      case 'auth/user-not-found':
        errorMessage = 'このメールアドレスは登録されていません';
        break;
      case 'auth/wrong-password':
        errorMessage = 'パスワードが間違っています';
        break;
      case 'auth/invalid-email':
        errorMessage = 'メールアドレスの形式が正しくありません';
        break;
      case 'auth/too-many-requests':
        errorMessage = 'ログイン試行回数が多すぎます。しばらく待ってから再試行してください';
        break;
    }
    
    showStatus(errorMessage, 'error');
  }
}

// メールアドレスで新規登録
async function registerWithEmail() {
  const email = emailInput.value.trim();
  const password = passwordInput.value.trim();
  
  if (!email || !password) {
    showStatus('メールアドレスとパスワードを入力してください', 'error');
    return;
  }
  
  if (password.length < 6) {
    showStatus('パスワードは6文字以上で入力してください', 'error');
    return;
  }
  
  try {
    showStatus('新規登録中...', 'info');
    const result = await createUserWithEmailAndPassword(auth, email, password);
    console.log('新規登録成功:', result.user);
    emailInput.value = '';
    passwordInput.value = '';
  } catch (error) {
    console.error('新規登録エラー:', error);
    let errorMessage = '新規登録に失敗しました';
    
    switch (error.code) {
      case 'auth/email-already-in-use':
        errorMessage = 'このメールアドレスは既に使用されています';
        break;
      case 'auth/invalid-email':
        errorMessage = 'メールアドレスの形式が正しくありません';
        break;
      case 'auth/weak-password':
        errorMessage = 'パスワードが弱すぎます。より強力なパスワードを入力してください';
        break;
    }
    
    showStatus(errorMessage, 'error');
  }
}

// 匿名ログイン
async function signInAnonymous() {
  try {
    showStatus('匿名ログイン中...', 'info');
    const result = await signInAnonymously(auth);
    console.log('匿名ログイン成功:', result.user);
  } catch (error) {
    console.error('匿名ログインエラー:', error);
    showStatus(`匿名ログインに失敗しました: ${error.message}`, 'error');
  }
}

// ログアウト
async function logout() {
  try {
    await signOut(auth);
    console.log('ログアウト成功');
  } catch (error) {
    console.error('ログアウトエラー:', error);
    showStatus(`ログアウトに失敗しました: ${error.message}`, 'error');
  }
}

// イベントリスナーの設定
googleLoginBtn.addEventListener('click', signInWithGoogle);

emailToggleBtn.addEventListener('click', () => {
  emailForm.style.display = emailForm.style.display === 'none' ? 'block' : 'none';
});

loginEmailBtn.addEventListener('click', signInWithEmail);
registerEmailBtn.addEventListener('click', registerWithEmail);
anonymousLoginBtn.addEventListener('click', signInAnonymous);
logoutBtn.addEventListener('click', logout);

// Enterキーでログイン
emailInput.addEventListener('keypress', (e) => {
  if (e.key === 'Enter') signInWithEmail();
});
passwordInput.addEventListener('keypress', (e) => {
  if (e.key === 'Enter') signInWithEmail();
});

// 認証状態の監視
onAuthStateChanged(auth, (user) => {
  if (user) {
    displayUserInfo(user);
  } else {
    handleLogout();
  }
});

console.log('認証テストページが読み込まれました');
showStatus('認証テストページが準備できました。ログイン方法を選択してください。', 'info');
