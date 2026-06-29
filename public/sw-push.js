// Listener para o evento de Push do Sistema Operacional
self.addEventListener('push', (event) => {
  console.log('[Service Worker] Push recebido:', event);

  let data = {};
  if (event.data) {
    try {
      data = event.data.json();
    } catch (e) {
      data = { title: 'Nova notificação', body: event.data.text() };
    }
  }

  const title = data.title || 'Occasio Imob';
  const options = {
    body: data.body || 'Você recebeu uma nova atualização.',
    icon: '/favicon.png', // Símbolo da logo como ícone da notificação
    badge: '/favicon.png', // Badge para barra de status (Android)
    data: data.data || {}, // Dados adicionais, como a URL de destino
    vibrate: [100, 50, 100],
    actions: [
      { action: 'open', title: 'Ver detalhes' }
    ]
  };

  event.waitUntil(
    self.registration.showNotification(title, options)
  );
});

// Listener para clique na notificação
self.addEventListener('notificationclick', (event) => {
  console.log('[Service Worker] Notificação clicada:', event);
  event.notification.close();

  // Define a URL padrão ou a URL enviada no payload de dados
  let urlToOpen = '/';
  if (event.notification.data && event.notification.data.url) {
    urlToOpen = event.notification.data.url;
  }

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((windowClients) => {
      // Se já houver uma janela do app aberta, foca nela e navega para o link correto
      for (let i = 0; i < windowClients.length; i++) {
        const client = windowClients[i];
        if (client.url.includes(self.location.origin) && 'focus' in client) {
          if (urlToOpen !== '/') {
            client.navigate(urlToOpen);
          }
          return client.focus();
        }
      }
      // Se não houver janelas abertas, abre uma nova aba/janela no link fornecido
      if (clients.openWindow) {
        return clients.openWindow(urlToOpen);
      }
    })
  );
});
