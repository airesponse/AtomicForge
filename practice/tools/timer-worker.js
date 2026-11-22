self.addEventListener('notificationclick', event => {
  event.notification.close();
  const url = new URL('Timer.html', self.location.href).href;
  event.waitUntil(clients.matchAll({ type: 'window', includeUncontrolled: true }).then(windows => {
    const timer = windows.find(client => client.url.split(/[?#]/)[0] === url);
    return timer ? timer.focus() : clients.openWindow(url);
  }));
});
