import { useCallback, useEffect, useRef, useState } from 'react';
import { formatDuration, formatMoney } from '../core/bignum';
import { CARDS, FACTORY, RARITY_LABEL } from '../core/config';
import type { CardId, GameEvents } from '../core/types';
import { sfx } from '../game/shared/audio';
import { Button } from './Button';
import { useStore, useStoreEvent } from './hooks';

/* --------------------------------- Toasts ---------------------------------- */

interface ToastItem {
  id: number;
  text: string;
  tone: string;
}

export function Toasts() {
  const [items, setItems] = useState<ToastItem[]>([]);
  const nextId = useRef(1);
  useStoreEvent(
    'toast',
    useCallback((t: GameEvents['toast']) => {
      const id = nextId.current++;
      setItems((list) => [...list.slice(-2), { id, text: t.text, tone: t.tone ?? 'info' }]);
      setTimeout(() => setItems((list) => list.filter((x) => x.id !== id)), 2600);
    }, []),
  );
  return (
    <div className="toasts" aria-live="polite">
      {items.map((t) => (
        <div key={t.id} className={`toast t-${t.tone}`}>
          {t.text}
        </div>
      ))}
    </div>
  );
}

/* ------------------------- Level up & card reveals ------------------------- */

type Reveal =
  | { kind: 'level'; level: number; money: GameEvents['levelUp']['money']; card: CardId | null }
  | { kind: 'card'; id: CardId; level: number; isNew: boolean };

export function Celebrations() {
  const store = useStore();
  const [queue, setQueue] = useState<Reveal[]>([]);

  useStoreEvent(
    'levelUp',
    useCallback((e: GameEvents['levelUp']) => {
      sfx.play('level');
      setQueue((q) => [...q.filter((x) => x.kind !== 'level'), { kind: 'level', level: e.level, money: e.money, card: e.card }]);
    }, []),
  );
  useStoreEvent(
    'cardGained',
    useCallback((e: GameEvents['cardGained']) => {
      sfx.play('orb');
      setQueue((q) => [...q, { kind: 'card' as const, id: e.id, level: e.level, isNew: e.isNew }].slice(-4));
    }, []),
  );

  const cur = queue[0];
  useEffect(() => {
    if (!cur) return;
    const t = setTimeout(() => setQueue((q) => q.slice(1)), cur.kind === 'level' ? 3200 : 2600);
    return () => clearTimeout(t);
  }, [cur]);

  if (!cur) return null;
  const dismiss = () => setQueue((q) => q.slice(1));
  if (cur.kind === 'level') {
    const def = cur.card ? CARDS[cur.card] : null;
    return (
      <div className="celebrate" onClick={dismiss}>
        <div className="burst" />
        <div className="celebrate-card">
          <div className="lvl-title">NIVEAU {cur.level} !</div>
          <div className="lvl-reward">+{formatMoney(cur.money)}</div>
          {def && (
            <div className={`mini-card r-${def.rarity}`}>
              {def.icon} {def.name} <em>Niv. {store.state.cards.owned[def.id]}</em>
            </div>
          )}
          {cur.level === FACTORY.unlockLevel && <div className="unlock-note">🏭 Money Factory débloquée !</div>}
        </div>
      </div>
    );
  }
  const def = CARDS[cur.id];
  return (
    <div className="celebrate" onClick={dismiss}>
      <div className="burst" />
      <div className={`reveal-card r-${def.rarity}`}>
        <div className="rc-badge">{cur.isNew ? 'NOUVELLE CARTE !' : `CARTE NIV. ${cur.level}`}</div>
        <div className="rc-icon">{def.icon}</div>
        <div className="rc-name">{def.name}</div>
        <div className="rc-rarity">{RARITY_LABEL[def.rarity]}</div>
        <div className="rc-desc">{def.describe(cur.level)}</div>
      </div>
    </div>
  );
}

/* --------------------------------- Offline --------------------------------- */

export function OfflineModal() {
  const store = useStore();
  const report = store.pendingOffline;
  if (!report) return null;
  return (
    <div className="celebrate modal">
      <div className="celebrate-card offline">
        <div className="lvl-title">Bon retour !</div>
        <p>
          Pendant ton absence ({formatDuration(report.seconds)}), tes machines ont produit&nbsp;:
        </p>
        <div className="lvl-reward">+{formatMoney(report.amount)}</div>
        <Button testId="collect-offline" color="gold" onPress={() => (store.collectOffline(), true)}>
          COLLECTER
        </Button>
      </div>
    </div>
  );
}

export function TapHint() {
  const store = useStore();
  const s = store.state.stats;
  if (store.mode !== 'drop' || s.taps >= 3 || s.coinsCollected > 60) return null;
  return <div className="tap-hint">👆 Touche le plateau pour lâcher des pièces !</div>;
}
