// memo.js
import { db, storage, authReady } from './firebase.js';
import {
  collection,
  addDoc,
  serverTimestamp,
  query, // クエリ用
  where, // where句用
  orderBy, // orderBy句用
  getDocs, // ドキュメント一括取得用
  onSnapshot // リアルタイム更新用 (今回はまずgetDocsで実装)
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";
import {
  ref,
  uploadBytes,
  getDownloadURL
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-storage.js";

// DOM要素の取得 (既存)
const memoForm = document.getElementById("memoForm");
const imageInput = document.getElementById("imageInput");
const contentInput = document.getElementById("contentInput");
const tagsInput = document.getElementById("tagsInput");
const isPublicCheckbox = document.getElementById("isPublicCheckbox");
const statusMessage = document.getElementById("statusMessage");

// 新しく追加: 一覧表示用コンテナとローディングメッセージ
const memoListContainer = document.getElementById("memoListContainer");
const loadingMessage = document.getElementById("loadingMessage");

let currentUID = null; // currentUIDをグローバルスコープ（またはモジュールスコープ）で保持

// フォーム送信処理 (既存のコードをここに配置)
memoForm.addEventListener("submit", async (e) => {
  // ... (既存のフォーム送信処理はそのまま)
  // ... (保存成功後に一覧を再読み込みする処理を追加すると良い)
    // 保存成功後
    // ... (既存の statusMessage, memoForm.reset() など)
    await loadUserMemos(); // ★ 保存後に一覧を再読み込み
  // ...
});


// ユーザーのメモを読み込んで表示する関数
async function loadUserMemos() {
  if (!currentUID) {
    console.log("ユーザーUIDがまだ利用できません。");
    loadingMessage.textContent = "ユーザー情報を待っています...";
    return;
  }

  loadingMessage.textContent = "投稿を読み込んでいます...";
  memoListContainer.innerHTML = ''; // 一旦コンテナを空にする（ローディングメッセージも消える）
  memoListContainer.appendChild(loadingMessage); // ローディングメッセージを再表示

  try {
    const memosRef = collection(db, "memos");
    // 自分のUIDに一致し、作成日時の降順で取得するクエリ
    const q = query(memosRef, where("uid", "==", currentUID), orderBy("createdAt", "desc"));

    const querySnapshot = await getDocs(q);

    if (querySnapshot.empty) {
      loadingMessage.textContent = "まだ投稿がありません。";
      return;
    }

    loadingMessage.style.display = 'none'; // 投稿があるのでローディングメッセージを非表示

    querySnapshot.forEach((doc) => {
      const memo = doc.data();
      const memoId = doc.id; // ドキュメントIDも取得しておく (将来の編集/削除用)

      // メモ表示用のHTML要素を作成
      const memoElement = document.createElement('div');
      memoElement.classList.add('memo-item'); // CSSでスタイルを当てるためのクラス
      memoElement.setAttribute('data-id', memoId); // data属性にIDを保持

      let htmlContent = `
        <h3>メモ内容:</h3>
        <p>${escapeHTML(memo.content) || '記載なし'}</p>
      `;

      if (memo.imageUrl) {
        htmlContent += `
          <h4>写真:</h4>
          <img src="${escapeHTML(memo.imageUrl)}" alt="投稿画像" style="max-width: 200px; max-height: 200px; object-fit: cover;">
        `;
      }

      if (memo.tags && memo.tags.length > 0) {
        htmlContent += `
          <h4>タグ:</h4>
          <p>${memo.tags.map(tag => `<span class="tag">${escapeHTML(tag)}</span>`).join(' ')}</p>
        `;
      }

      htmlContent += `<p><small>公開設定: ${memo.isPublic ? '公開' : '非公開'}</small></p>`;
      // プロジェクト名も表示 (仕様に合わせて)
      if (memo.project) {
          htmlContent += `<p><small>プロジェクト: ${escapeHTML(memo.project)}</small></p>`;
      }
      // 作成日時 (FirestoreのTimestampオブジェクトをDateオブジェクトに変換してフォーマット)
      if (memo.createdAt && memo.createdAt.toDate) {
        const createdAtDate = memo.createdAt.toDate();
        htmlContent += `<p><small>作成日時: ${createdAtDate.toLocaleString('ja-JP')}</small></p>`;
      }

      memoElement.innerHTML = htmlContent;
      memoListContainer.appendChild(memoElement);
    });

  } catch (error) {
    console.error("メモの読み込みに失敗しました:", error);
    loadingMessage.textContent = "メモの読み込みに失敗しました。";
    loadingMessage.style.display = 'block';
  }
}

// HTMLエスケープ関数 (XSS対策)
function escapeHTML(str) {
    if (typeof str !== 'string') return str;
    return str.replace(/[&<>"']/g, function(match) {
        return {
            '&': '&',
            '<': '<',
            '>': '>',
            '"': '"',
            "'": '''
        }[match];
    });
}


// 認証状態が変更されたら、または初期認証後に処理を開始
authReady.then(async (user) => {
  if (user) {
    currentUID = user.uid; // currentUID を設定
    await loadUserMemos(); // ユーザーのメモを読み込む
  } else {
    // ユーザーがいない場合の処理 (通常は匿名認証で必ずユーザーはいるはず)
    currentUID = null;
    memoListContainer.innerHTML = '<p>ログインしていません。</p>';
    loadingMessage.style.display = 'none';
  }
}).catch(error => {
  console.error("認証処理中にエラー:", error);
  memoListContainer.innerHTML = '<p>認証中にエラーが発生しました。</p>';
  loadingMessage.style.display = 'none';
});
