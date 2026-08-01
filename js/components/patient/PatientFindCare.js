// js/components/patient/PatientFindCare.js

import { Component } from "../../core/component.js";
import { h } from "../../utils/dom.js";
import TriageForm from "./TriageForm.js";
import DoctorList from "./DoctorList.js";
import DoctorProfile from "./DoctorProfile.js";
import BookingForm from "./BookingForm.js";

export default class PatientFindCare extends Component {
    constructor(patient) {
        super();
        this.patient = patient ?? {};

        this.step = "triage"; // "triage" | "doctors" | "doctor_profile" | "booking" | "confirmation"

        this.triageResult = null;
        this.selectedDoctor = null;
        this.selectedService = null;
        this.completedBooking = null;
    }

    afterMount() {
        this.updatePage();
    }

    // ---------- Step transitions ----------

    handleTriageContinue(result) {
        this.triageResult = result; // null if the patient chose "skip"
        this.step = "doctors";
        this.updatePage();
    }

    handleDoctorSelected(doctor) {
        this.selectedDoctor = doctor;
        this.step = "doctor_profile";
        this.updatePage();
    }
    handleProceedToBooking(doctorProfile, serviceId) {
        this.selectedDoctorProfile = doctorProfile;
        this.selectedService = serviceId;
        this.step = "booking";
        this.updatePage();
    }

    handleBackToDoctors() {
        this.selectedDoctor = null;
        this.selectedService = null;
        this.step = "doctors";
        this.updatePage();
    }

    handleProceedToBooking(service) {
        this.selectedService = service;
        this.step = "booking";
        this.updatePage();
    }

    handleBackToDoctorProfile() {
        this.step = "doctor_profile";
        this.updatePage();
    }

    handleBookingComplete(booking) {
        this.completedBooking = booking;
        this.step = "confirmation";
        this.updatePage();
    }

    startOver() {
        this.step = "triage";
        this.triageResult = null;
        this.selectedDoctor = null;
        this.selectedService = null;
        this.completedBooking = null;
        this.updatePage();
    }

    // ---------- Mounting ----------
    
    mountCurrentPage(container) {
        switch (this.step) {
            case "triage":
                new TriageForm(this.patient, (result) => this.handleTriageContinue(result)).mount(container);
                break;

            case "doctors":
                new DoctorList(
                    this.patient,
                    this.triageResult,
                    (doctor) => this.handleDoctorSelected(doctor),
                    () => this.startOver()
                ).mount(container);
                break;

            case "doctor_profile":
                new DoctorProfile(
                    this.patient,
                    this.selectedDoctor,
                    (profile, serviceId) => this.handleProceedToBooking(profile, serviceId),
                    () => this.handleBackToDoctors()
                ).mount(container);
                break;

            case "booking":
                new BookingForm(
                    this.patient,
                    this.selectedDoctor,
                    this.triageResult,
                    this.selectedService,
                    (booking) => this.handleBookingComplete(booking),
                    () => this.handleBackToDoctorProfile()
                ).mount(container);
                break;

            case "confirmation":
                container.replaceChildren(this.renderConfirmation());
                break;

            default:
                new TriageForm(this.patient, (result) => this.handleTriageContinue(result)).mount(container);
        }
    }

    updatePage() {
        if (!this.el) return;

        const container = this.el.querySelector("#patient-find-care-content");
        if (!container) return;

        this.mountCurrentPage(container);
    }

    // ---------- Render ----------

    render() {
        return h(
            "div",
            { class: "patient-find-care" },
            h("div", { id: "patient-find-care-content" })
        );
    }

    renderPlaceholder(title, description, onBack) {
        return h(
            "div",
            { class: "dashboard-page" },
            h(
                "section",
                { class: "dashboard-header" },
                h(
                    "button",
                    {
                        class: "btn btn-outline",
                        style: "padding: 0.4rem 0.6rem; font-size: 0.8rem; border-radius: 6px; margin-bottom: 10px;",
                        onclick: onBack,
                    },
                    "← Back"
                ),
                h("h1", { class: "dashboard-title" }, title)
            ),
            h(
                "div",
                { class: "dashboard-card text-center py-4" },
                h("p", { class: "dashboard-muted" }, description),
                h("p", { class: "dashboard-muted", style: "margin-top: 6px; font-size: 0.8rem;" }, "Coming soon.")
            )
        );
    }

    renderConfirmation() {
        return h(
            "div",
            { class: "dashboard-page" },
            h(
                "section",
                { class: "dashboard-header" },
                h("h1", { class: "dashboard-title" }, "Appointment requested")
            ),
            h(
                "div",
                { class: "dashboard-card", style: "padding: 1.1rem; display: flex; flex-direction: column; gap: 10px;" },
                h(
                    "p",
                    { style: "margin: 0; font-size: 0.92rem;" },
                    `Your appointment request with ${this.completedBooking?.doctor_name || "the doctor"} has been sent.`
                ),
                h(
                    "button",
                    {
                        class: "btn btn-primary",
                        style: "padding: 0.6rem 1rem; font-size: 0.88rem; border-radius: 8px;",
                        onclick: () => this.startOver(),
                    },
                    "Find another doctor"
                )
            )
        );
    }

    update() {
        if (!this.el) return;
        const newTree = this.render();
        this.el.replaceChildren(...(Array.isArray(newTree) ? newTree : [newTree]).flat());
        this.updatePage();
    }
}
