import { useState } from 'react';
import { formatMoney } from '../core/bignum';
import { CARDS, FACTORY } from '../core/config';
import { sfx } from '../game/shared/audio';
import { Button } from './Button';
import { useStore } from './hooks';
import { dropUpgradeViews } from './views';

export function DropPanel({ onOpenCards }: { onOpenCards: (slot?: number) => void }) {
  const [tab, setTab] = useState<'up' | 'cards'>('up');
  const store = useStore();
  return (
    <section className="panel">
      <div className="tabs">
        <button type="button" className={tab === 'up' ? 'on' : ''} onClick={() => (sfx.play('click'), setTab('up'))}>
          Améliorations
        </button>
        <button type="button" className={tab === 'cards' ? 'on' : ''} onClick={() => (sfx.play('click'), setTab('cards'))} data-testid="tab-cards">
          Cartes <span className="count">{store.state.cards.slots.filter(Boolean).length}/{store.state.cards.slotsUnlocked}</span>
        </button>
        <button
          type="button"
          data-testid="to-factory"
          className={`tab-factory ${store.factoryUnlocked ? 'ready' : 'locked'}`}
          onClick={() => {
            sfx.unlock();
            sfx.play('click');
            store.setMode('factory');
          }}
        >
          {store.factoryUnlocked ? '🏭 Factory' : `🔒 Niv. ${FACTORY.unlockLevel}`}
        </button>
      </div>
      {tab === 'up' ? <Upgrades /> : <CardSlots onOpen={onOpenCards} />}
    </section>
  );
}

function Upgrades() {
  const store = useStore();
  const views = dropUpgradeViews(store);
  const next = store.nextBoard();
  const money = store.state.money;
  return (
    <div className="upgrades">
      <div className="up-grid">
        {views.map((v) => (
          <Button
            key={v.id}
            testId={`up-${v.id}`}
            className="up-btn"
            color={v.id === 'dropper' || v.id === 'obstacles' ? 'gold' : 'mint'}
            dim={!v.affordable}
            disabled={v.maxed || !!v.locked}
            repeat
            onPress={() => store.buyDropUpgrade(v.id as any)}
          >
            <span className="up-icon">{v.icon}</span>
            <span className="up-body">
              <span className="up-name">
                {v.label} <em>{v.level}</em>
              </span>
              <span className="up-val">
                {v.current} <i>›</i> {v.next}
              </span>
              <span className="up-cost">{v.locked ? `🔒 ${v.locked}` : v.maxed ? 'MAX' : formatMoney(v.cost)}</span>
            </span>
          </Button>
        ))}
      </div>
      {next ? (
        <Button testId="next-board" className="board-btn" color="purple" dim={money.lt(next.cost)} onPress={() => store.buyNextBoard()}>
          <span className="board-progress" style={{ width: `${Math.min(100, money.div(next.cost).toNumber() * 100)}%` }} />
          <span className="board-txt">
            🌟 {next.name} <b>×{next.mult}</b>
          </span>
          <span className="board-cost">{formatMoney(next.cost)}</span>
        </Button>
      ) : (
        <div className="board-done">🏆 Tous les plateaux sont débloqués !</div>
      )}
    </div>
  );
}

function CardSlots({ onOpen }: { onOpen: (slot?: number) => void }) {
  const store = useStore();
  const c = store.state.cards;
  const slotCost = store.cardSlotCost;
  return (
    <div className="cards-tab">
      <div className="slot-grid">
        {c.slots.map((id, i) => {
          if (i >= c.slotsUnlocked) {
            const isNext = i === c.slotsUnlocked && slotCost;
            return (
              <button
                type="button"
                key={i}
                className={`slot locked ${isNext && store.state.money.gte(slotCost!) ? 'can' : ''}`}
                onClick={() => {
                  if (!isNext) return;
                  if (store.buyCardSlot()) sfx.play('buy');
                  else sfx.play('deny');
                }}
              >
                🔒 {isNext ? formatMoney(slotCost!) : ''}
              </button>
            );
          }
          if (!id)
            return (
              <button type="button" key={i} className="slot empty" onClick={() => onOpen(i)}>
                + Carte
              </button>
            );
          const def = CARDS[id];
          return (
            <button type="button" key={i} className={`slot card r-${def.rarity}`} onClick={() => onOpen(i)}>
              <span className="slot-icon">{def.icon}</span>
              <span className="slot-name">{def.name}</span>
              <span className="slot-lvl">Niv. {c.owned[id]}</span>
            </button>
          );
        })}
      </div>
      <div className="card-actions">
        <Button
          testId="buy-pack"
          color="pink"
          disabled={store.collectionComplete}
          dim={store.state.money.lt(store.packCost)}
          onPress={() => store.buyPack() !== null}
        >
          {store.collectionComplete ? (
            '🏆 Collection complète'
          ) : (
            <>
              📦 Paquet <b>{formatMoney(store.packCost)}</b>
            </>
          )}
        </Button>
        <Button color="blue" onPress={() => onOpen()}>
          📚 Collection
        </Button>
      </div>
    </div>
  );
}
