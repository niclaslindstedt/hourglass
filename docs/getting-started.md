# Getting started

Hourglass is a local-first timer that is an hourglass. There is nothing to
sign up for and nothing to install beyond the app itself.

## Run it locally

```sh
npm config set //npm.pkg.github.com/:_authToken <your-token>
git clone https://github.com/niclaslindstedt/hourglass.git
cd hourglass
npm install
npm run dev
```

The token needs the `read:packages` scope — the
`@niclaslindstedt/oss-framework` dependency comes from GitHub Packages, which
requires authentication even for public packages.

The app also ships as a phone app through [`native/`](../native/README.md)
and as a desktop download through [`tauri/`](../tauri/README.md).

## Your first glass

1. The app opens on the glass, standing with its sand run out — a
   five-minute glass, the way one is picked up off a shelf.
2. Drag up on it for a longer glass, down for a shorter one. The length
   shows for a moment while you drag, and the glass grows or shrinks with it:
   a two-hour glass takes the whole screen, a one-minute one a little under
   half of it.
3. Tap the glass. It turns over, the heaps drop onto their new floors, and
   the sand runs.
4. Leave it. The screen stays on while the sand runs (a setting), and the
   glass keeps running in a background tab or a pocket, because the run is
   read off the clock rather than counted in frames.
5. When the last of the sand is through, a soft light comes up behind the
   glass and the device buzzes if it can. Tap the glass to turn it over and
   run it again.

Tapping a glass that is still running turns it over too: what had run through
is what is now left to run, which is how a real one works.

On a phone, turning the phone upside down turns the sand the other way without
turning the picture — see [`features/hourglass.md`](features/hourglass.md).

## The other nine

The cog in the corner opens Settings. Under **The hourglass** are ten presets
— each a frame, a glass and a sand — and **Custom**, which puts one together
piece by piece. See [`features/looks.md`](features/looks.md).

## Where the data lives

In your browser's localStorage, on this device: the settings, and where the
sand stood when the glass was last turned. There is nothing else, and nothing
is sent anywhere.
