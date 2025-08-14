#!/usr/bin/env node
/*
 * Import dirty words JSON from encycloDB and generate language pack files.
 * Source: https://github.com/tural-ali/encycloDB/blob/master/Dirty%20Words/DirtyWords.json
 * Usage:
 *   node scripts/import-dirtywords.mjs [--url URL(OPTIONAL)] [--out src/languages] [--languages en,es,fr,de,it,pt(Leave blank to import all languages)]
 */

import fs from 'node:fs/promises';
import path from 'node:path';

const DEFAULT_URL =
  'https://raw.githubusercontent.com/tural-ali/encycloDB/master/Dirty%20Words/DirtyWords.json';
const DEFAULT_OUT = path.resolve(process.cwd(), 'src/languages');
const DEFAULT_LANGS = null; // null means import all languages found

function parseArgs(argv) {
  const args = { url: DEFAULT_URL, out: DEFAULT_OUT, languages: DEFAULT_LANGS };
  for (let i = 2; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--url' && argv[i + 1]) {
      args.url = argv[++i];
    } else if (a === '--out' && argv[i + 1]) {
      args.out = path.resolve(process.cwd(), argv[++i]);
    } else if (a === '--languages' && argv[i + 1]) {
      args.languages = argv[++i]
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean);
    }
  }
  return args;
}

function sanitizeWord(raw) {
  if (typeof raw !== 'string') return null;
  let w = raw.trim().toLowerCase();
  if (!w) return null;
  // Collapse internal whitespace to single spaces
  w = w.replace(/\s+/g, ' ');
  // Drop overlong entries
  if (w.length > 64) return null;
  return w;
}

function toConstPrefix(lang) {
  return (
    lang
      .toUpperCase()
      .replace(/[^A-Z0-9]+/g, '_')
      .replace(/^_+|_+$/g, '') || 'LANG'
  );
}

function fileHeader(lang, sourceUrl) {
  return `// Auto-generated from ${sourceUrl} on ${new Date().toISOString()}\n// Language: ${lang}\n`;
}

function renderArrayExport(lang, words, sourceUrl) {
  const PREFIX = toConstPrefix(lang);
  const exportName = `${PREFIX}_WORDS`;
  const lines = words.map((w) => `  '${w.replace(/\\/g, '\\\\').replace(/'/g, "\\'")}',`);
  return `${fileHeader(lang, sourceUrl)}export const ${exportName}: string[] = [\n${lines.join('\n')}\n];\n\nexport default ${exportName};\n`;
}

async function ensureDir(dir) {
  await fs.mkdir(dir, { recursive: true });
}

async function main() {
  const { url, out } = parseArgs(process.argv);
  await ensureDir(out);

  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`Failed to fetch ${url}: ${res.status} ${res.statusText}`);
  }
  const data = await res.json();
  const records = Array.isArray(data?.RECORDS) ? data.RECORDS : [];
  if (records.length === 0) {
    throw new Error('No RECORDS found in JSON.');
  }

  // Bucket by language
  const byLang = new Map();
  for (const rec of records) {
    const lang = typeof rec?.language === 'string' ? rec.language.trim().toLowerCase() : '';
    const word = sanitizeWord(rec?.word);
    if (!lang || !word) continue;
    if (!byLang.has(lang)) byLang.set(lang, new Set());
    const set = byLang.get(lang);
    set.add(word);
    // Language-specific ASCII-friendly variants
    // German: map ß -> ss
    if (lang === 'de' && word.includes('ß')) {
      set.add(word.replace(/ß/g, 'ss'));
    }
  }

  // Determine languages to generate
  let languages = parseArgs(process.argv).languages;
  if (!languages || (Array.isArray(languages) && languages.length === 0)) {
    languages = Array.from(byLang.keys());
  }

  // Generate for requested languages only
  let totalWritten = 0;
  for (const lang of languages) {
    // sanitize language code to safe file segment (e.g., en, fr, zh)
    if (!/^[a-z]{2,3}$/i.test(lang)) {
      console.warn(`Skipping unsupported or unsafe language code '${lang}'.`);
      continue;
    }
    const set = byLang.get(lang);
    if (!set || set.size === 0) {
      console.warn(`No words for language '${lang}' in source dataset.`);
      continue;
    }
    const words = Array.from(set.values()).sort((a, b) => a.localeCompare(b));
    const content = renderArrayExport(lang, words, url);
    const filePath = path.join(out, `${lang}.ts`);
    await fs.writeFile(filePath, content, 'utf8');
    console.log(`Wrote ${words.length} words to ${filePath}`);
    totalWritten += words.length;
  }

  console.log(`Done. Total words written: ${totalWritten}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
