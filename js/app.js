import { registerRoute, startRouter } from "./core/router.js";
import { LandingPage } from "./components/landing/LandingPage.js";
import { PatientLoginPage } from "./components/auth/PatientLoginPage.js";
import { DoctorLoginPage } from "./components/auth/DoctorLoginPage.js";
import { AdminLoginPage } from "./components/auth/AdminLoginPage.js";
import DoctorDashboardPage from "./components/doctor/DoctorDashboardPage.js";
import PatientDashboardPage from "./components/patient/PatientDashboardPage.js";
import AdminDashboardPage from "./components/admin/AdminDashboardPage.js";
import PrescriptionVerificationPage from "./components/public/PrescriptionVerificationPage.js";
import PublicDoctorProfilePage from "./components/public/PublicDoctorProfilePage.js";
import { initUpdater } from "./services/otaUpdater.js";

registerRoute("/", () => new LandingPage());
registerRoute("/patient/login", () => new PatientLoginPage());
registerRoute("/doctor/login", () => new DoctorLoginPage());
registerRoute("/admin/login", () => new AdminLoginPage());
registerRoute("/doctor/dashboard", () => new DoctorDashboardPage());
registerRoute("/patient/dashboard", () => new PatientDashboardPage());
registerRoute("/admin/dashboard", () => new AdminDashboardPage());
registerRoute("/verify/prescription/:id", (params) => new PrescriptionVerificationPage(params.id));
registerRoute("/doctor/:id", (params) => new PublicDoctorProfilePage(params.id));
startRouter();

// Fire-and-forget: checks for an OTA update in the background. Never
// awaited here, and internally never throws — a slow or failed update
// check must not delay or break the app's first render.
initUpdater();
