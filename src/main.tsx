// Polyfill Buffer for gray-matter (Node.js built-in not available in WebView)
import { Buffer } from 'buffer';
declare global { interface Window { Buffer: typeof Buffer } }
window.Buffer = window.Buffer ?? Buffer;

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
