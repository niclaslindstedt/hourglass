# The desktop app

Hourglass runs in any browser, and it installs to a home screen or a dock as a
Progressive Web App. There is a third way to have it: a proper desktop
download for **Windows, macOS and Linux**, attached to every release on the
[releases page](https://github.com/niclaslindstedt/hourglass/releases).

## Which file

Pick the one for your machine — the app inside all three is the same app.

- **Windows** — the `.exe` installer.
- **macOS** — the `.dmg`. The release notes say whether it is notarized by
  Apple; if it is, it opens like any other app. If it is signed but not
  notarized, the first launch is refused: open **System Settings → Privacy &
  Security**, scroll to the message about the app and choose **Open Anyway**.
  macOS remembers after that.
- **Linux** — the `.AppImage` runs on anything without installing; the `.deb`
  is for Debian and Ubuntu.

## What is different from the browser

Almost nothing, deliberately. The desktop app is the website with a window
around it: the same glass, the same ten looks, the same settings. Two
differences are worth knowing about.

**It needs no network at all.** The whole app is inside the download rather
than fetched and cached, so a first launch on a machine that has never been
online works exactly like a hundredth launch.

**It updates by being replaced.** There is no "a new version is ready" prompt in
here, because there is no deploy for it to notice — a new version is a new
download from the releases page.

A desk has no motion sensor, so the glass turns by a click alone; the wheel
and the arrow keys set the length.

## Where the settings live

In the app, on your machine, the same way they do in a browser tab — and in a
different place from the browser's. The desktop app has storage of its own,
so the glass you set up in Chrome is not the one the desktop app opens.
Uninstalling the app removes that storage with it; there is nothing else to
lose.
