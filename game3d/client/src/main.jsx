import { createRoot } from 'react-dom/client';

import '@fontsource/pirata-one/400.css';
import '@fontsource/inter/400.css';
import '@fontsource/inter/600.css';
import '@fontsource/inter/800.css';
import '@fontsource/vazirmatn/400.css';
import '@fontsource/vazirmatn/700.css';
import './styles.css';

import App from './App.jsx';

createRoot(document.getElementById('root')).render(<App />);
