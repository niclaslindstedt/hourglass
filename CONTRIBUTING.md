# Contributing to hourglass

Thanks for your interest! This document describes how to set up a dev
environment, the conventions we follow, and how to get a change merged.

## Prerequisites

- Node.js ≥ 22 (CI pins 24 — see `.nvmrc`), npm ≥ 10
- A GitHub personal access token with `read:packages` in `~/.npmrc` — the
  `@niclaslindstedt/oss-framework` dependency resolves from GitHub Packages
  (see the README's Install section)

## Getting the source

```sh
git clone https://github.com/niclaslindstedt/hourglass.git
cd hourglass
npm install
```

## Build, test, lint

```sh
make build
make demo         # the dev server on the demo run (VITE_SEED=demo)
make test
make lint
make fmt-check
make shots-warm   # a browser for the screenshots, and the build, ahead of time
make shots        # contact sheets of the glass (ARGS="…" for the screenshot skill's options)
```

The native wrapper in `native/` is a separate npm project with its own
dependency tree — `npm install` at the root does not touch it:

```sh
make native-install      # install its dependencies
make native-bundle       # build the web app into native/assets/webroot.zip
make native-typecheck    # what CI's `native` job runs, with `npx expo-doctor` in native/
```

Store builds run on EAS by manual dispatch; see
[`native/RELEASING.md`](native/RELEASING.md).

The desktop shell in `tauri/` is a Rust project with its own toolchain:
`make tauri-test` runs its decision layer with no GUI libraries, and
`make tauri-lint` needs them. See [`tauri/README.md`](tauri/README.md).

The frames and the glasses are modelled in Blender off the app's own data:
`make blender` regenerates `public/models/` (Blender as the `bpy` Python
module, or on the PATH; the CC0 textures are fetched once into `.cache/`).
The painter draws its own plainer parts wherever a sprite is missing, so a
checkout builds and runs without Blender. See the `blender-assets` skill.

A change to how the glass draws is judged by eye. `make shots` photographs
the real app in headless Chromium and lays the frames out on contact sheets
in `.agents/skills/screenshot/out/latest/` — devices × themes × variants ×
screens (see the `screenshot` skill for the options, among them
`--variant presets`, `--theme both`, `--screen settings` and
`--screen upside`, and `--settings '<json>'` for any settings patch). It
builds only when the sources moved. `make shots-warm` does a first run's slow
parts ahead of time: it finds or installs a `playwright-core` and its
Chromium (neither is a dependency of the app) and makes the build. WebGL
runs on the CPU there (SwiftShader), about twenty seconds a frame.

## Development workflow

1. Fork the repo.
2. Create a topic branch: `git checkout -b feat/<slug>` or `fix/<slug>`.
3. Make focused commits using [Conventional Commits](https://www.conventionalcommits.org/):
   ```
   <type>(<scope>): <summary>
   ```
   Types: `feat`, `fix`, `perf`, `docs`, `test`, `refactor`, `chore`, `ci`,
   `build`, `style`. Breaking changes: `<type>!:` or `BREAKING CHANGE:` footer.
4. If the change is user-visible, add a changelog fragment under
   `.changes/unreleased/` (CI enforces this via the `changeset` job):

   ```
   .changes/unreleased/$(date +%s)-short-slug.md
   ---
   type: Added        # Added | Changed | Fixed | Removed | Security | Deprecated
   breaking: true     # optional — forces a major release
   ---

   One line users will read in the changelog.
   ```

   Pure refactors, CI/build tweaks, and docs-only PRs are exempt (skip-list in
   `scripts/release/check-changeset.mjs`); or label the PR `no-changelog` to opt
   out. `version-bump.yml` collates these into `CHANGELOG.md` and derives the
   semver bump — run `make bump` to preview it.

5. Open a PR. The **PR title** must be conventional-commit format because we
   squash-merge and that title becomes the commit message on `main`.
6. CI must be green and at least one reviewer must approve.

## Tests

Tests live in `tests/` with a `_test` suffix and cover the pure modules — the
glass's geometry, the sand and its physics, the heap's mesh, the timer, the
sky and the sun and the moon, how the glass hangs, the look vocabulary, the
settings parser, the sensor's readings, the demo — and the strings the wrappers and the app
have to agree on. Run one file with `npx vitest run tests/sand_test.ts`. UI
changes should keep the boot smoke path working: `npm run build && npm run
preview`, tap the glass, and check that the sand runs and the frame turns.

The model is deliberately clock-free — `now` and `dt` are parameters, never
`Date.now()` inside `timer.ts`, `sand.ts`, `physics.ts`, `view.ts`, `sky.ts`
or `astronomy.ts` — so a test never needs fake timers. Keep it that way.

## Documentation

If your change touches user-visible behavior, update the relevant `docs/`
topic and the README quick start. See `AGENTS.md` for the full sync table.

## Governance

This is a single-maintainer project: [@niclaslindstedt](https://github.com/niclaslindstedt)
merges PRs and makes final decisions. Disputes are resolved in the PR thread;
sustained, high-quality contributions are the path to being invited as a
maintainer. If the project is abandoned, the license permits noncommercial
forks — open an issue first so a successor can be blessed.

## Code of Conduct

By participating you agree to abide by the [Code of Conduct](CODE_OF_CONDUCT.md).

## Reporting security issues

See [SECURITY.md](SECURITY.md). Do **not** open public issues for security
problems.
