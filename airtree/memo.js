// memo.js
import { db, storage, authReady } from './firebase.js';
import {
  collection,
  addDoc,
  serverTimestamp,
  query,
  where,
  orderBy,
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

// フォーム送信処理
memoForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  statusMessage.textContent = "保存処理中です...";
  statusMessage.style.color = "blue";

  if (!currentUID) {
    statusMessage.textContent = "エラー: ユーザー認証が完了していません。ページを再読み込みしてください。";
    statusMessage.style.color = "red";
    try {
        const user = await authReady; // authReadyを再度待つ
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
    console.log("個人メモ保存成功 ID: ", docRef.id);
    if (isPublic) {
      const sharedMemoData = { ...memoData, originalMemoId: docRef.id };
      await addDoc(collection(db, "sharedMemos"), sharedMemoData);
      console.log("共有メモ保存成功");
    }
    statusMessage.textContent = "メモが正常に保存されました！";
    statusMessage.style.color = "green";
    memoForm.reset();
    imageInput.value = "";
    await loadUserMemos();
    setTimeout(() => {
      statusMessage.textContent = "";
    }, 5000);
  } catch (error) {
    console.error("Firestoreへの保存に失敗しました: ", error);
    statusMessage.textContent = "投稿に失敗しました: " + error.message;
    statusMessage.style.color = "red";
  }
});

async function loadUserMemos() {
  if (!currentUID) {
    console.log("ユーザーUIDがまだ利用できません。");
    if (loadingMessage) loadingMessage.textContent = "ユーザー情報を待っています...";
    return;
  }

  if (loadingMessage) loadingMessage.textContent = "投稿を読み込んでいます...";
  if (memoListContainer) {
    memoListContainer.innerHTML = '';
    if (loadingMessage) memoListContainer.appendChild(loadingMessage); // ローディングメッセージを再表示
  }


  try {
    const memosRef = collection(db, "memos");
    const q = query(memosRef, where("uid", "==", currentUID), orderBy("createdAt", "desc"));
    const querySnapshot = await getDocs(q);

    if (querySnapshot.empty) {
      if (loadingMessage) loadingMessage.textContent = "まだ投稿がありません。";
      return;
    }

    if (loadingMessage) loadingMessage.style.display = 'none';

    querySnapshot.forEach((doc) => {
      const memo = doc.data();
      const memoId = doc.id;
      const memoElement = document.createElement('div');
      memoElement.classList.add('memo-item');
      memoElement.setAttribute('data-id', memoId);

      let htmlContent = `<h3>メモ内容:</h3><p>${escapeHTML(memo.content) || '記載なし'}</p>`;
      if (memo.imageUrl) {
        htmlContent += `<h4>写真:</h4><img src="${escapeHTML(memo.imageUrl)}" alt="投稿画像" style="max-width: 200px; max-height: 200px; object-fit: cover;">`;
      }
      if (memo.tags && memo.tags.length > 0) {
        htmlContent += `<h4>タグ:</h4><p>${memo.tags.map(tag => `<span class="tag">${escapeHTML(tag)}</span>`).join(' ')}</p>`;
      }
      htmlContent += `<p><small>公開設定: ${memo.isPublic ? '公開' : '非公開'}</small></p>`;
      if (memo.project) {
          htmlContent += `<p><small>プロジェクト: ${escapeHTML(memo.project)}</small></p>`;
      }
      if (memo.createdAt && memo.createdAt.toDate) {
        const createdAtDate = memo.createdAt.toDate();
        htmlContent += `<p><small>作成日時: ${createdAtDate.toLocaleString('ja-JP')}</small></p>`;
      }
      memoElement.innerHTML = htmlContent;
      if (memoListContainer) memoListContainer.appendChild(memoElement);
    });
  } catch (error) {
    console.error("メモの読み込みに失敗しました:", error);
    if (loadingMessage) {
        loadingMessage.textContent = "メモの読み込みに失敗しました。";
        loadingMessage.style.display = 'block';
    }
  }
}

// 正しい escapeHTML 関数
function escapeHTML(str) {
    if (typeof str !== 'string') return str;
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


authReady.then(async (user) => {
  if (user) {
    currentUID = user.uid;
    await loadUserMemos();
  } else {
    currentUID = null;
    if (memoListContainer) memoListContainer.innerHTML = '<p>ログインしていません。</p>';
    if (loadingMessage) loadingMessage.style.display = 'none';
  }
}).catch(error => {
  console.error("認証処理中にエラー:", error);
  if (memoListContainer) memoListContainer.innerHTML = '<p>認証中にエラーが発生しました。</p>';
  if (loadingMessage) loadingMessage.style.display = 'none';
});
