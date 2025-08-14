# Changelog

### Removed

- _(List removed features or code — state why)_

---

## [0.1.0-alpha.1] - 2025-08-13

### Added (Phase 3)

- Dynamic language loading API: `loadLanguages([...])` with code-split ready dynamic imports.
- Language packs added: Spanish (`es`), French (`fr`), German (`de`), Italian (`it`), Portuguese (`pt`).
- Presets: `lowLatencyPreset`, `highRecallPreset`.
- Management APIs: `addWord`, `removeWord`, `setLanguages`.

### Added (Phase 4)

- React hook: `useProfanityBuster` with optional language preload and ready state.
- Express middleware: `createProfanityMiddleware` with field sanitization.

### Added (Phase 5)

- Benchmarks: `bench/perf.bench.ts` covering small/medium/large inputs.
- Release pipeline: GitHub Actions `release.yml` (publishes on tags `v*.*.*`).
- Documentation: Installation, Quick Start, API reference, Presets, Performance, Browser/SSR notes, and Mermaid diagram.

### Changed

- README: document dynamic loading, frameworks integration, technical pipeline, tuning presets, Phase 5 notes.
- README: add Aho–Corasick algorithm option and updated complexity, API (`setAlgorithm`).
- README: add Production setup guidance and updated Mermaid diagram for algorithm selection.

### Added

- Core: Implemented Aho–Corasick matcher at `src/core/aho.ts`.
- Config: `detection.algorithm` option `'trie' | 'aho'` (default `'trie'`).
- API: `setAlgorithm(algo)` to switch engines at runtime; rebuilds matchers per language.
- Presets: `lowLatencyPreset` now sets `algorithm: 'aho'` and disables inflections; `highRecallPreset` uses `'aho'` by default.
- Benchmarks: Added `bench/algorithm.bench.ts` comparing Aho–Corasick vs Trie; README includes sample results.
- Benchmarks: Added `bench/largeWordlist.bench.ts` generating synthetic 10k/100k dictionaries to illustrate scaling; README updated with results.

---

## [0.1.0-alpha.0] - 2025-08-13

### Added (Phase 1)

- Project scaffold: `package.json`, `tsconfig.json`, `tsup.config.ts`, `vitest.config.ts`, `.eslintrc.cjs`, `.prettierrc.json`, `.gitignore`, `.npmrc`, `LICENSE`, `SECURITY.md`, `CONTRIBUTING.md`, CI at `.github/workflows/ci.yml`.
- Core API: `src/index.ts` with `ProfanityBuster`, detection, masking, Levenshtein, config merge.
- Language pack seed: `src/languages/en.ts` English word list.
- Tests: `tests/basic.test.ts`; Bench: `bench/detect.bench.ts`.

### Changed (Phase 1)

- `README.md`: updated architecture, usage, build toolchain, license.
- Test runner: migrated to ESM config `vitest.config.mts` and removed coverage flag from npm script.
- ESLint: simplified resolver to Node-only and added overrides for tests/bench.
- Core detection: added Trie-based exact matching and normalization with `confusableMapping` (default true).
- Core detection: optional separator skipping via `ignoreSeparators` and diacritics/NFKC normalization toggles.
- `README.md`: added Technical Implementation section with performance/accuracy tuning guidance and presets; documented new detection settings.

### Fixed (Phase 1)

- N/A

### Removed (Phase 1)

- N/A

---

## [version] - YYYY-MM-DD

### Added (template)

- _(Feature details, file paths, UI changes, database changes)_

### Changed (template)

- _(What changed, why, and impact on other systems)_

### Fixed (template)

- _(Bug description, root cause, and fix method)_

### Removed (template)

- _(Removed items and reason)_

---

### Added (Phase 3)

- Dynamic language loading API: `loadLanguages([...])` with code-split ready dynamic imports.
- New language packs: Spanish (`es`), French (`fr`).

### Changed (Phase 3)

- README: documented dynamic language loading and updated language management.

### Fixed (Phase 3)

- N/A

### Removed (Phase 3)

- N/A

---

**Changelog Guidelines**:

1. **Be explicit** — name UI components, database tables, API routes, and logic changes.
2. **Link related commits/issues** — `(see commit #xxxx)`
3. **Update immediately** after every code change.
4. **Always note scope compliance** — mark if change is Phase 1, 2, or 3.
5. **Avoid vague terms** like "UI improved" or "Bug fixed" — describe the exact change.
