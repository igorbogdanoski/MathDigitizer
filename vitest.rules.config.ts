import { defineConfig } from 'vitest/config';
import path from 'path';

/**
 * Firestore rules test config.
 *
 * The default vitest run excludes `firestore.rules.test.ts` because it needs
 * the Firestore emulator. This config runs exactly that file, and is invoked
 * through `npm run test:rules`, which starts the emulator around it.
 */
export default defineConfig({
  resolve: {
    alias: {
      '@': path.resolve(__dirname, '.'),
    },
  },
  test: {
    environment: 'node',
    include: ['src/lib/firestore.rules.test.ts'],
    // The emulator is cold on the first connection.
    testTimeout: 20_000,
    hookTimeout: 30_000,
  },
});
