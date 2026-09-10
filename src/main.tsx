/*
 * Conditional Probability Explorer - application entry point
 * (c) 2026 Richard Lipka <lipka@fav.zcu.cz> - MIT license
 */
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { I18nProvider } from './i18n';
import App from './App';
import 'katex/dist/katex.min.css';
import './styles.css';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <I18nProvider>
      <App />
    </I18nProvider>
  </StrictMode>,
);
