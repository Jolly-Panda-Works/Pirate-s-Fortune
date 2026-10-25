import { useState } from 'react';

import { go } from '../store.js';
import { useT, formatNumber } from '../i18n.js';
import { Button, Panel } from '../ui.jsx';
import { gameStore, playSolo } from '../net.js';
import { useStore } from '../store.js';
import { gameConfig } from '../data.js';

const CREW = [
  { name: 'Blackbeard', avatar: '☠️' },
  { name: 'Anne Bonny', avatar: '🦜' },
  { name: 'Calico Jack', avatar: '🦑' },
];

export default function Solo() {
  const t = useT();
  const [rivals, setRivals] = useState(1);
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
              <span className="rival-card__crew">{CREW.slice(0, n).map((c) => c.avatar).join(' ')}</span>
              <span className="rival-card__names">{CREW.slice(0, n).map((c) => c.name).join(', ')}</span>
            </button>
          ))}
        </div>
        <Button icon="⛵" variant="gold" className="btn--block" disabled={connecting} onClick={() => playSolo(rivals)}>
          {connecting ? t('online.connecting') : t('solo.start')}
        </Button>
      </Panel>
    </div>
  );
}
