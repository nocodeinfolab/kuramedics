# YerosCare — Frontend SPA (Vanilla JS)

A component-based, build-tool-free single page app for YerosCare. Every
feature of the product lives in its own component file, mounted through a
tiny router. No framework, no bundler required — open `index.html` through
any static server (or `npx serve`) and it runs, because the browser's native
ES modules do the wiring.

## Why this structure

- **One feature = one file.** Each screen (landing, patient dashboard, doctor
  dashboard, settings, etc.) is its own component module in
  `js/components/<area>/`. You can build, review, and ship them one at a
  time without touching unrelated code.
- **No build step.** Everything is native ESM (`<script type="module">`,
  `import`/`export`). This keeps the project easy to preview instantly and
  easy to hand off.
- **Small, shared core.** `js/core/component.js` gives every component a
  consistent `mount()`/`unmount()` lifecycle. `js/core/router.js` is a
  minimal hash router used for both public routes and the authenticated
  doctor/patient areas.

## Structure

```
yeroscare-frontend/
├── index.html                          Shell: loads fonts, css, mounts #app, boots router
├── css/
│   ├── tokens.css                      Design tokens (color, type, spacing, radius)
│   ├── base.css                        Reset + shared primitives (buttons, container, badges)
│   ├── landing.css                     Styles scoped to the landing page
│   ├── auth.css                        Styles scoped to login pages
│   ├── doctor-dashboard.css            Styles scoped to the doctor dashboard
│   └── patient-dashboard.css           Styles scoped to the patient dashboard
├── js/
│   ├── app.js                          Registers top-level routes, starts the router
│   ├── core/
│   │   ├── component.js                Base Component class (mount/unmount lifecycle)
│   │   └── router.js                   Hash-based router (public + authenticated routes)
│   ├── utils/
│   │   └── dom.js                      `h()` helper for building DOM without HTML strings
│   ├── services/
│   │   ├── api.js                      Shared fetch wrapper
│   │   ├── doctorProfileService.js     Doctor profile reads/writes
│   │   ├── doctorConsultationService.js Consultation-related requests
│   │   └── doctorSubscriptionService.js Subscription/billing requests
│   └── components/
│       ├── shared/
│       │   ├── Navbar.js               Top nav, reused across public pages
│       │   ├── Footer.js               Site footer
│       │   └── VideoCallRoom.js        Consultation video call UI
│       ├── landing/
│       │   └── LandingPage.js
│       ├── auth/
│       │   ├── PatientLoginPage.js
│       │   ├── DoctorLoginPage.js
│       │   └── GoogleAuth.js
│       ├── public/
│       │   ├── PublicDoctorProfilePage.js   Shareable doctor profile (unauthenticated)
│       │   └── PrescriptionVerificationPage.js  QR-linked prescription verification
│       ├── doctor/
│       │   ├── DoctorDashboardPage.js
│       │   ├── DashboardHome.js
│       │   ├── consultations/
│       │   │   └── ConsultationQueue.js
│       │   ├── finance/
│       │   │   └── FinancialSummary.js
│       │   ├── messaging/
│       │   │   └── MessagingPage.js
│       │   ├── patients/
│       │   │   └── PatientRecords.js
│       │   └── settings/
│       │       ├── SettingsPage.js
│       │       ├── DoctorProfilePage.js
│       │       ├── DoctorCardPage.js         Shareable doctor card (image + link)
│       │       ├── DoctorConsultationServicesPage.js
│       │       └── DoctorSubscriptionPage.js
│       └── patient/
│           ├── PatientDashboardPage.js
│           ├── DoctorList.js
│           ├── DoctorProfile.js
│           ├── BookingForm.js
│           ├── PatientCare.js
│           ├── PatientFindCare.js
│           ├── TriageForm.js             Used by PatientFindCare — the single source of truth
│           ├── PatientMessaging.js
│           └── PatientProfilePage.js
```

> **Note:** the backend (Node/Express API, PDF generation, doctor card image
> generation, PostgreSQL access) lives in a separate repository — this repo
> is frontend only.

## Conventions for new components

1. One component per file, default export a class extending `Component`.
2. Build markup with the `h()` helper from `js/utils/dom.js` — no innerHTML
   string templates, so there's no XSS foot-gun and no build step needed for
   JSX.
3. Component-specific styles go in their own CSS file under `css/`, named
   after the component/area (e.g. `css/doctor-dashboard.css`), and linked in
   `index.html`. Shared/reusable styles (buttons, cards, badges) belong in
   `css/base.css`.
4. Register new **top-level** pages/routes in `js/app.js`. Nested screens
   inside an authenticated area (e.g. doctor settings sub-pages) are mounted
   by their parent page component instead of being separate routes.
5. Keep components dumb where possible — data fetching lives in
   `js/services/*.js`, not inside the component files themselves.
6. State changes are manual: mutating a component's properties does nothing
   on its own — always follow a state change with `this.update()`, or the
   DOM will silently go stale. Prefer batching related mutations together
   before a single `update()` call rather than sprinkling several calls
   through one method.

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
npx serve yeroscare-frontend
# or
python3 -m http.server --directory yeroscare-frontend 8080
```

Then open the printed URL. No install, no build.

## Known cleanup item

`js/components/patient/findcare/TriageForm.js` is a stale duplicate — the
version actually imported by `PatientFindCare.js` is
`js/components/patient/TriageForm.js`. The `findcare/` copy isn't referenced
anywhere and can be safely deleted.

## What's next

Landing, auth (doctor/patient login + Google auth), public doctor profiles,
prescription verification, the patient triage/booking flow, and the doctor
dashboard (consultations, patient records, messaging, financial summary,
subscription, and settings including the shareable doctor card) are all
implemented. Next up: [fill in current priorities].
