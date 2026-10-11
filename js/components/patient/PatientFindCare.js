// js/components/patient/PatientFindCare.js

import { Component } from "../../core/component.js";
import { h } from "../../utils/dom.js";
import TriageForm from "./TriageForm.js";
import DoctorList from "./DoctorList.js";
import DoctorProfile from "./DoctorProfile.js";
import BookingForm from "./BookingForm.js";

const icon = (paths, size = 18) => h("svg", { viewBox: "0 0 24 24", fill: "none", width: String(size), height: String(size), "aria-hidden": "true" }, ...paths.map(d => h("path", { d, stroke: "currentColor", "stroke-width": "1.8", "stroke-linecap": "round", "stroke-linejoin": "round" })));


export default class PatientFindCare extends Component {
    constructor(patient, pendingDoctorId) {
        super();
        this.patient = patient ?? {};
        this.pendingDoctorId = pendingDoctorId || null;

        this.step = "triage";

        this.triageResult = null;
        this.selectedDoctor = null;
        this.selectedService = null;
        this.completedBooking = null;
    }

    afterMount() {
        if (this.pendingDoctorId) {
            this.step = "doctor_profile";
            this.selectedDoctor = { doctor_id: this.pendingDoctorId };
            this.pendingDoctorId = null;
        }
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
            { class: "pfc-page" },
            h(
                "div",
                { class: "pfc-header" },
                h(
                    "button",
                    { class: "pfc-back-btn", type: "button", onclick: onBack },
                    icon(["M15 18l-6-6 6-6"], 16),
                    h("span", null, "Back")
                )
            ),
            h(
                "div",
                { class: "pfc-empty" },
                h(
                    "div",
                    { class: "pfc-empty-icon" },
                    icon(["M11 19a8 8 0 1 0 0-16 8 8 0 0 0 0 16", "M21 21l-4.35-4.35"], 22)
                ),
                h("h2", { class: "pfc-empty-title" }, title),
                h("p", { class: "pfc-empty-text" }, description),
                h("span", { class: "pfc-chip pfc-chip--info" }, "Coming soon")
            )
        );
    }
    renderConfirmation() {
        const doctorName = this.completedBooking?.doctor_name || "the doctor";
        return h(
            "div",
            { class: "pfc-page" },
            h(
                "div",
                { class: "pfc-confirm" },
                h(
                    "div",
                    { class: "pfc-confirm-icon" },
                    icon(["M20 6L9 17l-5-5"], 28)
                ),
                h("p", { class: "pfc-eyebrow" }, "Request sent"),
                h("h2", { class: "pfc-confirm-title" }, "Appointment requested"),
                h(
                    "p",
                    { class: "pfc-confirm-text" },
                    `Your appointment request with ${doctorName} has been sent.`
                ),
                h(
                    "div",
                    { class: "pfc-info-card" },
                    h(
                        "div",
                        { class: "pfc-info-icon" },
                        icon(
                            [
                                "M12 8v4l3 2",
                                "M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20"
                            ],
                            18
                        )
                    ),
                    h(
                        "p",
                        { class: "pfc-info-text" },
                        "The doctor will review your request and confirm the time. Once confirmed, you'll be able to complete payment for your consultation."
                    )
                ),
                h(
                    "button",
                    {
                        class: "pfc-primary-btn",
                        type: "button",
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
