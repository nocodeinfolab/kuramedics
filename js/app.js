import { registerRoute, startRouter } from "./core/router.js";

import { LandingPage } from "./components/landing/LandingPage.js";
import { PatientLoginPage } from "./components/auth/PatientLoginPage.js";
import { DoctorLoginPage } from "./components/auth/DoctorLoginPage.js";

registerRoute("/", () => new LandingPage());

registerRoute("/patient/login", () => new PatientLoginPage());

registerRoute("/doctor/login", () => new DoctorLoginPage());

startRouter();
