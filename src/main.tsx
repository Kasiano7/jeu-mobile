import '@fontsource/lilita-one/latin-400.css';
import '@fontsource/fredoka/latin-500.css';
import '@fontsource/fredoka/latin-600.css';
import './styles.css';
import { createRoot } from 'react-dom/client';
import { registerSW } from 'virtual:pwa-register';
import { store } from './core/instance';
import { App } from './ui/App';

async function boot() {
  // The bitmap fonts are rasterised from the web font: wait until it is ready.
  try {
    await Promise.race([
      Promise.all([document.fonts.load('64px "Lilita One"'), document.fonts.load('600 20px "Fredoka"')]),
      new Promise((r) => setTimeout(r, 2500)),
    ]);
  } catch {
    /* fall back to system fonts */
  }

  store.startAutosave(5000);
  let hiddenAt = 0;
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') {
      hiddenAt = Date.now();
      store.save();
    } else if (hiddenAt) {
      // The game loop is paused while hidden: grant capped offline gains for that time.
      store.resumeAfter(Date.now() - hiddenAt);
      hiddenAt = 0;
    }
  });
  window.addEventListener('pagehide', () => store.save());

  createRoot(document.getElementById('root')!).render(<App />);
  document.getElementById('boot-splash')?.remove();
  if (import.meta.env.PROD) registerSW({ immediate: true });
}

void boot();
