// js/components/public/PrescriptionVerificationPage.js

import { Component } from "../../core/component.js";
import { h } from "../../utils/dom.js";
import apiService from "../../services/api.js";

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
            const json = await apiService.getPublic(`/prescriptions/verify/${this.consultationId}`);
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
            { style: "max-width: 480px; margin: 0 auto; padding: 24px 16px; font-family: Inter, sans-serif;" },
            h("h1", { style: "font-size: 1.3rem; margin-bottom: 4px;" }, "KuraMedics"),
            h("p", { style: "color: #64748b; font-size: 0.85rem; margin-bottom: 24px;" }, "Prescription Verification"),
            this.loading
                ? h("p", {}, "Verifying...")
                : this.error
                ? h("p", { style: "color: #ef4444;" }, this.error)
                : this.renderResult()
        );
    }

    renderResult() {
        const data = this.data;

        if (!data?.valid) {
            return h(
                "div",
                { style: "padding: 16px; border-radius: 8px; background: #fef2f2; border: 1px solid #fecaca;" },
                h("p", { style: "color: #ef4444; font-weight: 600; margin: 0;" }, "⚠ This prescription could not be verified."),
                h("p", { style: "color: #64748b; font-size: 0.85rem; margin-top: 6px;" }, "This may mean the reference is invalid or the prescription does not exist in our records.")
            );
        }

        return h(
            "div",
            { style: "display: flex; flex-direction: column; gap: 16px;" },
            h(
                "div",
                { style: "padding: 14px; border-radius: 8px; background: #f0fdf4; border: 1px solid #bbf7d0;" },
                h("p", { style: "color: #16a34a; font-weight: 600; margin: 0;" }, "✓ Valid prescription"),
                data.doctor_verified
                    ? h("p", { style: "color: #16a34a; font-size: 0.8rem; margin-top: 4px;" }, "Issued by a verified KuraMedics doctor.")
                    : h("p", { style: "color: #b45309; font-size: 0.8rem; margin-top: 4px;" }, "Note: this doctor's verification is not currently confirmed.")
            ),
            h(
                "div",
                {},
                h("p", { style: "font-size: 0.75rem; color: #64748b; text-transform: uppercase; margin: 0 0 4px;" }, "Prescribing Doctor"),
                h("p", { style: "font-weight: 600; margin: 0;" }, `Dr. ${data.doctor.full_name}`),
                h("p", { style: "font-size: 0.85rem; color: #64748b; margin: 2px 0 0;" }, data.doctor.specialization || ""),
                h("p", { style: "font-size: 0.85rem; color: #64748b; margin: 2px 0 0;" }, data.doctor.mdcn_registration_number ? `MDCN No: ${data.doctor.mdcn_registration_number}` : "MDCN No: Not on file")
            ),
            h(
                "div",
                {},
                h("p", { style: "font-size: 0.75rem; color: #64748b; text-transform: uppercase; margin: 0 0 4px;" }, "Patient"),
                h("p", { style: "font-weight: 600; margin: 0;" }, data.patient.full_name),
                h("p", { style: "font-size: 0.85rem; color: #64748b; margin: 2px 0 0;" }, `Consultation date: ${this.formatDate(data.consultation_date)}`)
            ),
            h(
                "div",
                {},
                h("p", { style: "font-size: 0.75rem; color: #64748b; text-transform: uppercase; margin: 0 0 8px;" }, "Medications"),
                h(
                    "div",
                    { style: "display: flex; flex-direction: column; gap: 8px;" },
                    data.medications.map(med =>
                        h(
                            "div",
                            { style: "padding: 8px 10px; background: #f8fafc; border-radius: 6px;" },
                            h("p", { style: "margin: 0; font-weight: 600; font-size: 0.9rem;" }, med.medication || "Unnamed medication"),
                            h("p", { style: "margin: 2px 0 0; font-size: 0.78rem; color: #64748b;" }, [med.dose, med.frequency, med.duration].filter(Boolean).join(" · "))
                        )
                    )
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
