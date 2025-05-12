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

  loadEntries();
});
