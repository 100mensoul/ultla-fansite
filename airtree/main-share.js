import { db, auth } from "./firebase.js";
import {
  collection,
  query,
  where,
  orderBy,
  getDocs
} from "https://www.gstatic.com/firebasejs/10.10.0/firebase-firestore.js";

const tagFilterInput = document.getElementById('tag-filter');
const userOnlyToggle = document.getElementById('user-only-toggle');
const entriesDiv = document.getElementById('entries');

let currentUID = null;

// 匿名ログイン完了後に初期ロード
auth.onAuthStateChanged(async (user) => {
  if (user) {
    currentUID = user.uid;
    const urlParams = new URLSearchParams(window.location.search);
    const tagParam = urlParams.get("project");
    if (tagParam) {
      tagFilterInput.value = tagParam;
    }
    await loadEntries();
  }
});

tagFilterInput.addEventListener('input', loadEntries);
userOnlyToggle.addEventListener('change', loadEntries);

async function loadEntries() {
  entriesDiv.innerHTML = '';
  const tag = tagFilterInput.value.trim();
  const userOnly = userOnlyToggle.checked;

  let q = collection(db, "sharedMemos");
  const conditions = [where("isPublic", "==", true)];

  if (tag) {
    conditions.push(where("tags", "array-contains", tag));
  }
  if (userOnly && currentUID) {
    conditions.push(where("uid", "==", currentUID));
  }

  q = query(q, ...conditions, orderBy("createdAt", "desc"));

  try {
    const querySnapshot = await getDocs(q);
    if (querySnapshot.empty) {
      entriesDiv.innerHTML = "<p>投稿がありません</p>";
      return;
    }

    querySnapshot.forEach((doc) => {
      const data = doc.data();
      const div = document.createElement('div');
      div.innerHTML = `
        <img src="${data.imageUrl}" width="200"><br>
        <strong>${data.content}</strong><br>
        <small>タグ: ${data.tags.join(", ")}</small><br><br>
      `;
      entriesDiv.appendChild(div);
    });
  } catch (err) {
    entriesDiv.innerHTML = `<p>読み込みエラー: ${err.message}</p>`;
  }
}