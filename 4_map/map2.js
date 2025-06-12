// map2.js - コーディネートページ専用JavaScript

/**

- モーダルを開く
- @param {string} id - モーダルのID
  */
  function openModal(id) {
  const modal = document.getElementById(id);
  if (modal) {
  modal.style.display = ‘block’;
  document.body.style.overflow = ‘hidden’; // スクロール防止
  
  // フォーカスをモーダル内に移動（アクセシビリティ向上）
  const closeButton = modal.querySelector(’.close’);
  if (closeButton) {
  closeButton.focus();
  }
  }
  }

/**

- モーダルを閉じる
- @param {string} id - モーダルのID
  */
  function closeModal(id) {
  const modal = document.getElementById(id);
  if (modal) {
  modal.style.display = ‘none’;
  document.body.style.overflow = ‘auto’; // スクロール復活
  }
  }

/**

- すべてのモーダルを閉じる
  */
  function closeAllModals() {
  const modals = document.querySelectorAll(’.modal’);
  modals.forEach(modal => {
  if (modal.style.display === ‘block’) {
  modal.style.display = ‘none’;
  }
  });
  document.body.style.overflow = ‘auto’;
  }

/**

- キーパーソン検索・フィルター機能
  */
  class KeyPersonFilter {
  constructor() {
  this.searchInput = document.getElementById(‘searchInput’);
  this.tagFilters = document.querySelectorAll(’.tag-filter’);
  this.groupFilters = document.querySelectorAll(’.group-filter’);
  this.cards = document.querySelectorAll(’.keyperson-card’);
  this.activeTag = ‘all’;
  this.activeGroup = ‘all’;
  this.searchQuery = ‘’;
  
  this.init();
  }

init() {
// 検索入力イベント
if (this.searchInput) {
this.searchInput.addEventListener(‘input’, (e) => {
this.searchQuery = e.target.value.toLowerCase();
this.filterCards();
});
}

```
// タグフィルターイベント
this.tagFilters.forEach(filter => {
  filter.addEventListener('click', (e) => {
    // アクティブタグの更新
    this.tagFilters.forEach(f => f.classList.remove('active'));
    e.target.classList.add('active');
    
    this.activeTag = e.target.dataset.tag;
    this.filterCards();
  });
});

// グループフィルターイベント
this.groupFilters.forEach(filter => {
  filter.addEventListener('click', (e) => {
    // アクティブグループの更新
    this.groupFilters.forEach(f => f.classList.remove('active'));
    e.target.classList.add('active');
    
    this.activeGroup = e.target.dataset.group;
    this.filterCards();
  });
});
```

}

filterCards() {
let visibleCount = 0;

```
this.cards.forEach(card => {
  const cardTags = card.dataset.tags || '';
  const cardGroup = card.dataset.group || '';
  const cardText = card.textContent.toLowerCase();
  
  // タグフィルター
  const tagMatch = this.activeTag === 'all' || cardTags.includes(this.activeTag);
  
  // グループフィルター
  const groupMatch = this.activeGroup === 'all' || cardGroup === this.activeGroup;
  
  // 検索フィルター
  const searchMatch = this.searchQuery === '' || cardText.includes(this.searchQuery);
  
  if (tagMatch && groupMatch && searchMatch) {
    card.classList.remove('hidden');
    card.style.display = 'block';
    visibleCount++;
  } else {
    card.classList.add('hidden');
    card.style.display = 'none';
  }
});

// 検索結果がない場合のメッセージ表示
this.showNoResults(visibleCount === 0);
```

}

showNoResults(show) {
let noResultsMsg = document.querySelector(’.no-results’);

```
if (show && !noResultsMsg) {
  noResultsMsg = document.createElement('div');
  noResultsMsg.className = 'no-results';
  noResultsMsg.innerHTML = '🔍 該当するキーパーソンが見つかりませんでした';
  document.getElementById('keypersonGrid').appendChild(noResultsMsg);
} else if (!show && noResultsMsg) {
  noResultsMsg.remove();
}
```

}
}

// DOMが読み込まれた後に実行
document.addEventListener(‘DOMContentLoaded’, function() {

// モーダル外クリックで閉じる
window.addEventListener(‘click’, function(event) {
if (event.target.classList.contains(‘modal’)) {
event.target.style.display = ‘none’;
document.body.style.overflow = ‘auto’;
}
});

// ESCキーでモーダルを閉じる
document.addEventListener(‘keydown’, function(event) {
if (event.key === ‘Escape’) {
closeAllModals();
}
});

// ピンにキーボードアクセシビリティを追加
const pins = document.querySelectorAll(’.pin’);
pins.forEach((pin, index) => {
// タブキーでフォーカス可能にする
pin.setAttribute(‘tabindex’, ‘0’);
pin.setAttribute(‘role’, ‘button’);
pin.setAttribute(‘aria-label’, `地図上のポイント ${index + 1}`);

```
// エンターキーとスペースキーでも開けるようにする
pin.addEventListener('keydown', function(event) {
  if (event.key === 'Enter' || event.key === ' ') {
    event.preventDefault();
    const onclickAttr = pin.getAttribute('onclick');
    if (onclickAttr) {
      // onclick属性からモーダルIDを抽出
      const match = onclickAttr.match(/openModal\('([^']+)'\)/);
      if (match) {
        openModal(match[1]);
      }
    }
  }
});
```

});

// 閉じるボタンにアクセシビリティ属性を追加
const closeButtons = document.querySelectorAll(’.close’);
closeButtons.forEach(button => {
button.setAttribute(‘aria-label’, ‘モーダルを閉じる’);
button.setAttribute(‘title’, ‘モーダルを閉じる（ESCキーでも閉じられます）’);
});

// リンクボタンにホバー効果を追加（タッチデバイス対応）
const linkButtons = document.querySelectorAll(’.map-link, .photo-link, .video-link’);
linkButtons.forEach(button => {
button.addEventListener(‘touchstart’, function() {
this.style.transform = ‘translateY(-3px)’;
});

```
button.addEventListener('touchend', function() {
  setTimeout(() => {
    this.style.transform = '';
  }, 150);
});
```

});

// 画像の読み込みエラー処理
const images = document.querySelectorAll(’.thumbnail’);
images.forEach(img => {
img.addEventListener(‘error’, function() {
this.src = ‘data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMzAwIiBoZWlnaHQ9IjIwMCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48cmVjdCB3aWR0aD0iMTAwJSIgaGVpZ2h0PSIxMDAlIiBmaWxsPSIjZjBmMGYwIi8+PHRleHQgeD0iNTAlIiB5PSI1MCUiIGZvbnQtZmFtaWx5PSJBcmlhbCwgc2Fucy1zZXJpZiIgZm9udC1zaXplPSIxNCIgZmlsbD0iIzk5OSIgdGV4dC1hbmNob3I9Im1pZGRsZSIgZHk9Ii4zZW0iPueUu+WDj+OCkuiqreOBv+i+vOOBvuOBm+OCk+OBp+OBl+OBnw==</text></svg>’;
this.alt = ‘画像を読み込めませんでした’;
});
});

// キーパーソンフィルター機能を初期化
const keyPersonFilter = new KeyPersonFilter();

console.log(‘🗺️ コーディネートページが正常に読み込まれました’);
});