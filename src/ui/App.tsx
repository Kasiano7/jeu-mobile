import { useCallback, useEffect, useRef, useState } from 'react';
import type { GameEvents } from '../core/types';
import { createGame } from '../game';
import { sfx } from '../game/shared/audio';
import { DropPanel } from './DropPanel';
import { FactoryPanel } from './FactoryPanel';
import { useStore, useStoreEvent } from './hooks';
import { TopHud } from './Hud';
import { Celebrations, OfflineModal, TapHint, Toasts } from './Overlays';
import { CardsSheet, MissionsSheet, SettingsSheet, WheelSheet } from './Sheets';

type SheetState = { kind: 'settings' } | { kind: 'missions' } | { kind: 'cards'; slot?: number } | { kind: 'wheel'; index: number } | null;

export function App() {
  const host = useRef<HTMLDivElement>(null);
  const s = useStore();
  const [sheet, setSheet] = useState<SheetState>(null);

  useEffect(() => {
    if (!host.current) return;
    const game = createGame(host.current);
    return () => game.destroy(true);
  }, []);

  useStoreEvent(
    'ui',
    useCallback((e: GameEvents['ui']) => {
      if (e.open === 'wheel') setSheet({ kind: 'wheel', index: e.index });
    }, []),
  );

  // Unlock WebAudio from a real activation gesture (touchend/click, not touch pointerdown on iOS),
  // keep trying until the context runs, and resume it when the app comes back to the foreground.
  useEffect(() => {
    const events = ['touchend', 'click', 'keydown'] as const;
    const unlock = () => {
      sfx.unlock();
      if (sfx.running) events.forEach((e) => window.removeEventListener(e, unlock, true));
    };
    const onVisible = () => {
      if (document.visibilityState === 'visible') {
        sfx.unlock();
        events.forEach((e) => window.addEventListener(e, unlock, true));
      }
    };
    events.forEach((e) => window.addEventListener(e, unlock, true));
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      events.forEach((e) => window.removeEventListener(e, unlock, true));
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, []);

  return (
    <div className={`app mode-${s.mode} ${s.state.settings.reducedMotion ? 'reduced' : ''}`}>
      <TopHud onSettings={() => setSheet({ kind: 'settings' })} onMissions={() => setSheet({ kind: 'missions' })} />
      <main className="stage">
        <div ref={host} className="game-host" data-testid="game" />
        <TapHint />
        <Toasts />
      </main>
      {s.mode === 'drop' ? <DropPanel onOpenCards={(slot) => setSheet({ kind: 'cards', slot })} /> : <FactoryPanel />}
      {sheet?.kind === 'settings' && <SettingsSheet onClose={() => setSheet(null)} />}
      {sheet?.kind === 'missions' && <MissionsSheet onClose={() => setSheet(null)} />}
      {sheet?.kind === 'cards' && <CardsSheet slot={sheet.slot} onClose={() => setSheet(null)} />}
      {sheet?.kind === 'wheel' && <WheelSheet index={sheet.index} onClose={() => setSheet(null)} />}
      <Celebrations />
      <OfflineModal />
      <div className="rotate-hint" aria-hidden>
        <div>📱↻</div>
        <p>Tourne ton téléphone en mode portrait</p>
      </div>
    </div>
  );
}
