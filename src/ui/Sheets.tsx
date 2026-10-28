import { useState, type ReactNode } from 'react';
import { formatMoney, formatMult, formatNumber } from '../core/bignum';
import { CARDS, CARD_IDS, FACTORY, RARITY_LABEL } from '../core/config';
import { levelProgress, offlineParams } from '../core/stats';
import type { CardId } from '../core/types';
import { sfx } from '../game/shared/audio';
import { APP_VERSION, LEGAL } from '../legal';
import { Button } from './Button';
import { useStore } from './hooks';

export function Sheet({ title, onClose, children }: { title: string; onClose: () => void; children: ReactNode }) {
  return (
    <div className="sheet-backdrop" onClick={onClose}>
      <div className="sheet" onClick={(e) => e.stopPropagation()} role="dialog" aria-label={title}>
        <div className="sheet-head">
          <h2>{title}</h2>
          <button type="button" className="icon-btn" aria-label="Fermer" onClick={() => (sfx.play('click'), onClose())}>
            ✕
          </button>
        </div>
        <div className="sheet-body">{children}</div>
      </div>
    </div>
  );
}

/* --------------------------------- Settings -------------------------------- */

export function SettingsSheet({ onClose, onLegal }: { onClose: () => void; onLegal: () => void }) {
  const store = useStore();
  const s = store.state.settings;
  const [confirm, setConfirm] = useState(false);
  const off = offlineParams(store.state);
  const st = store.state.stats;
  const Toggle = ({ k, label }: { k: keyof typeof s; label: string }) => (
    <label className="toggle">
      <span>{label}</span>
      <input
        type="checkbox"
        checked={s[k]}
        onChange={(e) => {
          store.updateSettings({ [k]: e.target.checked });
          sfx.play('click');
        }}
      />
      <i />
    </label>
  );
  return (
    <Sheet title="Réglages" onClose={onClose}>
      <Toggle k="sound" label="🔊 Sons" />
      <Toggle k="haptics" label="📳 Vibrations" />
      <Toggle k="reducedMotion" label="🐢 Animations réduites" />
      <div className="stats-grid">
        <div>
          <b>{formatMoney(store.state.lifetimeEarned)}</b>
          <span>gagnés au total</span>
        </div>
        <div>
          <b>{formatNumber(st.coinsCollected)}</b>
          <span>pièces collectées</span>
        </div>
        <div>
          <b>{formatNumber(st.gateHits)}</b>
          <span>portes traversées</span>
        </div>
        <div>
          <b>{formatNumber(st.itemsProcessed)}</b>
          <span>liasses usinées</span>
        </div>
        <div>
          <b>{Math.round(off.capSeconds / 3600)}h</b>
          <span>plafond hors ligne</span>
        </div>
        <div>
          <b>{Math.round(off.efficiency * 100)}%</b>
          <span>efficacité hors ligne</span>
        </div>
      </div>
      <p className="hint">Sauvegarde automatique toutes les 5 s et à la fermeture.</p>
      <Button
        color={confirm ? 'red' : 'gray'}
        onPress={() => {
          if (!confirm) {
            setConfirm(true);
            return;
          }
          store.reset();
          setConfirm(false);
          onClose();
        }}
      >
        {confirm ? '⚠️ Confirmer la remise à zéro' : 'Recommencer la partie'}
      </Button>
      <button type="button" className="link-btn" onClick={() => (sfx.play('click'), onLegal())}>
        Mentions légales & confidentialité
      </button>
      <p className="credits">
        Money Machine v{APP_VERSION} — aucun achat, aucune publicité, aucune donnée personnelle collectée. La partie est sauvegardée
        uniquement sur cet appareil. Astuce : ajoute le jeu à l'écran d'accueil pour ne jamais perdre ta sauvegarde.
      </p>
    </Sheet>
  );
}

/* --------------------------------- Missions -------------------------------- */

export function MissionsSheet({ onClose }: { onClose: () => void }) {
  const store = useStore();
  const missions = store.activeMissions();
  const lp = levelProgress(store.state);
  return (
    <Sheet title="Missions" onClose={onClose}>
      <div className="level-card">
        <div>
          Niveau <b>{lp.level}</b>
        </div>
        <div className="bar">
          <i style={{ width: `${lp.progress * 100}%` }} />
        </div>
        <small>Prochain niveau à {formatMoney(lp.next)} gagnés • une carte offerte à chaque niveau</small>
      </div>
      {missions.map((m) => {
        const p = m.progress(store.state);
        const done = p >= m.target;
        return (
          <div key={m.id} className={`mission ${done ? 'done' : ''}`}>
            <div className="m-top">
              <span>{m.label}</span>
              <span className="m-reward">
                {formatMoney(store.missionReward(m))}
                {m.reward.card ? ' + 🃏' : ''}
              </span>
            </div>
            <div className="bar">
              <i style={{ width: `${Math.min(1, p / m.target) * 100}%` }} />
            </div>
            <div className="m-bottom">
              <small>
                {formatNumber(Math.min(p, m.target))} / {formatNumber(m.target)}
              </small>
              <Button testId={`claim-${m.id}`} color="gold" disabled={!done} onPress={() => store.claimMission(m.id)}>
                {done ? 'RÉCLAMER' : 'En cours'}
              </Button>
            </div>
          </div>
        );
      })}
    </Sheet>
  );
}

