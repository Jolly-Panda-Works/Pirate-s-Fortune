import { go } from '../store.js';
import { useT } from '../i18n.js';
import { Panel } from '../ui.jsx';

export default function Credits() {
  const t = useT();
  return (
    <div className="screen-center">
      <Panel title={t('credits.title')} onBack={() => go('menu')}>
        <div className="credits">
          <div className="credits__panda">🐼</div>
          {t('credits.lines').map(([role, who]) => (
            <div key={role} className="credits__line">
              <span className="muted">{role}</span>
              <strong dir="ltr">{who}</strong>
            </div>
          ))}
        </div>
      </Panel>
    </div>
  );
}
