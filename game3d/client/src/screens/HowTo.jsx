import { appStore, go, useStore } from '../store.js';
import { useT, formatNumber } from '../i18n.js';
import { Panel } from '../ui.jsx';
import { cardDefinitions, TYPE_ORDER, TYPE_STYLE } from '../data.js';

function valueRange(type) {
  const values = cardDefinitions.filter((d) => d.type === type).map((d) => d.value);
  return `${formatNumber(Math.min(...values))}–${formatNumber(Math.max(...values))}`;
}

export function HowToBody() {
  const t = useT();
  return (
    <div className="howto">
      <section className="howto__rules">
        {[['goalT', 'goal', '🎯'], ['turnT', 'turn', '⛵'], ['wreckT', 'wreck', '💥'], ['tieT', 'tie', '⚖️'], ['controlsT', 'controls', '🖱️']].map(([title, body, icon]) => (
          <article key={title} className="rule">
            <h3>{icon} {t(`howTo.${title}`)}</h3>
            <p>{t(`howTo.${body}`)}</p>
          </article>
        ))}
      </section>
      <section>
        <h3 className="label">✦ {t('howTo.abilitiesT')}</h3>
        <div className="card-catalog">
          {TYPE_ORDER.map((type) => (
            <div key={type} className="catalog-card" style={{ '--type': TYPE_STYLE[type].color }}>
              <span className="catalog-card__icon">{TYPE_STYLE[type].icon}</span>
              <div>
                <strong>{t(`cardTypes.${type}`)} <small dir="ltr">({valueRange(type)})</small></strong>
                <p>{t(`howTo.abilities.${type}`)}</p>
              </div>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}

export default function HowTo() {
  const t = useT();
  const returnTo = useStore(appStore, (s) => s.returnTo);
  return (
    <div className="screen-center">
      <Panel title={t('howTo.title')} onBack={() => go(returnTo || 'menu')} wide>
        <HowToBody />
      </Panel>
    </div>
  );
}
