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
