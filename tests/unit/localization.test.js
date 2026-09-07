/**
 * localization.test.js
 *
 * Covers Prompt 016's explicit exit criteria: every key present in `en`
 * also exists in `fa` and vice versa — a plain symmetry check directly
 * against the JSON file (not through localizationManager.js's own API,
 * which is DOM-touching and outside this suite's scope, matching every
 * other Stage B/C UI module — see mvp-progress.md's Prompt 012/013 note).
 * This is the guard against a silent-fallback bug: t()'s own English
 * fallback (localizationManager.js) means a missing Persian key would
 * otherwise never be NOTICED during a Persian playthrough — the string
 * would just quietly render in the wrong language instead of breaking
 * loudly. This test is what actually catches that.
 *
 * Run with: node --test tests/unit/localization.test.js
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const localizationPath = path.join(__dirname, '..', '..', 'data', 'localization.json');
const localization = JSON.parse(readFileSync(localizationPath, 'utf-8'));

const SUPPORTED_LOCALES = ['en', 'fa'];

/**
 * Flattens a locale's string tree into a Set of dotted key paths.
 * `dir` is a per-locale metadata field (GDD §20's own "en -> ltr,
 * fa -> rtl"), not a translatable string, so it's deliberately excluded
 * from the symmetry check — every OTHER leaf is expected to be a string.
 * @param {object} tree
 * @param {string} [prefix]
 * @returns {Set<string>}
 */
function flattenKeys(tree, prefix = '') {
  const keys = new Set();
  for (const [key, value] of Object.entries(tree)) {
    if (key === 'dir') continue;
    const fullKey = prefix ? `${prefix}.${key}` : key;
    if (value && typeof value === 'object' && !Array.isArray(value)) {
      for (const nested of flattenKeys(value, fullKey)) keys.add(nested);
    } else {
      keys.add(fullKey);
    }
  }
  return keys;
}

test('data/localization.json declares both required locale blocks', () => {
  for (const locale of SUPPORTED_LOCALES) {
    assert.ok(locale in localization, `missing top-level "${locale}" block`);
    assert.equal(typeof localization[locale], 'object');
  }
});

test('en and fa each declare a valid GDD §20 "dir" (en -> ltr, fa -> rtl)', () => {
  assert.equal(localization.en.dir, 'ltr');
  assert.equal(localization.fa.dir, 'rtl');
});

test('every key present in en also exists in fa', () => {
  const enKeys = flattenKeys(localization.en);
  const faKeys = flattenKeys(localization.fa);
  const missingInFa = [...enKeys].filter((key) => !faKeys.has(key));
  assert.deepEqual(missingInFa, [], `keys present in en but missing in fa: ${missingInFa.join(', ')}`);
});

test('every key present in fa also exists in en', () => {
  const enKeys = flattenKeys(localization.en);
  const faKeys = flattenKeys(localization.fa);
  const missingInEn = [...faKeys].filter((key) => !enKeys.has(key));
  assert.deepEqual(missingInEn, [], `keys present in fa but missing in en: ${missingInEn.join(', ')}`);
});

test('en and fa have exactly the same number of leaf keys', () => {
  const enKeys = flattenKeys(localization.en);
  const faKeys = flattenKeys(localization.fa);
  assert.equal(enKeys.size, faKeys.size);
  assert.ok(enKeys.size > 0, 'sanity check: the string tree should not be empty');
});

test('every leaf value in both locales is a non-empty string', () => {
  for (const locale of SUPPORTED_LOCALES) {
    const keys = flattenKeys(localization[locale]);
    for (const key of keys) {
      const value = key.split('.').reduce((node, part) => node?.[part], localization[locale]);
      assert.equal(typeof value, 'string', `${locale}.${key} should be a string`);
      assert.ok(value.length > 0, `${locale}.${key} should not be an empty string`);
    }
  }
});

test('every {placeholder} token used in an en string is also used in the matching fa string', () => {
  const enKeys = flattenKeys(localization.en);
  const placeholderPattern = /\{(\w+)\}/g;

  for (const key of enKeys) {
    const enValue = key.split('.').reduce((node, part) => node?.[part], localization.en);
    const faValue = key.split('.').reduce((node, part) => node?.[part], localization.fa);
    if (typeof enValue !== 'string' || typeof faValue !== 'string') continue;

    const enPlaceholders = new Set([...enValue.matchAll(placeholderPattern)].map((m) => m[1]));
    const faPlaceholders = new Set([...faValue.matchAll(placeholderPattern)].map((m) => m[1]));

    assert.deepEqual(
      [...enPlaceholders].sort(),
      [...faPlaceholders].sort(),
      `"${key}" declares different {placeholder} tokens between en (${[...enPlaceholders]}) and fa (${[...faPlaceholders]})`
    );
  }
});
