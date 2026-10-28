import { describe, it, expect } from 'vitest';
import { TEST_SUITES } from '../../pages/testCatalog.js';
import selfSource from './testCatalog.test.ts?raw';

// Keeps the Admin → Test Catalog page honest: every frontend test must be
// described there, and nothing described there may be gone. Test sources
// are read as raw text through Vite's glob import (no Node fs types in the
// frontend). Backend tests live in another repo and can't be checked from
// here in CI — those rely on the CLAUDE.md rule.

const sources = {
  ...(import.meta.glob('../**/*.test.{ts,tsx}', { query: '?raw', import: 'default', eager: true }) as Record<string, string>),
  // The glob never includes the importing file itself.
  './testCatalog.test.ts': selfSource,
};

function testNamesIn(src: string): string[] {
  const names: string[] = [];
  // it / test calls with a single- or double-quoted name (escapes allowed).
  const re = /\b(?:it|test)\(\s*(['"])((?:\\.|(?!\1).)*)\1/g;
  for (const m of src.matchAll(re)) names.push(m[2].replace(/\\(.)/g, '$1'));
  return names;
}

const actual = new Set<string>();
for (const [path, src] of Object.entries(sources)) {
  // Glob keys are relative to this file's folder (src/tests/unit): Vite
  // writes siblings as "./x" and other folders as "../folder/x".
  const file = 'src/tests/' + (path.startsWith('./') ? `unit/${path.slice(2)}` : path.replace(/^\.\.\//, ''));
  for (const name of testNamesIn(src)) actual.add(`${file} › ${name}`);
}

const catalogued = new Set<string>(
  TEST_SUITES.filter(s => s.project === 'Frontend')
    .flatMap(s => s.cases.map(c => `${s.file} › ${c.name}`)),
);

describe('Test catalog', () => {
  it('lists every frontend test', () => {
    const missing = [...actual].filter(k => !catalogued.has(k));
    expect(missing, 'Add these to src/pages/testCatalog.ts').toEqual([]);
  });

  it('lists no frontend test that no longer exists', () => {
    const stale = [...catalogued].filter(k => !actual.has(k));
    expect(stale, 'Remove or rename these in src/pages/testCatalog.ts').toEqual([]);
  });
});
