// @vitest-environment node
import { describe, it, expect } from 'vitest';
import { readFileSync, statSync } from 'node:fs';
import { gzipSync } from 'node:zlib';
import path from 'node:path';

const SNIPPET_PATH = path.resolve(
  __dirname,
  '..',
  '..',
  '..',
  'public',
  'snippet',
  'v1',
  'quaynt-attribution.js'
);

const SNIPPET_SOURCE = readFileSync(SNIPPET_PATH, 'utf-8');

describe('Quaynt attribution snippet', () => {
  it('ships as a plain JS file', () => {
    expect(statSync(SNIPPET_PATH).isFile()).toBe(true);
  });

  it('is ≤ 4 KB when gzipped', () => {
    const gzippedBytes = gzipSync(Buffer.from(SNIPPET_SOURCE)).byteLength;
    expect(gzippedBytes).toBeLessThanOrEqual(4096);
  });

  it('does not touch document.cookie', () => {
    expect(SNIPPET_SOURCE).not.toMatch(/document\.cookie/);
  });

  it('does not read userAgentData / high-entropy hints', () => {
    expect(SNIPPET_SOURCE).not.toMatch(/userAgentData/);
    expect(SNIPPET_SOURCE).not.toMatch(/getHighEntropyValues/);
  });

  it('does not use canvas, webgl, audio context, or font fingerprinting APIs', () => {
    expect(SNIPPET_SOURCE).not.toMatch(/getContext\s*\(/);
    expect(SNIPPET_SOURCE).not.toMatch(/createAnalyser|createOscillator|AudioContext/);
    expect(SNIPPET_SOURCE).not.toMatch(/offscreenCanvas|OffscreenCanvas/);
    expect(SNIPPET_SOURCE).not.toMatch(/document\.fonts/);
  });

  it('does not use Worker, WebSocket, or IndexedDB for persistence', () => {
    expect(SNIPPET_SOURCE).not.toMatch(/new\s+Worker/);
    expect(SNIPPET_SOURCE).not.toMatch(/new\s+WebSocket/);
    expect(SNIPPET_SOURCE).not.toMatch(/indexedDB/);
  });

  it('only touches localStorage for the opt-out key', () => {
    // Any localStorage.setItem must reference OPT_OUT_KEY (or the variable holding it).
    const setItemCalls = SNIPPET_SOURCE.match(/localStorage\.setItem\([^)]*\)/g) ?? [];
    for (const call of setItemCalls) {
      expect(call).toMatch(/OPT_OUT_KEY|['"]quaynt-opt-out['"]/);
    }
    // getItem likewise should only target the opt-out key.
    const getItemCalls = SNIPPET_SOURCE.match(/localStorage\.getItem\([^)]*\)/g) ?? [];
    for (const call of getItemCalls) {
      expect(call).toMatch(/OPT_OUT_KEY|['"]quaynt-opt-out['"]/);
    }
  });

  it('honors DNT, Sec-GPC-equivalent, and window.QuayntAttribution.optedOut', () => {
    expect(SNIPPET_SOURCE).toMatch(/doNotTrack/);
    expect(SNIPPET_SOURCE).toMatch(/globalPrivacyControl/);
    expect(SNIPPET_SOURCE).toMatch(/optedOut/);
  });

  it('uses sendBeacon with a fetch fallback', () => {
    expect(SNIPPET_SOURCE).toMatch(/sendBeacon/);
    expect(SNIPPET_SOURCE).toMatch(/fetch\s*\(/);
    expect(SNIPPET_SOURCE).toMatch(/keepalive:\s*true/);
  });

  it('sends Blob with application/json Content-Type (not raw string)', () => {
    expect(SNIPPET_SOURCE).toMatch(
      /new Blob\(\s*\[[^\]]+\],\s*\{\s*type:\s*['"]application\/json['"]/
    );
  });

  it('exposes a public optOut method on window.QuayntAttribution', () => {
    expect(SNIPPET_SOURCE).toMatch(/window\.QuayntAttribution\s*=/);
    expect(SNIPPET_SOURCE).toMatch(/optOut\s*[:=]\s*function/);
  });
});
