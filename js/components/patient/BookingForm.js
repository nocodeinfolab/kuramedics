// js/components/patient/BookingForm.js

import { Component } from "../../core/component.js";
import { h } from "../../utils/dom.js";
import api from "../../services/api.js";

const icon = (paths, size = 18) => h("svg", { viewBox: "0 0 24 24", fill: "none", width: String(size), height: String(size), "aria-hidden": "true" }, ...paths.map(d => h("path", { d, stroke: "currentColor", "stroke-width": "1.8", "stroke-linecap": "round", "stroke-linejoin": "round" })));

export default class BookingForm extends Component {
    /**
     * @param {object} patient
     * @param {object} doctor - selected doctor, at minimum { doctor_id, full_name }
     * @param {object|null} triageResult - result from TriageForm, or null if skipped
     * @param {(booking: object) => void} onBookingComplete
     * @param {() => void} onBack
     */
    constructor(patient, doctor, triageResult, preselectedServiceId, onBookingComplete, onBack) {
        super();
        this.patient = patient ?? {};
        this.doctor = doctor ?? {};
        this.triageResult = triageResult ?? null;
        this.preselectedServiceId = preselectedServiceId || null;
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

            if (this.preselectedServiceId && this.services.some(s => s.id === this.preselectedServiceId)) {
                this.selectedServiceId = this.preselectedServiceId;
            } else if (this.services.length === 1) {
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
            { class: "booking-form" },
            this.renderHeader(),
            this.loading
                ? this.renderLoading()
                : this.loadError
                ? this.renderLoadError()
                : this.renderForm()
        );
    }

    renderHeader() {
        const name = this.doctorProfile?.full_name || this.doctor.full_name || "Doctor";
        return h(
            "div",
            { class: "bf-header" },
            h(
                "button",
                { class: "bf-back-btn", type: "button", onclick: () => this.onBack?.() },
                icon(["M15 18l-6-6 6-6"], 16),
                h("span", null, "Back")
            ),
            h(
                "div",
                { class: "bf-header-text" },
                h("p", { class: "bf-eyebrow" }, "Book appointment"),
                h("h1", { class: "bf-title" }, name)
            )
        );
    }

    renderLoading() {
        return h(
            "div",
            { class: "bf-card" },
            h("div", { class: "bf-skel bf-skel--line" }),
            h("div", { class: "bf-skel bf-skel--field" }),
            h("div", { class: "bf-skel bf-skel--field" }),
            h("div", { class: "bf-skel bf-skel--field" }),
            h("div", { class: "bf-skel bf-skel--btn" })
        );
    }

