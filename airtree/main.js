document.addEventListener('DOMContentLoaded', () => {
  const form = document.getElementById('entry-form');
  const photoInput = document.getElementById('photo');
  const noteInput = document.getElementById('note');
  const entriesDiv = document.getElementById('entries');

  form.addEventListener('submit', async (e) => {
    e.preventDefault();

    const file = photoInput.files[0];
    const note = noteInput.value;

    if (!file || !note) {
      alert('写真とメモの両方を入力してください。');
      return;
    }

    const reader = new FileReader();
    reader.onload = async () => {
      const imageData = reader.result;
      await saveEntry(imageData, note);
      noteInput.value = '';
      photoInput.value = '';
      await loadEntries();
    };
    reader.readAsDataURL(file);
  });

  async function loadEntries() {
    entriesDiv.innerHTML = '';
    const entries = await getAllEntries();
    entries.forEach(entry => {
      const div = document.createElement('div');
      div.style.marginBottom = '1em';
      div.innerHTML = `
        <img src="${entry.image}" width="200"><br>
        <p>${entry.note}</p>
      `;
      entriesDiv.appendChild(div);
    });
  }

  // インポート処理
  window.importData = async function () {
    const fileInput = document.getElementById('import-json');
    const file = fileInput.files[0];
    if (!file) {
      alert('JSONファイルを選んでください');
      return;
    }

    const reader = new FileReader();
    reader.onload = async function (e) {
      try {
        const jsonData = JSON.parse(e.target.result);

        if (!Array.isArray(jsonData)) {
          alert('不正な形式です。配列のJSONを読み込んでください。');
          return;
        }

        for (const entry of jsonData) {
          if (entry.image && entry.note) {
            await saveEntry(entry.image, entry.note);
          }
        }

        alert('インポート完了！一覧を更新します。');
        await loadEntries();
      } catch (err) {
        alert('読み込みエラー：' + err.message);
      }
    };
    reader.readAsText(file);
  };

  // エクスポート処理
  window.exportData = async function () {
    const entries = await getAllEntries();
    const json = JSON.stringify(entries, null, 2);
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);

    const a = document.createElement('a');
    a.href = url;
    a.download = 'fieldnote_data.json';
    a.click();

    URL.revokeObjectURL(url);
  };

  loadEntries();
});