.PHONY: demo build test lint fmt fmt-check actionlint release clean docs website website-dev install icons changelog bump shots blender native-install native-bundle native-typecheck native-prebuild store-preflight store-metadata store-upload tauri tauri-bundle tauri-clean tauri-fast tauri-fmt tauri-fmt-check tauri-install tauri-lint tauri-package tauri-package-debug tauri-test

build:
	npm run build

test:
	npm test

lint:
	npm run lint

fmt:
	npm run fmt

fmt-check:
	npm run fmt:check

release:
	npm run build

clean:
	rm -rf dist node_modules

install:
	npm install

# The dev server on the demo: a glass part way through a half-hour run, held
# in memory, nothing read from or written to this browser (src/app/dev/).
demo:
	VITE_SEED=demo npm run dev

# Regenerate the PWA install icons + the Open Graph image from the app mark.
icons:
	npm run icons

# Pictures of the glass in a few states, into shots/, for iterating on its
# look. Builds first, so the picture is of the code as it is. Pass the
# script's options through ARGS: `make shots ARGS="--preset all --theme light"`.
# Needs playwright, installed outside the lockfile — the script says how.
shots:
	npm run build && node --experimental-strip-types --disable-warning=ExperimentalWarning scripts/glass-shots.mjs $(ARGS)

# The modelled parts: every frame and every glass built in Blender off
# look.ts and photographed by the app's own camera into public/models/, the
# sprites paint.ts composites (scripts/blender.mjs, the blender-assets
# skill). Needs Blender as python3's `bpy` module (`pip install bpy`) or on
# the PATH, and fetches its CC0 textures into .cache/ the first time. Pass
# the script's options through ARGS: `make blender ARGS="--top walnut"`.
blender:
	node --experimental-strip-types --disable-warning=ExperimentalWarning scripts/blender.mjs $(ARGS)

# --- the native wrapper (native/) -------------------------------------------
#
# A thin Expo/React Native shell that bundles this web app and serves it in a
# WebView. It has its OWN dependency tree — `make install` at the root does
# not touch it — so every target here reaches in with `--prefix native`. Store
# builds run on EAS, by manual dispatch: .github/workflows/native.yml; see
# native/RELEASING.md.

native-install:
	npm --prefix native install

# Build the web app and pack it into native/assets/webroot.zip — the copy the
# wrapper serves. Required before any native build; CI does it for you.
native-bundle:
	npm --prefix native run bundle

native-typecheck:
	npm --prefix native run typecheck

# Regenerate native/ios and native/android from app.config.js and the config
# plugins. Both are gitignored build output — this is only for inspecting what
# the plugins produce.
native-prebuild:
	npm --prefix native run prebuild

actionlint:
	actionlint -color

docs:
	@echo "see docs/"

# The app IS the website: pages.yml builds it with the Pages base path and
# deploys dist/. These targets mirror that for local inspection.
website:
	VITE_BASE=/ npm run build

website-dev:
	npm run dev

# Local preview of what the Release workflow will write to CHANGELOG.md.
# Pass the planned version: `make changelog VERSION=0.2.0`. Consumes the
# fragments in .changes/unreleased/ — run inside a scratch branch or
# revert afterwards if you only wanted a preview.
changelog:
	@test -n "$(VERSION)" || { \
		echo "usage: make changelog VERSION=X.Y.Z"; exit 2; \
	}
	node scripts/release/collate-changelog.mjs $(VERSION)

# Print the semver bump (patch/minor/major) the Release workflow will
# auto-derive from the current .changes/unreleased/ fragments. Read-only.
bump:
	@node scripts/release/compute-bump.mjs

# ---------------------------------------------------------------------------
# SHIPPING TO THE STORE (native/store/)
# ---------------------------------------------------------------------------
# One authored listing compiles into the files the upload tools read. The
# RULES are committed; the WORDS are not — see native/store/README.md.

# "Is this checkout wired up to ship?" — every gate between here and a
# submission, what is missing and where to get it.
store-preflight:
	@node --experimental-strip-types --disable-warning=ExperimentalWarning \
		scripts/store-preflight.mjs $(ARGS)

# Compile the listing. `ARGS="--check"` validates without writing.
store-metadata:
	node --experimental-strip-types --disable-warning=ExperimentalWarning \
		scripts/generate-store-metadata.mjs $(ARGS)

# Upload the listing — text and the screenshots staged in
# native/store/screenshots/en-US/ — to App Store Connect with fastlane
# deliver. Compiles first, in the same environment, so what goes up is what
# the copy says now. Reads the API key, APP_BUNDLE_ID and APP_DISPLAY_NAME
# from native/.env or the environment (see native/.env.example), and refuses
# without a listing name. Never submits for review and never uploads a binary.
store-upload:
	@set -a; [ -f native/.env ] && . native/.env; set +a; \
	if [ -z "$$APP_DISPLAY_NAME" ] || [ -z "$$APP_BUNDLE_ID" ]; then \
		echo "store-upload: set APP_DISPLAY_NAME and APP_BUNDLE_ID (native/.env)" >&2; exit 1; fi; \
	node --experimental-strip-types --disable-warning=ExperimentalWarning \
		scripts/generate-store-metadata.mjs && \
	cd native && fastlane listing

# The desktop shell (tauri/) — a thin Tauri wrapper around this same app.
#
# It has its own toolchain, so `make test` and `make lint` deliberately stop at
# its edge and these targets are how it is reached instead;
# .github/workflows/desktop-tauri.yml runs the two check targets on every push
# that touches it. Needs a Rust toolchain (https://rustup.rs) plus the
# platform's webview development libraries — see tauri/README.md.

# Build the site into tauri/webroot/, compile the shell, and run it.
tauri:
	npm run tauri

# The same, WITHOUT rebuilding the site — it re-copies whatever dist/ holds.
tauri-fast:
	npm run tauri:fast

# The site, bundled into the shell, without launching anything.
tauri-bundle:
	npm run tauri:bundle

# The shell's own npm tooling (the Tauri CLI).
tauri-install:
	npm run tauri:install

# The decision layer. Needs no GUI libraries at all.
tauri-test:
	npm run tauri:test

# clippy at zero warnings, BOTH crates (this one does need the libraries).
tauri-lint:
	npm run tauri:lint

tauri-fmt:
	npm run tauri:fmt

tauri-fmt-check:
	npm run tauri:fmt:check

# The installers for THIS machine's platform, into tauri/target/release/bundle.
tauri-package:
	npm run tauri:package -- $(ARGS)

# The same, built with the debug profile: minutes faster, much bigger.
tauri-package-debug:
	npm run tauri:package:debug -- $(ARGS)

# `cargo clean`.
tauri-clean:
	npm run tauri:clean
