import { useState } from 'react';

import { appStore, go, useStore } from '../store.js';
import { useT, formatNumber } from '../i18n.js';
import { Button, Panel } from '../ui.jsx';
import { gameStore, playSolo } from '../net.js';
import { gameConfig } from '../data.js';
import { ArenaPicker } from '../pickers.jsx';
import { DEFAULT_ARENA } from '../../../shared/roster.js';

export default function Solo() {
  const t = useT();
  const [rivals, setRivals] = useState(1);
  const [arena, setArena] = useState(DEFAULT_ARENA);
  const locale = useStore(appStore, (s) => s.settings.locale);
  const connecting = useStore(gameStore, (s) => s.connection === 'connecting');
  const max = gameConfig.players.max - 1;

  return (
    <div className="screen-center">
      <Panel title={t('solo.title')} onBack={() => go('menu')}>
        <p className="muted">{t('solo.desc')}</p>
        <h3 className="label">{t('solo.rivals')}</h3>
        <div className="rival-picker">
          {Array.from({ length: max }, (_, i) => i + 1).map((n) => (
            <button
              type="button"
              key={n}
              className={`rival-card ${rivals === n ? 'is-active' : ''}`}
              onClick={() => setRivals(n)}
            >
              <span className="rival-card__count">{formatNumber(n)}</span>
              <span className="rival-card__crew">{'🤖 '.repeat(n).trim()}</span>
            </button>
          ))}
        </div>
        <h3 className="label">{t('solo.arena')}</h3>
        <ArenaPicker value={arena} onChange={setArena} locale={locale} />
        <Button icon="⛵" variant="gold" className="btn--block" disabled={connecting} onClick={() => playSolo(rivals, arena)}>
          {connecting ? t('online.connecting') : t('solo.start')}
        </Button>
      </Panel>
    </div>
  );
}
