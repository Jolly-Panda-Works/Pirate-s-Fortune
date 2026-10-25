import { createRoot } from 'react-dom/client';

import '@fontsource/pirata-one/400.css';
import '@fontsource/inter/400.css';
import '@fontsource/inter/600.css';
import '@fontsource/inter/800.css';
import '@fontsource/vazirmatn/400.css';
import '@fontsource/vazirmatn/700.css';
import './styles.css';

import App from './App.jsx';

// Dev-only: `?bgraf` keeps the render loop running in a hidden/background
// tab (browsers pause requestAnimationFrame there) — used for automated checks.
if (import.meta.env.DEV && new URLSearchParams(location.search).has('bgraf')) {
  window.requestAnimationFrame = (cb) => setTimeout(() => cb(performance.now()), 33);
}

createRoot(document.getElementById('root')).render(<App />);