    renderLoadError() {
        return h(
            "div",
            { class: "bf-alert bf-alert--danger", role: "alert" },
            h(
                "div",
                { class: "bf-alert-icon" },
                icon(["M12 9v4", "M12 17h.01", "M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"], 18)
            ),
            h("p", { class: "bf-alert-text" }, this.loadError)
        );
    }
    renderForm() {
        const price = this.getSelectedPrice();
        return h(
            "div",
            { class: "bf-stack" },

            this.submitError
                ? h(
                      "div",
                      { class: "bf-alert bf-alert--danger", role: "alert" },
                      h(
                          "div",
                          { class: "bf-alert-icon" },
                          icon(["M12 9v4", "M12 17h.01", "M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"], 18)
                      ),
                      h("p", { class: "bf-alert-text" }, this.submitError)
                  )
                : null,

            h(
                "div",
                { class: "bf-card" },

                // Consultation type
                h(
                    "div",
                    { class: "bf-field" },
                    h("label", { class: "bf-label", for: "bf-service" }, "Consultation type"),
                    this.services.length === 0
                        ? h("p", { class: "bf-empty-inline" }, "This doctor has no consultation services available right now.")
                        : h(
                              "div",
                              { class: "bf-select-wrap" },
                              h(
                                  "select",
                                  {
                                      id: "bf-service",
                                      class: "bf-select",
                                      value: this.selectedServiceId,
                                      onchange: e => this.setField("selectedServiceId", e.target.value),
                                  },
                                  h("option", { value: "" }, "Select a service..."),
                                  this.services.map(service =>
                                      h("option", { value: service.id }, service.display_name)
                                  )
                              ),
                              h("span", { class: "bf-select-chevron" }, icon(["M6 9l6 6 6-6"], 16))
                          )
                ),

                // Visit type
                h(
                    "div",
                    { class: "bf-field" },
                    h("label", { class: "bf-label", for: "bf-fee" }, "Visit type"),
                    h(
                        "div",
                        { class: "bf-select-wrap" },
                        h(
                            "select",
                            {
                                id: "bf-fee",
                                class: "bf-select",
                                value: this.feeType,
                                onchange: e => this.setField("feeType", e.target.value),
                            },
                            h("option", { value: "first_time" }, "First-time consultation"),
                            h("option", { value: "follow_up" }, "Follow-up consultation")
                        ),
                        h("span", { class: "bf-select-chevron" }, icon(["M6 9l6 6 6-6"], 16))
                    )
                ),

                // Fee display
                price != null
                    ? h(
                          "div",
                          { class: "bf-fee-card" },
                          h(
                              "div",
                              { class: "bf-fee-icon" },
                              icon(["M12 1v22", "M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"], 18)
                          ),
                          h(
                              "div",
                              { class: "bf-fee-body" },
                              h("span", { class: "bf-fee-label" }, "Consultation fee"),
                              h("span", { class: "bf-fee-value" }, `₦${Number(price).toLocaleString()}`)
                          )
                      )
                    : null,

                // Preferred date / time
                h(
                    "div",
                    { class: "bf-field" },
                    h("label", { class: "bf-label", for: "bf-date" }, "Preferred date and time"),
                    h(
                        "div",
                        { class: "bf-input-wrap" },
                        h(
                            "span",
                            { class: "bf-input-icon" },
                            icon(["M8 2v4", "M16 2v4", "M3 10h18", "M5 4h14a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2"], 16)
                        ),
                        h("input", {
                            id: "bf-date",
                            type: "datetime-local",
                            class: "bf-input bf-input--with-icon",
                            value: this.bookingDate,
                            oninput: e => this.setField("bookingDate", e.target.value),
                        })
                    ),
                    h(
                        "p",
                        { class: "bf-hint" },
                        "This is your requested time. The doctor may confirm it or suggest another time."
                    )
                ),

                // Triage summary
                this.triageResult
                    ? h(
                          "div",
                          { class: "bf-field" },
                          h("label", { class: "bf-label" }, "What you told us"),
                          h(
                              "div",
                              { class: "bf-note" },
                              h(
                                  "div",
                                  { class: "bf-note-icon" },
                                  icon(["M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z", "M14 2v6h6", "M16 13H8", "M16 17H8", "M10 9H8"], 16)
                              ),
                              h("p", { class: "bf-note-text" }, this.buildReasonText() || "No additional details provided.")
                          )
                      )
                    : null,

                // Consent
                h(
                    "label",
                    { class: "bf-consent" },
                    h("input", {
                        type: "checkbox",
                        class: "bf-checkbox",
                        checked: this.consentGiven,
                        onchange: e => this.setField("consentGiven", e.target.checked),
                    }),
                    h("span", { class: "bf-consent-box" }, icon(["M20 6L9 17l-5-5"], 14)),
                    h(
                        "span",
                        { class: "bf-consent-text" },
                        "I consent to this online consultation and understand my information will be shared with the doctor I've selected."
                    )
                ),

                h(
                    "label",
                    { class: "bf-consent" },
                    h("input", {
                        type: "checkbox",
                        class: "bf-checkbox",
                        checked: this.emergencyAcknowledged,
                        onchange: e => this.setField("emergencyAcknowledged", e.target.checked),
                    }),
                    h("span", { class: "bf-consent-box" }, icon(["M20 6L9 17l-5-5"], 14)),
                    h(
                        "span",
                        { class: "bf-consent-text" },
                        "I understand this platform is not for medical emergencies, and I will seek emergency care directly if needed."
                    )
                )
            ),

            // Submit
            h(
                "button",
                {
                    class: "bf-submit",
                    type: "button",
                    disabled: !this.isFormValid() || this.submitting,
                    onclick: () => this.submitBooking(),
                },
                this.submitting
                    ? h("span", { class: "bf-spinner" })
                    : icon(["M5 12h14", "M12 5l7 7-7 7"], 18),
                h("span", null, this.submitting ? "Sending request…" : "Request appointment")
            )
        );
    }

    update() {
        if (!this.el) return;
        const newTree = this.render();
        this.el.replaceChildren(...(Array.isArray(newTree) ? newTree : [newTree]).flat());
    }
}
