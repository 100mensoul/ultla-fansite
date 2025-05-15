// このService Workerは登録直後に自らアンレジスターされ、キャッシュを削除します。

self.addEventListener('install', function(event) {
  console.log('[sw.js] install - 即時アクティベート');
  self.skipWaiting();
});

self.addEventListener('activate', function(event) {
  console.log('[sw.js] activate - キャッシュとSW登録を削除します');

  event.waitUntil(
    caches.keys().then(cacheNames => {
      return Promise.all(
        cacheNames.map(cache => caches.delete(cache))
      );
    }).then(() => {
      return self.registration.unregister();
    }).then(() => {
      return self.clients.matchAll();
    }).then(clients => {
      clients.forEach(client => {
        client.navigate(client.url); // 強制リロード
      });
    })
  );
});