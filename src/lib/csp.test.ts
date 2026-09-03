import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import firebaseConfig from '../../firebase-applet-config.json';

/**
 * The Content-Security-Policy must permit what signing in actually needs.
 *
 * Firebase Auth loads an iframe from the configured `authDomain` — for both the
 * popup and the redirect flow — and `frame-src` decides whether the browser
 * allows it. When `authDomain` moved to a self-hosted handler in May 2026 to
 * avoid third-party cookie blocking, the policy was not updated to allow
 * framing it. The browser blocked the iframe, sign-in could never complete, and
 * the only sign it left was a console message:
 *
 *   Framing 'https://mathdigitizer.vercel.app/' violates the following Content
 *   Security Policy directive: "frame-src https://accounts.google.com ..."
 *
 * Anyone already signed in kept working, because an established session never
 * needs the iframe. So it looked fine to everyone who checked, and no new
 * teacher could get in, for over three months.
 *
 * This test reads both files and holds them to each other, so the policy and
 * the auth domain cannot drift apart again.
 */
const htaccess = readFileSync('public/.htaccess', 'utf8');

function directive(name: string): string[] {
  const policy = /Content-Security-Policy\s+"([^"]+)"/.exec(htaccess)?.[1];
  if (!policy) throw new Error('No Content-Security-Policy found in public/.htaccess');

  const found = policy
    .split(';')
    .map(part => part.trim())
    .find(part => part.startsWith(`${name} `));

  return found ? found.split(/\s+/).slice(1) : [];
}

describe('the policy allows signing in', () => {
  it('permits framing the configured auth domain', () => {
    const authDomain = (firebaseConfig as { authDomain: string }).authDomain;
    expect(authDomain, 'firebase-applet-config.json has no authDomain').toBeTruthy();

    expect(
      directive('frame-src'),
      `frame-src must allow https://${authDomain}, which Firebase Auth frames`,
    ).toContain(`https://${authDomain}`);
  });

  it('still permits the Google account chooser', () => {
    expect(directive('frame-src')).toContain('https://accounts.google.com');
  });

  it('permits the identity endpoints the SDK calls', () => {
    const connect = directive('connect-src');
    expect(connect).toContain('https://identitytoolkit.googleapis.com');
    expect(connect).toContain('https://securetoken.googleapis.com');
  });
});

describe('the policy stays restrictive', () => {
  it('does not fall back to allowing any origin', () => {
    // A policy repaired by widening it to `*` would pass the test above and
    // defeat the point of having one.
    for (const name of ['default-src', 'frame-src', 'connect-src', 'script-src']) {
      expect(directive(name), name).not.toContain('*');
      expect(directive(name), name).not.toContain('https:');
    }
  });

  it('keeps default-src to self', () => {
    expect(directive('default-src')).toEqual(["'self'"]);
  });
});
