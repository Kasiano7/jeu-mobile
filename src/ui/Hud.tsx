import { useEffect, useRef } from 'react';
import { formatMoney, formatDuration } from '../core/bignum';
import { sfx } from '../game/shared/audio';
import { levelProgress } from '../core/stats';
import { useStore, useTicker } from './hooks';

export function TopHud({ onSettings, onMissions }: { onSettings: () => void; onMissions: () => void }) {
  const store = useStore();
  useTicker(1000);
  const wait = store.freeRewardIn();
  const claimable = store.claimableMissions;
  const { level, progress } = levelProgress(store.state);
  const rate = store.measuredRate(5);
  const moneyRef = useRef<HTMLDivElement>(null);

  useEffect(
    () =>
      store.events.on('credit', ({ source }) => {
        if (source === 'drop' || source === 'factory') return;
        const el = moneyRef.current;
        if (!el) return;
        el.classList.remove('bump');
        void el.offsetWidth;
        el.classList.add('bump');
      }),
    [store],
  );

  return (
    <header className="hud">
      <div className="level-badge" title={`Niveau ${level}`} data-testid="level">
        <svg viewBox="0 0 44 44" className="ring">
          <circle cx="22" cy="22" r="19" className="ring-bg" />
          <circle cx="22" cy="22" r="19" className="ring-fg" strokeDasharray={`${progress * 119.4} 119.4`} />
        </svg>
        <span>{level}</span>
      </div>
      <div className="money-box">
        <div className="money" ref={moneyRef} data-testid="money">
          <span className="coin-icon" aria-hidden />
          {formatMoney(store.state.money)}
        </div>
        <div className="rate" data-testid="rate">
          +{formatMoney(rate)}/s
          <BoostChips />
        </div>
      </div>
      <button
        type="button"
        data-testid="gift"
        aria-label="Cadeau gratuit"
        className={`icon-btn gift ${wait <= 0 ? 'ready' : ''}`}
        onClick={() => {
          sfx.unlock();
          const amount = store.claimFreeReward();
          if (amount) {
            sfx.play('level');
            store.events.emit('toast', { text: `🎁 +${formatMoney(amount)} et FRENZY ×2 pendant 30 s !`, tone: 'good' });
          } else {
            sfx.play('deny');
            store.events.emit('toast', { text: `🎁 Prochain cadeau dans ${formatDuration(wait / 1000)}`, tone: 'info' });
          }
        }}
      >
        🎁
        <small>{wait <= 0 ? 'GO!' : formatDuration(wait / 1000)}</small>
      </button>
      <button type="button" data-testid="missions" className="icon-btn" aria-label="Missions" onClick={() => (sfx.play('click'), onMissions())}>
        📋
        {claimable > 0 && <span className="badge">{claimable}</span>}
      </button>
      <button type="button" className="icon-btn" aria-label="Réglages" onClick={() => (sfx.play('click'), onSettings())}>
        ⚙️
      </button>
    </header>
  );
}

function BoostChips() {
  const store = useStore();
  const now = Date.now();
  const b = store.state.boosts;
  return (
    <span className="boosts">
      {b.rushUntil > now && (
        <span className="chip chip-rush">⚡×2 {Math.ceil((b.rushUntil - now) / 1000)}s</span>
      )}
      {b.frenzyUntil > now && (
        <span className="chip chip-frenzy">🎉×2 {Math.ceil((b.frenzyUntil - now) / 1000)}s</span>
      )}
    </span>
  );
}
