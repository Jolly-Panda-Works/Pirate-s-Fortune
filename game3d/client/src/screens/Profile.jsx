import { useState } from 'react';

import { appStore, go, resetStats, updateProfile, useStore } from '../store.js';
import { useT, formatNumber } from '../i18n.js';
import { Button, Confirm, Panel } from '../ui.jsx';

const AVATARS = ['☠️', '🏴‍☠️', '🦜', '🦑', '🐙', '🐊', '🦈', '🐒', '🦀', '👑', '💀', '⚓', '🧜'];
const COLORS = ['#f1c40f', '#e74c3c', '#3498db', '#2ecc71', '#9b59b6', '#e67e22', '#1abc9c', '#ecf0f1'];

function rankIndex(stats) {
  const xp = stats.wins * 3 + stats.played;
  return [0, 4, 10, 22, 40, 70].filter((need) => xp >= need).length - 1;
}

export default function Profile() {
  const t = useT();
  const profile = useStore(appStore, (s) => s.profile);
  const locale = useStore(appStore, (s) => s.settings.locale);
  const [name, setName] = useState(profile.name);
  const [saved, setSaved] = useState(false);
  const [confirm, setConfirm] = useState(false);
  const s = profile.stats;
  const ranks = t('profile.ranks');
  const rank = rankIndex(s);
  const winRate = s.played ? Math.round((s.wins / s.played) * 100) : 0;
  const avg = s.played ? Math.round(s.totalScore / s.played) : 0;

  const saveName = () => {
    updateProfile({ name: name.trim().slice(0, 18) || profile.name });
    setSaved(true);
    setTimeout(() => setSaved(false), 1400);
  };

  const date = new Intl.DateTimeFormat(locale === 'fa' ? 'fa-IR' : 'en-GB', { dateStyle: 'medium', timeStyle: 'short' });

  return (
    <div className="screen-center">
      <Panel title={t('profile.title')} onBack={() => go('menu')} wide>
        <div className="profile">
          <section className="profile__card" style={{ '--seat': profile.color }}>
            <div className="profile__avatar">{profile.avatar}</div>
            <div className="profile__rank">
              <span className="label">{t('profile.rank')}</span>
              <strong>{ranks[rank]}</strong>
              <div className="rank-bar">{ranks.map((r, i) => <span key={r} className={i <= rank ? 'is-on' : ''} />)}</div>
            </div>

            <label className="field">
              <span className="label">{t('profile.name')}</span>
              <div className="field__row">
                <input className="input" dir="auto" value={name} maxLength={18} onChange={(e) => setName(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && saveName()} />
                <Button variant="secondary" onClick={saveName}>{saved ? `✓ ${t('profile.saved')}` : t('profile.save')}</Button>
              </div>
            </label>

            <div className="field">
              <span className="label">{t('profile.avatar')}</span>
              <div className="chip-grid">
                {AVATARS.map((a) => (
                  <button type="button" key={a} className={`chip ${profile.avatar === a ? 'is-active' : ''}`} onClick={() => updateProfile({ avatar: a })}>{a}</button>
                ))}
              </div>
            </div>

            <div className="field">
              <span className="label">{t('profile.color')}</span>
              <div className="chip-grid">
                {COLORS.map((c) => (
                  <button type="button" key={c} aria-label={c} className={`swatch ${profile.color === c ? 'is-active' : ''}`} style={{ background: c }} onClick={() => updateProfile({ color: c })} />
                ))}
              </div>
            </div>
          </section>

          <section className="profile__stats">
            <h3 className="label">📖 {t('profile.stats')}</h3>
            <div className="stat-grid">
              <div className="stat"><span>{formatNumber(s.played)}</span><small>{t('profile.played')}</small></div>
              <div className="stat"><span>{formatNumber(s.wins)}</span><small>{t('profile.wins')}</small></div>
              <div className="stat"><span>{formatNumber(winRate)}{locale === 'fa' ? '٪' : '%'}</span><small>{t('profile.winRate')}</small></div>
              <div className="stat"><span>{formatNumber(s.bestScore)}</span><small>{t('profile.best')}</small></div>
              <div className="stat"><span>{formatNumber(avg)}</span><small>{t('profile.avg')}</small></div>
              <div className="stat"><span>{formatNumber(s.cardsSecured)}</span><small>{t('profile.secured')}</small></div>
              <div className="stat"><span>{formatNumber(s.shipwrecks)}</span><small>{t('profile.shipwrecks')}</small></div>
            </div>

            <h3 className="label">🗺️ {t('profile.history')}</h3>
            {s.history.length === 0 ? (
              <p className="muted">{t('profile.noHistory')}</p>
            ) : (
              <ul className="history">
                {s.history.map((h) => (
                  <li key={h.at} className={h.won ? 'is-won' : ''}>
                    <span className="history__result">{h.won ? `🏆 ${t('profile.won')}` : `⚓ ${t('profile.lost')}`}</span>
                    <span className="history__score">⭐ {formatNumber(h.score)}</span>
                    <span className="history__vs">{t('profile.vs', { names: h.opponents.join(', ') })}</span>
                    <span className="history__date">{date.format(h.at)}</span>
                  </li>
                ))}
              </ul>
            )}
            <Button variant="ghost" onClick={() => setConfirm(true)}>🗑️ {t('profile.reset')}</Button>
          </section>
        </div>
      </Panel>
      {confirm && (
        <Confirm
          text={t('profile.resetConfirm')}
          confirmLabel={t('profile.reset')}
          cancelLabel={t('pause.cancel')}
          onCancel={() => setConfirm(false)}
          onConfirm={() => { resetStats(); setConfirm(false); }}
        />
      )}
    </div>
  );
}
