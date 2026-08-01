// js/components/patient/BookingForm.js

import { Component } from "../../core/component.js";
import { h } from "../../utils/dom.js";
import api from "../../services/api.js";

export default class BookingForm extends Component {
    /**
     * @param {object} patient
     * @param {object} doctor - selected doctor, at minimum { doctor_id, full_name }
     * @param {object|null} triageResult - result from TriageForm, or null if skipped
     * @param {(booking: object) => void} onBookingComplete
     * @param {() => void} onBack
     */
    constructor(patient, doctor, triageResult, onBookingComplete, onBack) {
        super();
        this.patient = patient ?? {};
        this.doctor = doctor ?? {};
        this.triageResult = triageResult ?? null;
        this.onBookingComplete = onBookingComplete;
        this.onBack = onBack;

        this.loading = true;
        this.loadError = "";

        this.doctorProfile = null;
        this.services = [];

        this.selectedServiceId = "";
        this.feeType = "first_time";
        this.bookingDate = "";
        this.consentGiven = false;
        this.emergencyAcknowledged = false;

        this.submitting = false;
        this.submitError = "";
    }

    async afterMount() {
        await this.loadDoctorProfile();
    }

    // ---------- Data loading ----------

    async loadDoctorProfile() {
        this.loading = true;
        this.loadError = "";
        this.update();

        try {
            const res = await api.get(`/directory/${this.doctor.doctor_id}`);
            const profile = res.data || res;
            this.doctorProfile = profile;
            this.services = profile.services || [];

            if (this.services.length === 1) {
                this.selectedServiceId = this.services[0].id;
            }
        } catch (error) {
            console.error("Failed to load doctor profile:", error);
            this.loadError = error.message || "Failed to load this doctor's details.";
        } finally {
            this.loading = false;
            this.update();
        }
    }

    // ---------- Derived ----------

    getSelectedService() {
        return this.services.find(s => s.id === this.selectedServiceId) || null;
    }

    getSelectedPrice() {
        const service = this.getSelectedService();
        if (!service) return null;
        return this.feeType === "follow_up"
            ? service.follow_up_price_amount
            : service.first_time_price_amount;
    }

    buildReasonText() {
        if (!this.triageResult) return "";

        const parts = [];
        if (this.triageResult.symptoms?.length) {
            parts.push(`Symptoms: ${this.triageResult.symptoms.join(", ")}`);
        }
        if (this.triageResult.duration) {
            parts.push(`Duration: ${this.triageResult.duration}`);
        }
        if (this.triageResult.patient_summary) {
            parts.push(`Notes: ${this.triageResult.patient_summary}`);
        }
        if (this.triageResult.urgency_level) {
            parts.push(`Urgency: ${this.triageResult.urgency_level}`);
        }
        return parts.join(" | ");
    }

    isFormValid() {
        return (
            this.selectedServiceId &&
            this.bookingDate &&
            this.consentGiven &&
            this.emergencyAcknowledged
        );
    }

    // ---------- Actions ----------

    setField(field, value) {
        this[field] = value;
        this.update();
    }

    async submitBooking() {
        if (!this.isFormValid() || this.submitting) return;

        this.submitting = true;
        this.submitError = "";
        this.update();

        try {
            const res = await api.post("/bookings", {
                doctor_id: this.doctor.doctor_id,
                booking_date: new Date(this.bookingDate).toISOString(),
                reason: this.buildReasonText(),
                consultation_service_id: this.selectedServiceId,
                consultation_fee_type: this.feeType,
                patient_consent_given: true,
                emergency_acknowledged: true,
            });
            const booking = res.data || res;

            if (typeof this.onBookingComplete === "function") {
                this.onBookingComplete(booking);
            }
        } catch (error) {
            console.error("Failed to create booking:", error);
            this.submitError = error.message || "Failed to submit your booking request.";
        } finally {
            this.submitting = false;
            this.update();
        }
    }

    // ---------- Render ----------

    render() {
        return h(
            "div",
            { class: "dashboard-page" },
            this.renderHeader(),
            this.loading
                ? h(
                      "div",
                      { class: "dashboard-card text-center py-4" },
                      h("p", { class: "dashboard-muted" }, "Loading doctor details...")
                  )
                : this.loadError
                ? h(
                      "div",
                      { class: "dashboard-card", style: "border-left: 4px solid #ef4444;" },
                      h("p", { style: "color: #ef4444; margin: 0;" }, this.loadError)
                  )
                : this.renderForm()
        );
    }

    renderHeader() {
        return h(
            "section",
            { class: "dashboard-header", style: "display: flex; align-items: flex-start; gap: 10px;" },
            h(
                "button",
                {
                    class: "btn btn-outline",
                    style: "padding: 0.4rem 0.6rem; font-size: 0.8rem; border-radius: 6px; flex-shrink: 0;",
                    onclick: () => this.onBack?.(),
                },
                "← Back"
            ),
            h(
                "div",
                {},
                h("p", { class: "dashboard-greeting" }, "Book Appointment"),
                h("h1", { class: "dashboard-title", style: "font-size: 1.2rem;" }, this.doctorProfile?.full_name || this.doctor.full_name || "Doctor")
            )
        );
    }

