// Registers or unregisters the service worker based on env
// In development, we aggressively unregister and clear caches to avoid stale Vite chunks

if ('serviceWorker' in navigator) {
  const url = new URL(window.location.href);
  const noSw = url.searchParams.get('no-sw') === '1';

  if (import.meta.env.PROD && !noSw) {
    window.addEventListener('load', () => {
      navigator.serviceWorker
        .register('/sw.js')
        .then((reg) => {
          console.log('[SW] registered');

          // If there's an updated worker waiting, activate it immediately
          if (reg.waiting) {
            reg.waiting.postMessage({ type: 'SKIP_WAITING' });
          }

          // Watch for updates
          reg.addEventListener('updatefound', () => {
            const newWorker = reg.installing;
            if (!newWorker) return;
            newWorker.addEventListener('statechange', () => {
              if (newWorker.state === 'installed' && reg.waiting) {
                reg.waiting.postMessage({ type: 'SKIP_WAITING' });
              }
            });
          });

          // Reload once the new SW takes control
          let refreshing = false;
          navigator.serviceWorker.addEventListener('controllerchange', () => {
            if (refreshing) return;
            refreshing = true;
            window.location.reload();
          });
        })
        .catch((error) => console.log('[SW] registration failed', error));
    });
  } else {
    // Dev or explicit disable via ?no-sw=1: ensure no SW and clear caches
    navigator.serviceWorker.getRegistrations().then((regs) => {
      regs.forEach((r) => r.unregister());
    });
    if ('caches' in window) {
      caches.keys().then((keys) => Promise.all(keys.map((k) => caches.delete(k))));
    }
    console.log('[SW] Unregistered and caches cleared', import.meta.env.DEV ? '(dev)' : '(no-sw)');
  }
}
