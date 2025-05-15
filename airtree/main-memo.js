import { db, storage, auth } from "./firebase.js";
import {
  collection,
  addDoc,
  serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.10.0/firebase-firestore.js";
import {
  ref,
  uploadBytes,
  getDownloadURL
} from "https://www.gstatic.com/firebasejs/10.10.0/firebase-storage.js";

const form = document.getElementById('memo-form');
const photoInput = document.getElementById('photo');
const noteInput = document.getElementById('note');
const tagsInput = document.getElementById('tags');
const isPublicInput = document.getElementById('isPublic');
const resultDiv = document.getElementById('result');

form.addEventListener('submit', async (e) => {
  e.preventDefault();

  const file = photoInput.files[0];
  const note = noteInput.value.trim();
  const tags = tagsInput.value.split(',').map(tag => tag.trim()).filter(Boolean);
  const isPublic = isPublicInput.checked;

  if (!file || !note) {
    alert("写真とメモは必須です。");
    return;
  }

  const user = auth.currentUser;
  if (!user) {
    alert("ユーザー認証に失敗しました。");
    return;
  }

  const fileRef = ref(storage, `memos/${user.uid}/${Date.now()}_${file.name}`);
  const snapshot = await uploadBytes(fileRef, file);
  const imageUrl = await getDownloadURL(snapshot.ref);

  const docRef = await addDoc(collection(db, "sharedMemos"), {
    uid: user.uid,
    content: note,
    tags: tags,
    imageUrl: imageUrl,
    isPublic: isPublic,
    createdAt: serverTimestamp()
  });

  resultDiv.innerHTML = `
    投稿が完了しました！<br>
    シェアURL: <a href="share.html?project=${encodeURIComponent(tags[0])}#${docRef.id}" target="_blank">
      share.html?project=${encodeURIComponent(tags[0])}#${docRef.id}
    </a>
  `;

  form.reset();
});