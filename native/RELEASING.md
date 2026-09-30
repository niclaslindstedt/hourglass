# Releasing the native app

Builds run on **EAS Build** (Expo's infrastructure), not on GitHub's runners
and not on a laptop. Everything below is a one-time setup followed by a
one-click dispatch.

## One-time setup

### 1. The Expo project

```sh
cd native
npx eas-cli login
npx eas-cli init          # prints the project id
```

`eas init` normally writes the id into `app.json` — this app uses a **dynamic**
config (`app.config.js`), which it cannot write to, so the id is passed in
instead:

- **CI**: set it as the repository **secret** `EAS_PROJECT_ID`
  (Settings → Secrets and variables → Actions → Secrets).
- **Locally**: `native/.env` (`cp .env.example .env`).

### 2. The CI token

Create a **robot** access token at
`https://expo.dev/accounts/<account>/settings/access-tokens` — a robot cannot
sign in to the dashboard and owns no projects, so its blast radius is bounded —
and set it as the repository **secret** `EXPO_TOKEN`.

### 3. The identity

The bundle id and the listing's name are configuration, not source:
`identifiers.js` reads `APP_BUNDLE_ID` and `APP_DISPLAY_NAME`, and a plain
checkout falls back to `dev.local.hourglass` and `Hourglass`. Set both as
repository **secrets** (and in `native/.env` locally); the store build is
`se.agilator.hourglass`, and `make store-preflight` refuses a fallback that
would reach an upload.

### 4. Store credentials

EAS holds these on the project, not in this repo:

```sh
npx eas-cli credentials          # iOS signing + Android keystore
```

For submission, fill in the placeholders in `eas.json` →
`submit.production`:

| Field                       | Where it comes from                                                                                                                                                                                                                                        |
| --------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Apple ID (not committed)    | Asked for by `eas submit` when it signs in; never written into `eas.json`.                                                                                                                                                                                 |
| `ascAppId`                  | App Store Connect → the app → App Information → **Apple ID** (digits). Add it under `submit.production.ios` once the app record exists; until then the key is absent, not a placeholder — `eas submit` rejects placeholder values before it does anything. |
| `appleTeamId`               | developer.apple.com → Membership details → **Team ID** (10 characters). Added beside `ascAppId`.                                                                                                                                                           |
| `play-service-account.json` | Play Console → Setup → API access → a service account key. Gitignored; upload it to EAS with `eas credentials` rather than committing it.                                                                                                                  |

The app declares no iCloud container, no App Group and no entitlement beyond
the defaults: there is no document to keep. The only permission it asks for
is the motion sensor, from the page, the first time the glass is pressed.

## Cutting a build

Dispatch **Actions → native → Run workflow** and pick:

| Input      | Meaning                                                                                                                                |
| ---------- | -------------------------------------------------------------------------------------------------------------------------------------- |
| `platform` | `ios` (the default), `android` or `all`.                                                                                               |
| `profile`  | `development` (dev client), `preview` (internal, APK + simulator), `testflight` (store-signed, still ours), `production` (what ships). |
| `submit`   | Also submit to the stores. Refused on anything but `production`.                                                                       |

The job builds the web app, packs it into `native/assets/webroot.zip`, and
queues the build on EAS with `--no-wait` — it exits immediately, so watch the
build itself at <https://expo.dev>.

The **marketing version** comes from the repo root's `package.json`, so the app
and the website never disagree about which release they are. Store **build
numbers** are auto-incremented by EAS (`appVersionSource: remote`); nothing is
bumped by hand.

## Doing it from a laptop instead

```sh
cd native
npm ci
npm run build:preview        # internal build
npm run build:testflight     # store-signed, to TestFlight
npm run build:production     # what ships
npm run submit
```

Each of those bundles the web app first — the wrapper serves that copy, and a
build without it launches to a blank screen.

## Checklist before a store build

- [ ] `make lint && make test && make build` is green at the repo root.
- [ ] `make native-typecheck` is green.
- [ ] `EXPO_PUBLIC_HOURGLASS_URL` is **unset** — a build that streams the
      website is the exact shape App Store guideline 4.2 rejects.
- [ ] The version in the root `package.json` is the one you mean to ship.
- [ ] On a real device in airplane mode: the app opens, the glass turns, the
      sand runs, and the light comes up when it has run out.
- [ ] Turning the phone over turns the sand the other way, after the motion
      sensor has been allowed from the first press on the glass; refusing it
      leaves the glass turning by tap alone, with the setting saying so.
- [ ] The screen stays on while the sand runs, and the buzz comes when it
      has run out.
