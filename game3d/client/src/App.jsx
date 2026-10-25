import { Suspense, useEffect } from 'react';
import { Canvas } from '@react-three/fiber';

import { appStore, useStore } from './store.js';
import { dirOf } from './i18n.js';
import { Toasts } from './ui.jsx';
import MenuScene from './three/MenuScene.jsx';
import GameScene from './three/GameScene.jsx';

import Boot from './screens/Boot.jsx';
import Splash from './screens/Splash.jsx';
import Menu from './screens/Menu.jsx';
import Solo from './screens/Solo.jsx';
import Online from './screens/Online.jsx';
import Lobby from './screens/Lobby.jsx';
import Profile from './screens/Profile.jsx';
import Settings from './screens/Settings.jsx';
import HowTo from './screens/HowTo.jsx';
import Credits from './screens/Credits.jsx';
import GameHud from './screens/GameHud.jsx';

const SCREENS = {
  boot: Boot,
  splash: Splash,
  menu: Menu,
  solo: Solo,
  online: Online,
  lobby: Lobby,
  profile: Profile,
  settings: Settings,
  howto: HowTo,
  credits: Credits,
  game: GameHud,
};

function Stage({ screen }) {
  const quality = useStore(appStore, (s) => s.settings.quality);
  const inGame = screen === 'game';
  return (
    <div className={`stage ${screen === 'boot' ? 'stage--hidden' : ''}`}>
      <Canvas
        shadows={quality !== 'low'}
        dpr={quality === 'high' ? [1, 2] : [1, 1.25]}
        camera={{ position: [0, 7.4, 8.8], fov: 45, near: 0.1, far: 900 }}
        gl={{ antialias: quality !== 'high', powerPreference: 'high-performance' }}
        onCreated={() => appStore.set({ sceneReady: true })}
      >
        <Suspense fallback={null}>
          {inGame ? <GameScene /> : <MenuScene variant={screen === 'splash' ? 'splash' : 'menu'} />}
        </Suspense>
      </Canvas>
    </div>
  );
}

export default function App() {
  const screen = useStore(appStore, (s) => s.screen);
  const locale = useStore(appStore, (s) => s.settings.locale);
  const Screen = SCREENS[screen] ?? Menu;

  useEffect(() => {
    document.documentElement.lang = locale;
    document.documentElement.dir = dirOf(locale);
  }, [locale]);

  return (
    <div className={`app lang-${locale} screen-${screen}`} dir={dirOf(locale)}>
      <Stage screen={screen} />
      <div className="ui-layer">
        <Screen key={screen} />
      </div>
      <Toasts />
    </div>
  );
}
