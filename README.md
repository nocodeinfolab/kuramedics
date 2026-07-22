# KuraMedics — Frontend SPA (Vanilla JS)

A component-based, build-tool-free single page app for KuraMedics. Every
feature of the product lives in its own component file, mounted through a
tiny router. No framework, no bundler required — open `index.html` through
any static server (or `npx serve`) and it runs, because the browser's native
ES modules do the wiring.

## Why this structure

- **One feature = one file.** Each screen (landing, patient dashboard, doctor
  queue, etc.) is its own component module in `js/components/<area>/`. You
  can build, review, and ship them one at a time without touching unrelated
  code.
- **No build step.** Everything is native ESM (`<script type="module">`,
  `import`/`export`). This keeps the project easy to preview instantly and
  easy to hand off. If the project later needs bundling/minification for
  production, the module boundaries already make that a drop-in step.
- **Small, shared core.** `js/core/component.js` gives every component a
  consistent `mount()`/`unmount()` lifecycle. `js/core/router.js` is a
  minimal hash router so we can add authenticated areas (doctor dashboard,
  patient portal) later without a rewrite.

## Structure

```
kuramedics-frontend/
├── index.html                  Shell: loads fonts, css, mounts #app, boots router
├── css/
│   ├── tokens.css              Design tokens (color, type, spacing, radius)
│   ├── base.css                Reset + shared primitives (buttons, container, badges)
│   └── landing.css             Styles scoped to the landing page
├── js/
│   ├── app.js                  Registers routes, starts the router
│   ├── core/
│   │   ├── component.js        Base Component class (mount/unmount lifecycle)
│   │   └── router.js           Minimal hash-based router
│   ├── utils/
│   │   └── dom.js              `h()` helper for building DOM without HTML strings
│   └── components/
│       ├── shared/
│       │   ├── Navbar.js       Top nav, reused across public pages
│       │   └── Footer.js       Site footer
│       └── landing/
│           └── LandingPage.js  The landing page component (this milestone)
```

## Conventions for new components

1. One component per file, default export a class extending `Component`.
2. Build markup with the `h()` helper from `js/utils/dom.js` — no innerHTML
   string templates, so there's no XSS foot-gun and no build step needed for
   JSX.
3. Component-specific styles go in their own CSS file under `css/`, named
   after the component/area (e.g. `css/doctor-dashboard.css`), and linked in
   `index.html`. Shared/reusable styles (buttons, cards, badges) belong in
   `css/base.css`.
4. Register new pages/routes in `js/app.js`.
5. Keep components dumb where possible — data fetching for authenticated
   areas will live in `js/services/*.js` (to be added when we build the
   auth-backed screens), not inside the component files themselves.

## Design system quick reference

- Colors, type, spacing and radius are all CSS custom properties in
  `css/tokens.css` — change the look of the whole app from one file.
- Primary brand color is deep purple (`--color-primary`), background is
  white/off-white. Headlines use the display serif (`--font-display`),
  everything else uses the body sans (`--font-body`), and small
  data/label text (specialties, verification tags, stats) uses the mono
  face (`--font-mono`) as a deliberate "clinical precision" accent.

## Running locally

Any static file server works, e.g.:

```
npx serve kuramedics-frontend
# or
python3 -m http.server --directory kuramedics-frontend 8080
```

Then open the printed URL. No install, no build.

## What's next

This milestone ships the landing page only. Next up (one at a time, as
planned): auth (doctor/patient login + signup), then the patient AI-triage
flow, then the doctor dashboard shell with its sub-features (consultation
queue, patient records, secure messaging, consultations, financial summary,
billing, settings).
