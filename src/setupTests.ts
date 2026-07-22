import '@testing-library/jest-dom/vitest';
import i18n from './i18n';

// Ensure i18n is initialized before tests run
if (!i18n.isInitialized) {
  // i18n.init is called on import, but in test env it may need a tick
}
