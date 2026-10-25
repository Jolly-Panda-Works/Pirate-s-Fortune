import { appStore, go, updateSettings, useStore } from '../store.js';
import { useT } from '../i18n.js';
import { Panel, Segmented, Slider } from '../ui.jsx';
import { prewarmCardTextures } from '../three/cardTextures.js';
import { playSfx } from '../audio.js';

export function SettingsBody() {
  const t = useT();
  const settings = useStore(appStore, (s) => s.settings);
  return (
    <div className="settings">
      <div className="setting">
        <span className="label">🌐 {t('settings.language')}</span>
        <Segmented
          value={settings.locale}
          options={[{ value: 'en', label: 'English' }, { value: 'fa', label: 'فارسی' }]}
          onChange={(locale) => {
            updateSettings({ locale });
            prewarmCardTextures(locale);
          }}
        />
      </div>
      <div className="setting">
        <span className="label">🎵 {t('settings.music')}</span>
        <Slider value={settings.music} onChange={(music) => updateSettings({ music })} />
      </div>
      <div className="setting">
        <span className="label">🔊 {t('settings.sfx')}</span>
        <Slider value={settings.sfx} onChange={(sfx) => updateSettings({ sfx })} />
        <button type="button" className="link" onClick={() => playSfx('reveal')}>▶</button>
      </div>
      <div className="setting">
        <span className="label">🖥️ {t('settings.graphics')}</span>
        <Segmented
          value={settings.quality}
          options={['low', 'medium', 'high'].map((q) => ({ value: q, label: t(`settings.${q}`) }))}
          onChange={(quality) => updateSettings({ quality })}
        />
      </div>
      <div className="setting">
        <span className="label">⏩ {t('settings.animSpeed')}</span>
        <Segmented
          value={settings.animSpeed}
          options={[{ value: 0.75, label: '0.75×' }, { value: 1, label: '1×' }, { value: 1.5, label: '1.5×' }, { value: 2.5, label: '2.5×' }]}
          onChange={(animSpeed) => updateSettings({ animSpeed })}
        />
      </div>
      <div className="setting">
        <span className="label">📳 {t('settings.shake')}</span>
        <Segmented
          value={settings.shake}
          options={[{ value: true, label: t('settings.on') }, { value: false, label: t('settings.off') }]}
          onChange={(shake) => updateSettings({ shake })}
        />
      </div>
    </div>
  );
}

export default function Settings() {
  const t = useT();
  const returnTo = useStore(appStore, (s) => s.returnTo);
  return (
    <div className="screen-center">
      <Panel title={t('settings.title')} onBack={() => go(returnTo || 'menu')}>
        <SettingsBody />
      </Panel>
    </div>
  );
}
