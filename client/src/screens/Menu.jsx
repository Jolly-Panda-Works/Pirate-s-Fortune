import { useState } from 'react';

import { appStore, go, useStore } from '../store.js';
import { useT } from '../i18n.js';
import { Button } from '../ui.jsx';
import { checkServer, isNativeApp, resumeSolo } from '../net.js';

export default function Menu() {
  const t = useT();
  const profile = useStore(appStore, (s) => s.profile);
  const online = useStore(appStore, (s) => s.serverOnline);
  const save = useStore(appStore, (s) => s.save);
  const [checking, setChecking] = useState(false);

  const retry = async () => {
    setChecking(true);
    await checkServer();
    setChecking(false);
  };

  return (
    <div className="menu">
      <div className="menu__brand">
        <h1 className="logo title-font">
          <span className="logo__small">Pirate&apos;s</span>
          <span className="logo__big">Fortune</span>
        </h1>
        <button type="button" className="menu__captain" onClick={() => go('profile')}>
          <span className="avatar" style={{ '--seat': profile.color }}>{profile.avatar}</span>
          <span>{t('menu.greeting', { name: profile.name })}</span>
        </button>
      </div>

      <nav className="menu__nav">
        {save && (
          <Button icon="🧭" variant="gold" onClick={() => resumeSolo()}>{t('menu.continue')}</Button>
        )}
        <Button icon="⚔️" onClick={() => go('solo')}>{t('menu.solo')}</Button>
        <Button icon="🌊" disabled={!online} onClick={() => go('online')}>{t('menu.online')}</Button>
        <Button icon="☠️" variant="secondary" onClick={() => go('profile')}>{t('menu.profile')}</Button>
        <Button icon="📜" variant="secondary" onClick={() => go('howto', { returnTo: 'menu' })}>{t('menu.howTo')}</Button>
        <Button icon="⚙️" variant="secondary" onClick={() => go('settings', { returnTo: 'menu' })}>{t('menu.settings')}</Button>
        <Button icon="🐼" variant="ghost" onClick={() => go('credits')}>{t('menu.credits')}</Button>
      </nav>

      {online === false && (
        <div className="menu__offline">
          <span>ℹ️ {isNativeApp ? t('menu.offlineApp') : t('menu.offline')}</span>
          {isNativeApp && <Button variant="ghost" onClick={() => go('settings', { returnTo: 'menu' })}>⚙️</Button>}
          <Button variant="ghost" onClick={retry} disabled={checking}>{t('menu.retry')}</Button>
        </div>
      )}
      <img className="menu__studio" src={`${import.meta.env.BASE_URL}brand/jolly-panda-light.png`} alt="Jolly Panda Studio" />
      <footer className="menu__footer">{t('menu.version', { version: __APP_VERSION__ })}</footer>
    </div>
  );
}
