import { useEffect, useState } from 'react';

import { go } from '../store.js';
import { useT } from '../i18n.js';
import { unlockAudio, playSfx } from '../audio.js';

export default function Splash() {
  const t = useT();
  const [stage, setStage] = useState(0); // 0 studio, 1 logo, 2 ready

  useEffect(() => {
    const a = setTimeout(() => setStage(1), 2200);
    const b = setTimeout(() => setStage(2), 3600);
    return () => { clearTimeout(a); clearTimeout(b); };
  }, []);

  useEffect(() => {
    const start = () => {
      unlockAudio();
      setTimeout(() => playSfx('returnToShip'), 60);
      go('menu');
    };
    const onKey = () => (stage >= 1 ? start() : setStage(1));
    window.addEventListener('keydown', onKey);
    window.addEventListener('pointerdown', onKey);
    return () => {
      window.removeEventListener('keydown', onKey);
      window.removeEventListener('pointerdown', onKey);
    };
  }, [stage]);

  return (
    <div className="splash">
      {stage === 0 && (
        <div className="splash__studio">
          <div className="splash__panda">🐼</div>
          <p>{t('splash.presents')}</p>
        </div>
      )}
      {stage >= 1 && (
        <div className="splash__logo">
          <h1 className="logo title-font">
            <span className="logo__small">Pirate&apos;s</span>
            <span className="logo__big">Fortune</span>
          </h1>
          <div className="logo__rule">⚓ ✦ ☠️ ✦ ⚓</div>
          {stage === 2 && <p className="splash__tap">{t('splash.tap')}</p>}
        </div>
      )}
    </div>
  );
}
