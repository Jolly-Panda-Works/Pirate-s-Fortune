import { useEffect, useState } from 'react';

import { go, useStore } from '../store.js';
import { useT, formatNumber } from '../i18n.js';
import { Button, Panel } from '../ui.jsx';
import { createPrivate, gameStore, joinByCode, listRooms, quickMatch } from '../net.js';

export default function Online() {
  const t = useT();
  const [code, setCode] = useState('');
  const [rooms, setRooms] = useState(null);
  const connecting = useStore(gameStore, (s) => s.connection === 'connecting');

  const refresh = async () => setRooms(await listRooms());

  useEffect(() => {
    refresh();
    const id = setInterval(refresh, 4000);
    return () => clearInterval(id);
  }, []);

  return (
    <div className="screen-center">
      <Panel title={t('online.title')} onBack={() => go('menu')} wide>
        <div className="online-grid">
          <section className="online-card">
            <div className="online-card__icon">⚡</div>
            <h3>{t('online.quick')}</h3>
            <p className="muted">{t('online.quickDesc')}</p>
            <Button variant="gold" disabled={connecting} onClick={quickMatch}>{t('online.quick')}</Button>
          </section>
          <section className="online-card">
            <div className="online-card__icon">🔒</div>
            <h3>{t('online.create')}</h3>
            <p className="muted">{t('online.createDesc')}</p>
            <Button disabled={connecting} onClick={createPrivate}>{t('online.create')}</Button>
          </section>
          <section className="online-card">
            <div className="online-card__icon">🔑</div>
            <h3>{t('online.join')}</h3>
            <form
              className="code-form"
              onSubmit={(e) => {
                e.preventDefault();
                if (code.trim()) joinByCode(code);
              }}
            >
              <input
                className="input input--code"
                value={code}
                onChange={(e) => setCode(e.target.value)}
                placeholder={t('online.codePlaceholder')}
                maxLength={16}
                dir="ltr"
              />
              <Button disabled={connecting || !code.trim()} onClick={() => joinByCode(code)}>{t('online.joinBtn')}</Button>
            </form>
          </section>
        </div>

        <div className="room-list">
          <div className="room-list__head">
            <h3 className="label">{t('online.openTables')}</h3>
            <Button variant="ghost" onClick={refresh}>↻ {t('online.refresh')}</Button>
          </div>
          {rooms && rooms.length === 0 && <p className="muted center">{t('online.noTables')}</p>}
          {rooms?.map((r) => (
            <div key={r.roomId} className="room-row">
              <span className="room-row__host">🏴‍☠️ {r.host || '—'}</span>
              <span className="room-row__code" dir="ltr">{r.roomId}</span>
              <span className="room-row__count">{t('online.players', { count: formatNumber(r.clients), max: formatNumber(r.maxClients) })}</span>
              <Button variant="secondary" disabled={connecting} onClick={() => joinByCode(r.roomId)}>{t('online.joinBtn')}</Button>
            </div>
          ))}
        </div>
        {connecting && <p className="muted center">{t('online.connecting')}</p>}
      </Panel>
    </div>
  );
}
