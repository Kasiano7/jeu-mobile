import { useEffect, useState } from 'react';
import { sfx } from '../game/shared/audio';
import { useStore } from './hooks';

const KEY = 'money-machine.install-hint.dismissed';

function isStandalone() {
  return matchMedia('(display-mode: standalone)').matches || (navigator as any).standalone === true;
}

const isIOS = () => /iPhone|iPad|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);

function dismissed() {
  try {
    return localStorage.getItem(KEY) === '1';
  } catch {
    return true;
  }
}

/**
 * Invites the player to install the PWA once they are hooked (level 3+): installed apps
 * are exempt from Safari's 7-day storage eviction, so this protects the save.
 * Android/Chrome gets a real install button; iOS gets the Share-sheet instructions.
 */
export function InstallHint() {
  const store = useStore();
  const [prompt, setPrompt] = useState<any>(null);
  const [hidden, setHidden] = useState(() => isStandalone() || dismissed());

  useEffect(() => {
    const onPrompt = (e: Event) => {
      e.preventDefault();
      setPrompt(e);
    };
    window.addEventListener('beforeinstallprompt', onPrompt);
    return () => window.removeEventListener('beforeinstallprompt', onPrompt);
  }, []);

  if (hidden || store.state.level < 3 || store.mode !== 'drop') return null;
  if (!prompt && !isIOS()) return null;

  const close = () => {
    try {
      localStorage.setItem(KEY, '1');
    } catch {
      /* ignore */
    }
    setHidden(true);
  };

  return (
    <div className="install-hint" role="dialog" aria-label="Installer le jeu">
      <span className="ih-icon">📲</span>
      <span className="ih-text">
        {prompt ? (
          <>Installe Money Machine pour y rejouer en un geste et protéger ta partie.</>
        ) : (
          <>
            Installe le jeu : <b>Partager</b> puis <b>« Sur l'écran d'accueil »</b>. Ta partie sera mieux protégée.
          </>
        )}
      </span>
      {prompt && (
        <button
          type="button"
          className="ih-go"
          onClick={async () => {
            sfx.play('click');
            prompt.prompt();
            await prompt.userChoice.catch(() => null);
            close();
          }}
        >
          Installer
        </button>
      )}
      <button type="button" className="ih-close" aria-label="Fermer" onClick={() => (sfx.play('click'), close())}>
        ✕
      </button>
    </div>
  );
}