    renderForm() {
        const fieldLabelStyle = "display: block; margin-bottom: 5px; font-size: 0.82rem; font-weight: 600;";
        const fieldInputStyle = "padding: 0.6rem 0.7rem; border: 1px solid var(--color-line); border-radius: 6px; width: 100%; font-size: 0.9rem; box-sizing: border-box; font-family: inherit;";

        return h(
            "div",
            { class: "services-list" },

            this.submitError
                ? h(
                      "div",
                      { class: "dashboard-card", style: "border-left: 4px solid #ef4444; margin-bottom: var(--space-3);" },
                      h("p", { style: "color: #ef4444; margin: 0;" }, this.submitError)
                  )
                : null,

            h(
                "div",
                { class: "dashboard-card", style: "padding: 1.1rem; display: flex; flex-direction: column; gap: 14px;" },

                h(
                    "div",
                    {},
                    h("label", { style: fieldLabelStyle }, "Consultation type"),
                    this.services.length === 0
                        ? h("p", { class: "dashboard-muted", style: "margin: 0; font-size: 0.85rem;" }, "This doctor has no consultation services available right now.")
                        : h(
                              "select",
                              {
                                  value: this.selectedServiceId,
                                  style: fieldInputStyle,
                                  onchange: e => this.setField("selectedServiceId", e.target.value),
                              },
                              h("option", { value: "" }, "Select a service..."),
                              this.services.map(service =>
                                  h("option", { value: service.id }, service.display_name)
                              )
                          )
                ),

                h(
                    "div",
                    {},
                    h("label", { style: fieldLabelStyle }, "Visit type"),
                    h(
                        "select",
                        {
                            value: this.feeType,
                            style: fieldInputStyle,
                            onchange: e => this.setField("feeType", e.target.value),
                        },
                        h("option", { value: "first_time" }, "First-time consultation"),
                        h("option", { value: "follow_up" }, "Follow-up consultation")
                    )
                ),

                this.getSelectedPrice() != null
                    ? h(
                          "p",
                          { style: "margin: 0; font-size: 0.88rem; font-weight: 600;" },
                          `Fee: ₦${Number(this.getSelectedPrice()).toLocaleString()}`
                      )
                    : null,

                h(
                    "div",
                    {},
                    h("label", { style: fieldLabelStyle }, "Preferred date and time"),
                    h("input", {
                        type: "datetime-local",
                        value: this.bookingDate,
                        style: fieldInputStyle,
                        oninput: e => this.setField("bookingDate", e.target.value),
                    }),
                    h(
                        "p",
                        { class: "dashboard-muted", style: "margin: 6px 0 0; font-size: 0.76rem;" },
                        "This is your requested time. The doctor may confirm it or suggest another time."
                    )
                ),

                this.triageResult
                    ? h(
                          "div",
                          {},
                          h("label", { style: fieldLabelStyle }, "What you told us"),
                          h(
                              "p",
                              { class: "dashboard-muted", style: "margin: 0; font-size: 0.82rem; line-height: 1.5;" },
                              this.buildReasonText() || "No additional details provided."
                          )
                      )
                    : null,

                h(
                    "label",
                    { style: "display: flex; align-items: flex-start; gap: 8px; font-size: 0.82rem; cursor: pointer;" },
                    h("input", {
                        type: "checkbox",
                        checked: this.consentGiven,
                        style: "margin-top: 2px; flex-shrink: 0;",
                        onchange: e => this.setField("consentGiven", e.target.checked),
                    }),
                    "I consent to this online consultation and understand my information will be shared with the doctor I've selected."
                ),

                h(
                    "label",
                    { style: "display: flex; align-items: flex-start; gap: 8px; font-size: 0.82rem; cursor: pointer;" },
                    h("input", {
                        type: "checkbox",
                        checked: this.emergencyAcknowledged,
                        style: "margin-top: 2px; flex-shrink: 0;",
                        onchange: e => this.setField("emergencyAcknowledged", e.target.checked),
                    }),
                    "I understand this platform is not for medical emergencies, and I will seek emergency care directly if needed."
                ),

                h(
                    "button",
                    {
                        class: "btn btn-primary",
                        style: "padding: 0.65rem 1rem; font-size: 0.9rem; border-radius: 8px;",
                        disabled: !this.isFormValid() || this.submitting,
                        onclick: () => this.submitBooking(),
                    },
                    this.submitting ? "Sending request..." : "Request appointment"
                )
            )
        );
    }

    update() {
        if (!this.el) return;
        const newTree = this.render();
        this.el.replaceChildren(...(Array.isArray(newTree) ? newTree : [newTree]).flat());
    }
}
