// Polyfill Buffer for gray-matter (Node.js built-in not available in WebView)
import { Buffer } from 'buffer';
declare global { interface Window { Buffer: typeof Buffer } }
window.Buffer = window.Buffer ?? Buffer;

// Global keyboard shortcuts — registered once at module level, outside React.
// Zustand stores are plain JS modules so they're accessible here directly.
import { useUIStore } from './store/ui.store';
window.addEventListener('keydown', (e) => {
  if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
    e.preventDefault();
    useUIStore.getState().setCommandPaletteOpen(true);
  }
});

import React from 'react';
import ReactDOM from 'react-dom/client';
import './styles/variables.css';
import './styles/reset.css';
import './styles/global.css';
import App from './App';

ReactDOM.createRoot(document.getElementById('root') as HTMLElement).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
