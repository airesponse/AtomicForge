import { defineConfig } from 'vite';

export default defineConfig({
  // ChordCraft is published under the AtomicForge launcher at /ChordCraft/.
  // Keep the root path for local development and preview servers.
  base: process.env.GITHUB_PAGES === 'true' ? '/AtomicForge/ChordCraft/' : '/',
});
