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

  // Unlock WebAudio on the very first gesture (iOS requirement).
  useEffect(() => {
    const unlock = () => sfx.unlock();
    window.addEventListener('pointerdown', unlock, { once: true });
    return () => window.removeEventListener('pointerdown', unlock);
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
    </div>
  );
}
