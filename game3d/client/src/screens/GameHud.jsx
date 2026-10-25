/**
 * In-game HUD over the 3D table: turn banner, scoreboard, the two core
 * decisions, ability-target sheet, Compass preview, pause menu,
 * reconnect overlay and the end-of-voyage results.
 */

import { useEffect, useMemo, useState } from 'react';

import { go, setSave, useStore } from '../store.js';
import { useT, formatNumber, cardTypeName } from '../i18n.js';
import { Button, Confirm } from '../ui.jsx';
import { gameStore, leaveRoom, send, skipReplay } from '../net.js';
import { defOf, scoreIfReturned, scoreOf, TYPE_STYLE } from '../data.js';
import { SettingsBody } from './Settings.jsx';
import { HowToBody } from './HowTo.jsx';
import { Chat } from './Lobby.jsx';

export function MiniCard({ defId, onClick, small }) {
  const def = defOf(defId);
  const style = TYPE_STYLE[def?.type] ?? {};
  const Tag = onClick ? 'button' : 'div';
  return (
    <Tag type={onClick ? 'button' : undefined} className={`mini-card ${small ? 'mini-card--small' : ''}`} style={{ '--type': style.color, '--type-dark': style.dark }} onClick={onClick}>
      <span className="mini-card__name">{cardTypeName(def?.type)}</span>
      <span className="mini-card__icon">{style.icon}</span>
      <span className="mini-card__value">{formatNumber(def?.value ?? '?')}</span>
    </Tag>
  );
}

