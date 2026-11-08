import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import '@fontsource/nunito/400.css';
import '@fontsource/nunito/600.css';
import '@fontsource/nunito/700.css';
import '@fontsource/caveat/500.css';
import './styles.css';
import App from './App';

// Yeni sürüm: uygulama her öne geldiğinde kontrol et; yeni sürüm devreye
// girince sayfayı bir kez yenile (ana ekrana eklenmiş uygulamada da güncel kalsın)
if ('serviceWorker' in navigator) {
  const check = () => navigator.serviceWorker.getRegistration().then((r) => r?.update()).catch(() => undefined);
  document.addEventListener('visibilitychange', () => document.visibilityState === 'visible' && check());
  let reloaded = false;
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (reloaded || !navigator.serviceWorker.controller) return;
    reloaded = true;
    location.reload();
  });
}

// Tarayıcıdan kalıcı depolama izni iste (verilerin kendiliğinden silinmemesi için).
navigator.storage?.persist?.().catch(() => undefined);

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
