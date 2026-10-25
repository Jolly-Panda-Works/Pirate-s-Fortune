import { useEffect, useRef, useState } from 'react';

import { appStore, go, useStore } from '../store.js';
import { useT, formatNumber } from '../i18n.js';
import { Button, Panel } from '../ui.jsx';
import { gameStore, leaveRoom, send } from '../net.js';
import { gameConfig } from '../data.js';
import { ArenaPicker } from '../pickers.jsx';

export function Chat({ compact = false }) {
  const t = useT();
  const chat = useStore(gameStore, (s) => s.room.chat);
  const [text, setText] = useState('');
  const list = useRef();
  useEffect(() => {
    if (list.current) list.current.scrollTop = list.current.scrollHeight;
  }, [chat]);
  return (
    <div className={`chat ${compact ? 'chat--compact' : ''}`}>
      {!compact && <h3 className="label">💬 {t('lobby.chat')}</h3>}
      <div className="chat__list" ref={list}>
        {chat.map((line, i) => (
          <div key={`${line.at}-${i}`} className="chat__line"><strong>{line.from}:</strong> <span dir="auto">{line.text}</span></div>
        ))}
      </div>
      <form
        className="chat__form"
        onSubmit={(e) => {
          e.preventDefault();
          if (!text.trim()) return;
          send('chat', text);
          setText('');
        }}
      >
        <input className="input" dir="auto" value={text} onChange={(e) => setText(e.target.value)} placeholder={t('lobby.say')} maxLength={160} />
        <Button type="submit" variant="secondary" onClick={() => {}}>{t('lobby.send')}</Button>
      </form>
    </div>
  );
}

export default function Lobby() {
  const t = useT();
  const room = useStore(gameStore, (s) => s.room);
  const [copied, setCopied] = useState(false);
  const locale = useStore(appStore, (s) => s.settings.locale);
  const me = room.seats.find((s) => s.id === room.mySeatId);
  const isHost = Boolean(me?.isHost);
  const { min, max } = gameConfig.players;
  const empty = Math.max(0, max - room.seats.length);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(room.roomId);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // clipboard blocked — the code is still visible
    }
  };

  return (
    <div className="screen-center">
      <Panel title={t('lobby.title')} onBack={() => { leaveRoom(); go('online'); }} wide>
        <div className="lobby">
          <div className="lobby__main">
            <div className="room-code">
              <span className="label">{t('lobby.code')}</span>
              <code dir="ltr">{room.roomId || '…'}</code>
              <Button variant="ghost" onClick={copy}>{copied ? `✓ ${t('lobby.copied')}` : `⧉ ${t('lobby.copy')}`}</Button>
            </div>

            <ul className="seats">
              {room.seats.map((seat) => (
                <li key={seat.id} className={`seat ${seat.id === room.mySeatId ? 'is-me' : ''}`} style={{ '--seat': seat.color }}>
                  <span className="avatar">{seat.avatar}</span>
                  <span className="seat__name">{seat.name}</span>
                  <span className="seat__tags">
                    {seat.isHost && <em className="tag tag--gold">👑 {t('lobby.host')}</em>}
                    {seat.id === room.mySeatId && <em className="tag">{t('lobby.you')}</em>}
                    {seat.isAI && <em className="tag tag--ai">🤖 {t('lobby.ai')}</em>}
                    {!seat.isAI && !seat.connected && <em className="tag tag--bad">{t('lobby.offline')}</em>}
                  </span>
                  {isHost && seat.isAI && (
                    <button type="button" className="seat__remove" onClick={() => send('removeSeat', seat.id)}>✕ {t('lobby.remove')}</button>
                  )}
                </li>
              ))}
              {Array.from({ length: empty }, (_, i) => (
                <li key={`empty-${i}`} className="seat seat--empty">
                  <span className="avatar">·</span>
                  <span className="seat__name muted">{t('lobby.empty')}</span>
                  {isHost && i === 0 && (
                    <button type="button" className="seat__add" onClick={() => send('addBot')}>＋ {t('lobby.addBot')}</button>
                  )}
                </li>
              ))}
            </ul>

            <span className="label">{t('lobby.arena')}</span>
            <ArenaPicker value={room.arena} locale={locale} disabled={!isHost} onChange={(id) => send('setArena', id)} />

            {isHost ? (
              <Button icon="⛵" variant="gold" className="btn--block" disabled={room.seats.length < min} onClick={() => send('start')}>
                {t('lobby.start')}
              </Button>
            ) : (
              <p className="muted center pulse">{t('lobby.waitHost')}</p>
            )}
            {room.seats.length < min && <p className="muted center">{t('lobby.needPlayers', { min: formatNumber(min) })}</p>}
          </div>
          <Chat />
        </div>
      </Panel>
    </div>
  );
}
