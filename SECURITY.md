# Security policy for hourglass

## Supported versions

The latest release line on `main` receives security fixes. Older lines are
considered end-of-life.

## Reporting a vulnerability

**Do not open public GitHub issues for security problems.**

Instead, please report privately via [GitHub Security Advisories](https://github.com/niclaslindstedt/hourglass/security/advisories/new),
or by email to `niclas@agilator.se`.

## Response

We aim to acknowledge reports within 72 hours and provide a triage update
within 7 days.

## Disclosure

We follow coordinated disclosure: we will agree on a release window with the
reporter and credit them in the release notes (unless they request otherwise).

## Scope

In scope: any vulnerability in the published release of hourglass. The app
keeps nothing but its settings and sends nothing anywhere, so what matters
most is that this stays true: any path by which the app would make a network
request, keep a sensor reading (`src/app/useGravity.ts`), or run code it did
not ship with — the service worker's precache, the wrappers' bundled webroot —
is in scope. Out of scope: the browser's own storage isolation.
