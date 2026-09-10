/*
 * Conditional Probability Explorer - build configuration
 * (c) 2026 Richard Lipka <lipka@fav.zcu.cz> - MIT license
 */
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// GitHub Pages serves the project from a sub-path, so a built bundle needs that
// prefix on every asset. The dev server keeps the root so links stay short.
const BASE = '/conditional-probability-explorer/';

export default defineConfig(({ command }) => ({
  base: command === 'build' ? BASE : '/',
  plugins: [react()],
  server: { port: 5183 },
  preview: { port: 5184 },
}));
