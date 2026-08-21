// js/components/public/PrescriptionVerificationPage.js

import { Component } from "../../core/component.js";
import { h } from "../../utils/dom.js";

const API_BASE_URL = "https://doctors-consultation-backend.onrender.com/api/v1";

export default class PrescriptionVerificationPage extends Component {
    constructor(consultationId) {
        super();
        this.consultationId = consultationId;
        this.loading = true;
        this.data = null;
        this.error = "";
    }

    async afterMount() {
        try {
            const res = await fetch(`${API_BASE_URL}/verify/prescription/${this.consultationId}`);
            const json = await res.json();
            this.data = json.data || json;
        } catch (error) {
            console.error("Verification failed:", error);
            this.error = "Unable to verify this prescription right now. Please try again.";
        } finally {
            this.loading = false;
            this.update();
        }
    }

    formatDate(value) {
        if (!value) return "N/A";
        return new Date(value).toLocaleDateString(undefined, {
            day: "2-digit", month: "short", year: "numeric",
        });
    }

    render() {
        return h(
            "main",
            {
                style: `max-width: 480px; margin: 0 auto; padding: var(--space-6) var(--space-4);
                        font-family: var(--font-body); background: var(--color-bg); color: var(--color-ink);`,
            },
            h(
                "h1",
                { style: `font-family: var(--font-display); font-size: var(--step-h3); font-weight: 600;
                           color: var(--color-primary); margin: 0 0 var(--space-1);` },
                "YerosCare"
            ),
            h(
                "p",
                { style: `color: var(--color-ink-soft); font-size: var(--step-small);
                           margin: 0 0 var(--space-6);` },
                "Prescription Verification"
            ),
            this.loading
                ? h("p", { style: "color: var(--color-ink-soft); font-size: var(--step-body);" }, "Verifying...")
                : this.error
                ? this.renderNotice(this.error, "danger")
                : this.renderResult()
        );
    }

    // Shared status banner. tone is "danger" (invalid), "success" (valid), or "warning" (unconfirmed doctor).
    renderNotice(message, tone) {
        const tones = {
            danger: {
                bg: "var(--color-bg-soft)",
                border: "var(--color-line-strong)",
                text: "#b3261e",
            },
            success: {
                bg: "var(--color-accent)",
                border: "var(--color-accent)",
                text: "var(--color-accent-ink)",
            },
            warning: {
                bg: "var(--color-primary-soft)",
                border: "var(--color-primary-line)",
                text: "var(--color-primary-dark)",
            },
        };
        const t = tones[tone];

        return h(
            "div",
            {
                style: `padding: var(--space-4); border-radius: var(--radius-md);
                         background: ${t.bg}; border: 1px solid ${t.border};
                         box-shadow: var(--shadow-card);`,
            },
            h("p", { style: `color: ${t.text}; font-weight: 600; margin: 0; font-size: var(--step-body);` },
                tone === "danger" ? "⚠ This prescription could not be verified." : tone === "success" ? "✓ Valid prescription" : message
            ),
            tone === "danger"
                ? h(
                      "p",
                      { style: "color: var(--color-ink-soft); font-size: var(--step-small); margin-top: var(--space-2);" },
                      "This may mean the reference is invalid or the prescription does not exist in our records."
                  )
                : tone === "success"
                ? h("p", { style: `color: ${t.text}; font-size: var(--step-small); margin-top: var(--space-2);` }, message)
                : null
        );
    }

    renderResult() {
        const data = this.data;

        if (!data?.valid) {
            return this.renderNotice("", "danger");
        }

        return h(
            "div",
            { style: `display: flex; flex-direction: column; gap: var(--space-5);` },

            this.renderNotice(
                data.doctor_verified
                    ? "Issued by a verified YerosCare doctor."
                    : "Note: this doctor's verification is not currently confirmed.",
                data.doctor_verified ? "success" : "warning"
            ),

            h(
                "div",
                {},
                this.renderEyebrow("Prescribing doctor"),
                h("p", { style: `font-weight: 600; margin: 0; font-size: var(--step-lead); color: var(--color-ink);` },
                    `Dr. ${data.doctor.full_name}`
                ),
                h("p", { style: `font-size: var(--step-small); color: var(--color-ink-soft); margin: var(--space-1) 0 0;` },
                    data.doctor.specialization || ""
                ),
                h("p", { style: `font-size: var(--step-small); color: var(--color-ink-soft); margin: var(--space-1) 0 0;` },
                    data.doctor.mdcn_registration_number ? `MDCN No: ${data.doctor.mdcn_registration_number}` : "MDCN No: Not on file"
                )
            ),

            h(
                "div",
                {},
                this.renderEyebrow("Patient"),
                h("p", { style: `font-weight: 600; margin: 0; font-size: var(--step-lead); color: var(--color-ink);` },
                    data.patient.full_name
                ),
                h("p", { style: `font-size: var(--step-small); color: var(--color-ink-soft); margin: var(--space-1) 0 0;` },
                    `Consultation date: ${this.formatDate(data.consultation_date)}`
                )
            ),

            h(
                "div",
                {},
                this.renderEyebrow("Medications"),
                h(
                    "div",
                    { style: `display: flex; flex-direction: column; gap: var(--space-2); margin-top: var(--space-2);` },
                    data.medications.map(med =>
                        h(
                            "div",
                            {
                                style: `padding: var(--space-3) var(--space-4); background: var(--color-bg-soft);
                                         border: 1px solid var(--color-line); border-radius: var(--radius-sm);`,
                            },
                            h("p", { style: `margin: 0; font-weight: 600; font-size: var(--step-body); color: var(--color-ink);` },
                                med.medication || "Unnamed medication"
                            ),
                            h("p", { style: `margin: var(--space-1) 0 0; font-size: var(--step-small); color: var(--color-ink-soft);` },
                                [med.dose, med.frequency, med.duration].filter(Boolean).join(" · ")
                            )
                        )
                    )
                )
            )
        );
    }

    renderEyebrow(text) {
        return h(
            "p",
            {
                style: `font-size: var(--step-eyebrow); color: var(--color-ink-soft); text-transform: uppercase;
                         letter-spacing: 0.04em; margin: 0 0 var(--space-1);`,
            },
            text
        );
    }

    update() {
        if (!this.el) return;
        const newTree = this.render();
        this.el.replaceChildren(...(Array.isArray(newTree) ? newTree : [newTree]).flat());
    }
}
