// map.js - マップページ専用JavaScript

/**
 * モーダルを開く
 * @param {string} id - モーダルのID
 */
function openModal(id) {
  const modal = document.getElementById(id);
  if (modal) {
    modal.style.display = 'block';
    document.body.style.overflow = 'hidden'; // スクロール防止
    
    // フォーカスをモーダル内に移動（アクセシビリティ向上）
    const closeButton = modal.querySelector('.close');
    if (closeButton) {
      closeButton.focus();
    }
  }
}

/**
 * モーダルを閉じる
 * @param {string} id - モーダルのID
 */
function closeModal(id) {
  const modal = document.getElementById(id);
  if (modal) {
    modal.style.display = 'none';
    document.body.style.overflow = 'auto'; // スクロール復活
  }
}

/**
 * すべてのモーダルを閉じる
 */
function closeAllModals() {
  const modals = document.querySelectorAll('.modal');
  modals.forEach(modal => {
    if (modal.style.display === 'block') {
      modal.style.display = 'none';
    }
  });
  document.body.style.overflow = 'auto';
}

// DOMが読み込まれた後に実行
document.addEventListener('DOMContentLoaded', function() {
  
  // モーダル外クリックで閉じる
  window.addEventListener('click', function(event) {
    if (event.target.classList.contains('modal')) {
      event.target.style.display = 'none';
      document.body.style.overflow = 'auto';
    }
  });

  // ESCキーでモーダルを閉じる
  document.addEventListener('keydown', function(event) {
    if (event.key === 'Escape') {
      closeAllModals();
    }
  });

  // ピンにキーボードアクセシビリティを追加
  const pins = document.querySelectorAll('.pin');
  pins.forEach((pin, index) => {
    // タブキーでフォーカス可能にする
    pin.setAttribute('tabindex', '0');
    pin.setAttribute('role', 'button');
    pin.setAttribute('aria-label', `地図上のポイント ${index + 1}`);
    
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
  });

  // 閉じるボタンにアクセシビリティ属性を追加
  const closeButtons = document.querySelectorAll('.close');
  closeButtons.forEach(button => {
    button.setAttribute('aria-label', 'モーダルを閉じる');
    button.setAttribute('title', 'モーダルを閉じる（ESCキーでも閉じられます）');
  });

  // リンクボタンにホバー効果を追加（タッチデバイス対応）
  const linkButtons = document.querySelectorAll('.map-link, .photo-link, .video-link');
  linkButtons.forEach(button => {
    button.addEventListener('touchstart', function() {
      this.style.transform = 'translateY(-3px)';
    });
    
    button.addEventListener('touchend', function() {
      setTimeout(() => {
        this.style.transform = '';
      }, 150);
    });
  });

  // 画像の読み込みエラー処理
  const images = document.querySelectorAll('.thumbnail');
  images.forEach(img => {
    img.addEventListener('error', function() {
      this.src = 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMzAwIiBoZWlnaHQ9IjIwMCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48cmVjdCB3aWR0aD0iMTAwJSIgaGVpZ2h0PSIxMDAlIiBmaWxsPSIjZjBmMGYwIi8+PHRleHQgeD0iNTAlIiB5PSI1MCUiIGZvbnQtZmFtaWx5PSJBcmlhbCwgc2Fucy1zZXJpZiIgZm9udC1zaXplPSIxNCIgZmlsbD0iIzk5OSIgdGV4dC1hbmNob3I9Im1pZGRsZSIgZHk9Ii4zZW0iPueUu+WDj+OCkuiqreOBv+i+vOOBvuOBm+OCk+OBp+OBl+OBnw==</text></svg>';
      this.alt = '画像を読み込めませんでした';
    });
  });

  console.log('🗺️ マップページが正常に読み込まれました');
});