/* ---------------------------------- Cards ---------------------------------- */

export function CardsSheet({ onClose, slot }: { onClose: () => void; slot?: number }) {
  const store = useStore();
  const c = store.state.cards;
  const target = slot !== undefined && slot < c.slotsUnlocked ? slot : undefined;
  const equippedIn = (id: CardId) => c.slots.indexOf(id);
  return (
    <Sheet title={target !== undefined ? `Emplacement ${target + 1}` : 'Collection'} onClose={onClose}>
      <p className="hint">
        Équipe jusqu'à {c.slotsUnlocked} cartes. Les doublons font monter la carte de niveau. Les cartes n'agissent que si elles sont
        placées dans un emplacement.
      </p>
      <div className="card-list">
        {CARD_IDS.map((id) => {
          const def = CARDS[id];
          const lvl = c.owned[id] ?? 0;
          const slotIdx = equippedIn(id);
          return (
            <div key={id} className={`card-row r-${def.rarity} ${lvl ? '' : 'missing'}`}>
              <span className="card-icon">{lvl ? def.icon : '❔'}</span>
              <div className="card-info">
                <b>
                  {def.name} {lvl ? <em>Niv. {lvl}</em> : null}
                </b>
                <small>
                  {RARITY_LABEL[def.rarity]} • {lvl ? def.describe(lvl) : def.describe(1) + ' (niv. 1)'}
                </small>
              </div>
              {lvl > 0 &&
                (slotIdx >= 0 ? (
                  <Button color="gray" onPress={() => store.unequipSlot(slotIdx)}>
                    Retirer
                  </Button>
                ) : (
                  <Button
                    color="mint"
                    onPress={() => {
                      if (target !== undefined && c.slots[target]) store.unequipSlot(target);
                      const ok = store.equipCard(id, target);
                      if (!ok) store.events.emit('toast', { text: 'Emplacements pleins : retire une carte', tone: 'warn' });
                      else if (target !== undefined) onClose();
                      return ok;
                    }}
                  >
                    Équiper
                  </Button>
                ))}
            </div>
          );
        })}
      </div>
    </Sheet>
  );
}

/* ---------------------------------- Wheel ---------------------------------- */

export function WheelSheet({ index, onClose }: { index: number; onClose: () => void }) {
  const store = useStore();
  const lvl = store.state.factory.wheels[index];
  if (lvl === undefined) return null;
  const mult = store.factoryStats.wheelMults[index];
  const maxed = lvl >= FACTORY.wheelMaxLevel;
  const cost = store.wheelUpgradeCost(index);
  const nextMult = mult + FACTORY.wheelMultPerLevel * (mult / (FACTORY.wheelBaseMult + FACTORY.wheelMultPerLevel * lvl));
  return (
    <Sheet title={`Roue n°${index + 1}`} onClose={onClose}>
      <div className="wheel-card">
        <div className="wheel-big">🛞</div>
        <div>
          <div className="wheel-mult">{formatMult(mult)}</div>
          <small>Niveau {lvl} / {FACTORY.wheelMaxLevel}</small>
          <p className="hint">Chaque liasse qui passe sous la presse de cette roue est multipliée.</p>
        </div>
      </div>
      <Button testId="wheel-up" color="mint" repeat disabled={maxed} dim={store.state.money.lt(cost)} onPress={() => store.upgradeWheel(index)}>
        {maxed ? 'NIVEAU MAX' : `Améliorer → ${formatMult(nextMult)} • ${formatMoney(cost)}`}
      </Button>
    </Sheet>
  );
}

/* ---------------------------------- Legal ---------------------------------- */

export function LegalSheet({ onClose }: { onClose: () => void }) {
  return (
    <Sheet title="Mentions légales" onClose={onClose}>
      <div className="legal">
        {LEGAL.publisher && (
          <section>
            <h3>Éditeur</h3>
            <p>{LEGAL.publisher}</p>
            {LEGAL.director && <p>Directeur de la publication : {LEGAL.director}</p>}
            {LEGAL.contact && <p>Contact : {LEGAL.contact}</p>}
          </section>
        )}
        <section>
          <h3>Hébergement</h3>
          <p>{LEGAL.host}</p>
        </section>
        <section>
          <h3>Données personnelles</h3>
          <p>
            Money Machine ne collecte aucune donnée personnelle, n'utilise ni cookie, ni traceur, ni publicité. La progression est
            enregistrée uniquement dans le stockage local de ton navigateur (nécessaire au fonctionnement du jeu) et n'est jamais
            envoyée sur un serveur. Pour l'effacer : Réglages → « Recommencer la partie », ou effacer les données du site.
          </p>
        </section>
        <section>
          <h3>Jeu</h3>
          <p>
            Jeu gratuit, sans argent réel : les montants affichés sont fictifs et ne peuvent être ni achetés, ni échangés, ni retirés.
            Graphismes, sons et code originaux.
          </p>
        </section>
        <p className="credits">Version {APP_VERSION}</p>
      </div>
    </Sheet>
  );
}
