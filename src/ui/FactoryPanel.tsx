import { formatMoney, formatMult } from '../core/bignum';
import { FACTORY, FACTORY_UPGRADES } from '../core/config';
import { Button } from './Button';
import { useStore } from './hooks';

export function FactoryPanel() {
  const store = useStore();
  const st = store.state.factory;
  const stats = store.factoryStats;
  const money = store.state.money;
  const speedMax = st.upgrades.speed >= FACTORY_UPGRADES.speed.max;
  const multMax = st.upgrades.multiplier >= FACTORY_UPGRADES.multiplier.max;
  const canAdd = store.canAddWheel;
  const expandCost = store.expandCost;
  const wheelCost = store.wheelCost;

  return (
    <section className="panel factory-panel">
      <div className="fac-info">
        <span>
          ⚙️ Roues <b>{st.wheels.length}/{st.slotsUnlocked}</b>
        </span>
        <span>
          Chaîne <b>{formatMult(stats.totalMult)}</b>
        </span>
        <span>
          ≈ <b>{formatMoney(stats.estimatedIncome)}</b>/s
        </span>
      </div>
      <div className="fac-grid">
        <Button
          testId="fac-speed"
          color="gold"
          className="fac-btn"
          repeat
          dim={money.lt(store.factoryUpgradeCost('speed'))}
          disabled={speedMax}
          onPress={() => store.buyFactoryUpgrade('speed')}
        >
          <span className="fac-title">⚡ SPEED</span>
          <span className="fac-sub">Niv. {st.upgrades.speed} • {stats.beltSpeed.toFixed(0)} px/s</span>
          <span className="fac-cost">{speedMax ? 'MAX' : formatMoney(store.factoryUpgradeCost('speed'))}</span>
        </Button>
        {canAdd || !expandCost ? (
          <Button
            testId="fac-wheel"
            color="mint"
            className="fac-btn"
            dim={!canAdd || money.lt(wheelCost)}
            disabled={!canAdd}
            onPress={() => store.addWheel()}
          >
            <span className="fac-title">🛞 ADD WHEEL</span>
            <span className="fac-sub">
              {canAdd ? `+ roue ${formatMult(FACTORY.wheelBaseMult)}` : 'Usine complète'}
            </span>
            <span className="fac-cost">{canAdd ? formatMoney(wheelCost) : 'MAX'}</span>
          </Button>
        ) : (
          <Button testId="fac-expand" color="purple" className="fac-btn" dim={money.lt(expandCost)} onPress={() => store.expandFactory()}>
            <span className="fac-title">🏗️ EXPAND</span>
            <span className="fac-sub">+2 emplacements</span>
            <span className="fac-cost">{formatMoney(expandCost)}</span>
          </Button>
        )}
        <Button
          testId="fac-mult"
          color="blue"
          className="fac-btn"
          repeat
          dim={money.lt(store.factoryUpgradeCost('multiplier'))}
          disabled={multMax}
          onPress={() => store.buyFactoryUpgrade('multiplier')}
        >
          <span className="fac-title">✖️ MULTIPLIER</span>
          <span className="fac-sub">Niv. {st.upgrades.multiplier} • {formatMoney(stats.itemValue)}</span>
          <span className="fac-cost">{multMax ? 'MAX' : formatMoney(store.factoryUpgradeCost('multiplier'))}</span>
        </Button>
        <Button testId="fac-return" color="red" className="fac-btn" onPress={() => store.setMode('drop')}>
          <span className="fac-title">↩ RETURN</span>
          <span className="fac-sub">Money Drop</span>
        </Button>
      </div>
    </section>
  );
}
