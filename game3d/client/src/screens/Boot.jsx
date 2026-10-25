import { useEffect, useState } from 'react';

import { appStore, go } from '../store.js';
import { useT } from '../i18n.js';
import { preloadAudio } from '../audio.js';
import { prewarmCardTextures } from '../three/cardTextures.js';
import { checkServer } from '../net.js';

const STEPS = [
  { key: 'fonts', weight: 0.15 },
  { key: 'cards', weight: 0.35 },
  { key: 'audio', weight: 0.2 },
  { key: 'scene', weight: 0.15 },
  { key: 'server', weight: 0.15 },
];

async function loadFonts() {
  if (!document.fonts) return;
  await Promise.all([
    document.fonts.load('400 40px "Pirata One"'),
    document.fonts.load('600 20px Inter'),
    document.fonts.load('800 20px Inter'),
    document.fonts.load('700 20px Vazirmatn'),
    document.fonts.load('400 20px Vazirmatn'),
  ]).catch(() => {});
}

function waitForScene() {
  return new Promise((resolve) => {
    if (appStore.get().sceneReady) return resolve();
    const unsub = appStore.subscribe(() => {
      if (appStore.get().sceneReady) {
        unsub();
        // give the GPU a couple of frames to compile shaders
        setTimeout(resolve, 400);
      }
    });
    setTimeout(resolve, 8000);
  });
}

export default function Boot() {
  const t = useT();
  const [step, setStep] = useState('fonts');
  const [progress, setProgress] = useState(0);
  const [tip, setTip] = useState(0);
  const tips = t('loading.tips');

  useEffect(() => {
    const id = setInterval(() => setTip((x) => (x + 1) % tips.length), 2600);
    return () => clearInterval(id);
  }, [tips.length]);

  useEffect(() => {
    let cancelled = false;
    let base = 0;
    const run = async (key, fn) => {
      const { weight } = STEPS.find((s) => s.key === key);
      setStep(key);
      await fn((p) => !cancelled && setProgress(base + weight * p));
      base += weight;
      if (!cancelled) setProgress(base);
    };
    (async () => {
      const started = performance.now();
      await run('fonts', async (p) => { await loadFonts(); p(1); });
      await run('cards', (p) => prewarmCardTextures(appStore.get().settings.locale, p));
      await run('audio', (p) => preloadAudio(p));
      await run('scene', async (p) => { await waitForScene(); p(1); });
      await run('server', async (p) => { await checkServer(); p(1); });
      setStep('done');
      const elapsed = performance.now() - started;
      setTimeout(() => !cancelled && go('splash'), Math.max(500, 1600 - elapsed));
    })();
    return () => { cancelled = true; };
  }, []);

  return (
    <div className="boot">
      <div className="boot__logo">
        <span className="boot__skull">☠️</span>
        <h1 className="title-font">Pirate&apos;s Fortune</h1>
        <p className="boot__subtitle">3D</p>
      </div>
      <div className="boot__bar" role="progressbar" aria-valuenow={Math.round(progress * 100)} aria-valuemin={0} aria-valuemax={100}>
        <div className="boot__fill" style={{ width: `${Math.round(progress * 100)}%` }} />
        <div className="boot__ship" style={{ insetInlineStart: `calc(${Math.round(progress * 100)}% - 14px)` }}>⛵</div>
      </div>
      <p className="boot__step">{t(`loading.steps.${step}`)} <span className="boot__pct">{Math.round(progress * 100)}%</span></p>
      <p className="boot__tip" key={tip}>💡 {tips[tip]}</p>
    </div>
  );
}
