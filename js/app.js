import { registerRoute, startRouter } from "./core/router.js";
import { LandingPage } from "./components/landing/LandingPage.js";

// Public landing page — the only route that exists today. New
// features/pages register themselves here the same way as they're built,
// e.g.:
//   registerRoute("/login/patient", () => new PatientLoginPage());
//   registerRoute("/login/doctor", () => new DoctorLoginPage());
//   registerRoute("/doctor/dashboard", () => new DoctorDashboardPage());
registerRoute("/", () => new LandingPage());

startRouter();
