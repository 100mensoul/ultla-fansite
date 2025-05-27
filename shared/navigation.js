// shared/navigation.js
document.addEventListener('DOMContentLoaded', function() {
  // 現在のパスを取得
  const currentPath = window.location.pathname;
  
  // ナビゲーションリンクをすべて取得
  const navLinks = document.querySelectorAll('nav a');
  
  // 各リンクをチェックして、現在のページと一致するものにcurrentクラスを追加
  navLinks.forEach(link => {
    // リンクのhref属性から最後の部分を取得
    const linkPath = new URL(link.href).pathname;
    
    // 現在のパスとリンクのパスが一致する場合
    if (currentPath === linkPath || 
        (currentPath.endsWith('/') && currentPath.slice(0, -1) === linkPath) ||
        (linkPath.endsWith('/index.html') && currentPath.includes(linkPath.replace('/index.html', '')))) {
      link.classList.add('current');
    }
  });
});
