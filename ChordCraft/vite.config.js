import { defineConfig } from 'vite';

export default defineConfig({
  // The Pages project root is /AtomicForge/.
  // Keep the root path for local development and preview servers.
  base: process.env.GITHUB_PAGES === 'true' ? '/AtomicForge/' : '/',
});