function ChoiceSheet({ pending, players }) {
  const t = useT();
  const groups = useMemo(() => {
    const map = new Map();
    for (const option of pending.options) {
      const key = option.targetPlayerId ?? '_';
      if (!map.has(key)) map.set(key, []);
      map.get(key).push(option);
    }
    return [...map.entries()];
  }, [pending]);
  return (
    <div className="sheet">
      <h3 className="sheet__title">{TYPE_STYLE[defOf(pending.options[0]?.defId)?.type]?.icon} {t(`abilities.${pending.ability}.title`)}</h3>
      <p className="sheet__prompt">{t(`abilities.${pending.ability}.prompt`)}</p>
      <p className="muted small">{t('game.clickTarget')}</p>
      {groups.map(([playerId, options]) => (
        <div key={playerId} className="sheet__group">
          {playerId !== '_' && <span className="label">{players.find((p) => p.id === playerId)?.name}</span>}
          <div className="sheet__row">
            {options.map((option) => (
              <MiniCard key={JSON.stringify(option)} defId={option.defId} onClick={() => send('choose', option)} />
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

function Results({ view, room, onMenu }) {
  const t = useT();
  const me = room.mySeatId;
  const winners = view.results?.winners ?? [];
  const ranked = [...view.players].sort((a, b) => (view.results?.scores?.[b.id] ?? 0) - (view.results?.scores?.[a.id] ?? 0));
  const iWon = winners.includes(me);
  const myHost = room.seats.find((s) => s.id === me)?.isHost;
  const headline = winners.length > 1 && iWon ? t('results.tie') : iWon ? t('results.victory') : t('results.defeat');
  return (
    <div className="modal-backdrop results-backdrop">
      <div className={`modal results ${iWon ? 'is-win' : ''}`}>
        <p className="label">{t('results.title')}</p>
        <h2 className="results__headline title-font">{iWon ? '🏆 ' : '⚓ '}{headline}</h2>
        <ol className="podium">
          {ranked.map((p, i) => {
            const seat = room.seats.find((s) => s.id === p.id);
            return (
              <li key={p.id} className={`podium__row ${winners.includes(p.id) ? 'is-winner' : ''} ${p.id === me ? 'is-me' : ''}`} style={{ '--seat': seat?.color ?? '#f1c40f' }}>
                <span className="podium__place">{formatNumber(i + 1)}</span>
                <span className="avatar">{seat?.avatar ?? '🏴‍☠️'}</span>
                <span className="podium__name">{p.name}{winners.includes(p.id) && <em className="tag tag--gold">👑 {t('results.winner')}</em>}</span>
                <span className="podium__cargo muted">{t('results.cargoCount', { count: p.shipCargo.length })}</span>
                <strong className="podium__score">{t('results.points', { score: view.results?.scores?.[p.id] ?? scoreOf(p) })}</strong>
              </li>
            );
          })}
        </ol>
        <div className="modal__actions">
          <Button variant="ghost" onClick={onMenu}>{t('results.menu')}</Button>
          {myHost || room.mode === 'solo'
            ? <Button variant="gold" icon="⛵" onClick={() => send('rematch')}>{t('results.rematch')}</Button>
            : <span className="muted pulse">{t('results.waitRematch')}</span>}
        </div>
      </div>
    </div>
  );
}

export default function GameHud() {
  const t = useT();
  const view = useStore(gameStore, (s) => s.view);
  const room = useStore(gameStore, (s) => s.room);
  const busy = useStore(gameStore, (s) => s.busy);
  const banner = useStore(gameStore, (s) => s.banner);
  const connection = useStore(gameStore, (s) => s.connection);
  const [paused, setPaused] = useState(false);
  const [overlay, setOverlay] = useState(null); // settings | howto
  const [confirmLeave, setConfirmLeave] = useState(false);
  const [chatOpen, setChatOpen] = useState(false);

  const players = view?.players ?? [];
  const me = players.find((p) => p.id === room.mySeatId);
  const current = view ? players[view.currentPlayerIndex] : null;
  const myTurn = Boolean(me && current?.id === me.id);
  const canDecide = myTurn && !busy && view?.phase === 'PLAYER_DECISION' && connection === 'connected';
  const pending = !busy && view?.pendingAbilityChoice?.currentPlayerId === room.mySeatId ? view.pendingAbilityChoice : null;
  const compass = !busy && myTurn && view?.phase === 'PLAYER_DECISION' && view.abilityContext?.ability === 'compass' && view.abilityContext.playerId === me?.id
    ? view.abilityContext : null;
  const finished = view?.phase === 'SCORING' && !busy;

  const leave = async () => {
    await leaveRoom();
    go('menu');
  };

  useEffect(() => {
    const onKey = (e) => {
      if (e.target.tagName === 'INPUT') return;
      if (e.key === 'Escape') {
        if (overlay) setOverlay(null);
        else setPaused((p) => !p);
        return;
      }
      if (paused || !canDecide) return;
      if (e.key === ' ' || e.key.toLowerCase() === 'e') { e.preventDefault(); send('explore'); }
      if (e.key === 'Enter' || e.key.toLowerCase() === 'r') { e.preventDefault(); send('return'); }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [canDecide, paused, overlay]);

  // A finished solo game leaves nothing to resume.
  useEffect(() => {
    if (finished && room.mode === 'solo') setSave(null);
  }, [finished, room.mode]);

  if (!view) {
    return (
      <div className="hud-center">
        <div className="spinner">⚓</div>
        <p>{connection === 'lost' ? t('game.reconnectFailed') : t('online.connecting')}</p>
        {connection === 'lost' && <Button onClick={leave}>{t('results.menu')}</Button>}
      </div>
    );
  }

  const myScore = me ? scoreOf(me) : 0;
  const ifReturn = me ? scoreIfReturned(me, view.expeditionArea) : 0;

  return (
    <div className="hud">
      <div className="hud__top">
        <button type="button" className="icon-btn" onClick={() => setPaused(true)} aria-label={t('pause.title')}>☰</button>
        <div className="hud__chips">
          <span className="chip-stat">🃏 {formatNumber(view.treasureDeckCount)}</span>
          <span className="chip-stat">☠️ {formatNumber(view.lostLoot.length)}</span>
          <span className="chip-stat">⏳ {t('game.round', { count: view.turnCount + 1 })}</span>
          {room.mode === 'online' && <span className="chip-stat" dir="ltr">#{room.roomId}</span>}
        </div>
        <div className={`turn-pill ${myTurn ? 'is-mine' : ''}`} style={{ '--seat': room.seats.find((s) => s.id === current?.id)?.color }}>
          {myTurn ? t('game.yourTurn') : t('game.theirTurn', { name: current?.name ?? '' })}
          <small>{t(`status.phases.${view.phase}`)}</small>
        </div>
        {busy && <button type="button" className="icon-btn icon-btn--wide" onClick={skipReplay}>⏩ {t('game.skip')}</button>}
      </div>

      <aside className="scoreboard">
        {players.map((p) => {
          const seat = room.seats.find((s) => s.id === p.id);
          return (
            <div key={p.id} className={`scoreboard__row ${p.id === current?.id ? 'is-current' : ''} ${p.id === me?.id ? 'is-me' : ''}`} style={{ '--seat': seat?.color ?? '#999' }}>
              <span className="avatar avatar--sm">{seat?.avatar ?? '🏴‍☠️'}</span>
              <span className="scoreboard__name">{p.name}</span>
              <span className="scoreboard__cargo">🚢 {formatNumber(p.shipCargo.length)}</span>
              <strong className="scoreboard__score">⭐ {formatNumber(scoreOf(p))}</strong>
              {seat && !seat.isAI && !seat.connected && <span title={t('lobby.offline')}>📡</span>}
            </div>
          );
        })}
      </aside>

      {banner && (
        <div key={banner.id} className={`banner banner--${banner.tone}`}>
          <strong className="title-font">{banner.text}</strong>
          {banner.sub && <span>{banner.sub}</span>}
        </div>
      )}

      {compass && (
        <div className="compass-peek">
          <span className="label">🧭 {t('game.compassHint')}</span>
          {compass.peekedDefId ? <MiniCard defId={compass.peekedDefId} /> : <p className="muted">{t('common.treasureDeckEmpty')}</p>}
        </div>
      )}

      {pending && <ChoiceSheet pending={pending} players={players} />}

      {me && !finished && (
        <div className="action-bar">
          <div className="action-bar__info">
            <span>⭐ {t('game.score')}: <strong>{formatNumber(myScore)}</strong></span>
            {view.expeditionArea.length > 0 && myTurn && <span className="muted">{t('game.ifReturn', { score: ifReturn })}</span>}
            {view.shieldActive && myTurn && <span className="tag tag--shield">🛡️ {t('game.shieldUp')}</span>}
          </div>
          <div className="action-bar__buttons">
            <Button icon="⛵" variant="gold" disabled={!canDecide} onClick={() => send('explore')}>{t('actions.exploreFurther')}<kbd>E</kbd></Button>
            <Button icon="🏝️" disabled={!canDecide} onClick={() => send('return')}>{t('actions.returnToShip')}<kbd>R</kbd></Button>
          </div>
          {!myTurn && !busy && current && <p className="muted pulse small">{t('game.waiting', { name: current.name })}</p>}
        </div>
      )}
      {!me && <div className="action-bar"><span className="tag">{t('game.spectating')}</span></div>}

      {room.mode === 'online' && (
        <div className={`hud-chat ${chatOpen ? 'is-open' : ''}`}>
          <button type="button" className="icon-btn" onClick={() => setChatOpen((o) => !o)}>💬 {room.chat.length > 0 && <small>{formatNumber(room.chat.length)}</small>}</button>
          {chatOpen && <Chat compact />}
        </div>
      )}

      {connection === 'reconnecting' && (
        <div className="modal-backdrop"><div className="modal modal--small"><div className="spinner">⚓</div><p>{t('game.reconnecting')}</p></div></div>
      )}

      {finished && <Results view={view} room={room} onMenu={leave} />}

      {paused && !overlay && (
        <div className="modal-backdrop" onClick={() => setPaused(false)}>
          <div className="modal pause" onClick={(e) => e.stopPropagation()}>
            <h2 className="title-font">{t('pause.title')}</h2>
            <Button icon="▶" variant="gold" className="btn--block" onClick={() => setPaused(false)}>{t('pause.resume')}</Button>
            <Button icon="⚙️" variant="secondary" className="btn--block" onClick={() => setOverlay('settings')}>{t('pause.settings')}</Button>
            <Button icon="📜" variant="secondary" className="btn--block" onClick={() => setOverlay('howto')}>{t('pause.howTo')}</Button>
            <Button icon="🚪" variant="danger" className="btn--block" onClick={() => setConfirmLeave(true)}>{t('pause.leave')}</Button>
          </div>
        </div>
      )}

      {overlay && (
        <div className="modal-backdrop" onClick={() => setOverlay(null)}>
          <div className={`modal ${overlay === 'howto' ? 'modal--wide' : ''}`} onClick={(e) => e.stopPropagation()}>
            <header className="panel__header">
              <button type="button" className="panel__back" onClick={() => setOverlay(null)}><span className="flip-rtl">←</span></button>
              <h2 className="panel__title">{overlay === 'settings' ? t('settings.title') : t('howTo.title')}</h2>
            </header>
            <div className="modal__scroll">{overlay === 'settings' ? <SettingsBody /> : <HowToBody />}</div>
          </div>
        </div>
      )}

      {confirmLeave && (
        <Confirm
          text={room.mode === 'solo' ? t('game.leaveSolo') : t('game.leaveConfirm')}
          confirmLabel={t('pause.confirm')}
          cancelLabel={t('pause.cancel')}
          onCancel={() => setConfirmLeave(false)}
          onConfirm={leave}
        />
      )}
    </div>
  );
}

