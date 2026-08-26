// js/components/doctor/patients/PatientRecords.js

import { Component } from "../../../core/component.js";
import { h } from "../../../utils/dom.js";
import api from "../../../services/api.js";

const SECTION_ORDER = ["Outcome", "Plan", "Follow-up"];

export default class PatientRecords extends Component {
    constructor(doctor) {
        super();
        this.doctor = doctor ?? {};

        this.loading = true;
        this.errorMessage = "";

        this.patients = [];
        this.searchTerm = "";

        this.selectedPatientId = null;
        this.notesByPatient = {};
        this.notesLoadingId = null;
        this.notesError = "";
    }

    async afterMount() {
        await this.loadPatients();
    }

    // ---------- Data loading ----------

    async loadPatients() {
        this.loading = true;
        this.errorMessage = "";
        this.update();

        try {
            const res = await api.get("/consultations/patients");
            const payload = res.data || res;
            this.patients = Array.isArray(payload) ? payload : payload.rows || payload.data || [];
        } catch (error) {
            console.error("Failed to load patients:", error);
            this.errorMessage = error.message || "Failed to load patient list.";
        } finally {
            this.loading = false;
            this.update();
        }
    }

    async selectPatient(patientId) {
        if (this.selectedPatientId === patientId) {
            this.selectedPatientId = null;
            this.update();
            return;
        }

        this.selectedPatientId = patientId;
        this.notesError = "";
        this.update();

        if (this.notesByPatient[patientId]) return;

        this.notesLoadingId = patientId;
        this.update();

        try {
            const res = await api.get(`/consultations/patients/${patientId}/notes`);
            const payload = res.data || res;
            const notes = Array.isArray(payload) ? payload : payload.rows || payload.data || [];
            this.notesByPatient[patientId] = notes;
        } catch (error) {
            console.error("Failed to load patient notes:", error);
            this.notesError = error.message || "Failed to load consultation notes.";
        } finally {
            this.notesLoadingId = null;
            this.update();
        }
    }

    setSearchTerm(term) {
        this.searchTerm = term;
        this.update();
    }

    // ---------- Derived data ----------

    getFilteredPatients() {
        const term = this.searchTerm.trim().toLowerCase();
        if (!term) return this.patients;
        return this.patients.filter(p =>
            (p.full_name || "").toLowerCase().includes(term) ||
            (p.email || "").toLowerCase().includes(term)
        );
    }

    // ---------- Note parsing/formatting ----------

    parseDoctorNotes(rawText) {
        if (!rawText || typeof rawText !== "string") return [];

        const sectionRegex = /(Outcome|Plan|Follow-up)\n-+\n([\s\S]*?)(?=\n\n(?:Outcome|Plan|Follow-up)\n-+|\s*$)/g;
        const sections = [];
        let match;

        while ((match = sectionRegex.exec(rawText)) !== null) {
            sections.push({ title: match[1], body: match[2].trim() });
        }

        // Fallback: header format not detected — show the raw text as a single block
        // rather than silently showing nothing.
        if (sections.length === 0) {
            return [{ title: "Notes", body: rawText.trim() }];
        }

        return sections.sort(
            (a, b) => SECTION_ORDER.indexOf(a.title) - SECTION_ORDER.indexOf(b.title)
        );
    }

    splitParagraphs(text) {
        if (!text) return [];
        let paragraphs = text.split(/\n\s*\n/).map(p => p.trim()).filter(Boolean);
        if (paragraphs.length <= 1) {
            paragraphs = text.split(/\n/).map(p => p.trim()).filter(Boolean);
        }
        return paragraphs.length ? paragraphs : [text.trim()];
    }

    // ---------- Formatting ----------

    formatDate(dateString) {
        if (!dateString) return "N/A";
        return new Date(dateString).toLocaleString(undefined, {
            year: "numeric",
            month: "short",
            day: "numeric",
            hour: "2-digit",
            minute: "2-digit",
        });
    }

    formatShortDate(dateString) {
        if (!dateString) return "N/A";
        return new Date(dateString).toLocaleDateString(undefined, {
            year: "numeric",
            month: "short",
            day: "numeric",
        });
    }

    // ---------- Render ----------

    render() {
        return h(
            "div",
            { class: "dashboard-page queue-page" },
            this.renderHeader(),
            this.renderAlerts(),
            this.loading
                ? h(
                      "div",
                      { class: "dashboard-card text-center py-4" },
                      h("p", { class: "dashboard-muted" }, "Loading patient records...")
                  )
                : this.renderContent()
        );
    }

    renderHeader() {
        return h(
            "section",
            { class: "dashboard-header" },
            h("p", { class: "dashboard-greeting" }, "Doctor Records"),
            h("h1", { class: "dashboard-title" }, "Patient Records"),
            h(
                "p",
                { class: "dashboard-subtitle" },
                "Review patients you have attended to and their consultation notes."
            )
        );
    }

    renderAlerts() {
        const alerts = [];
        if (this.errorMessage) {
            alerts.push(
                h(
                    "div",
                    { class: "dashboard-card", style: "border-left: 4px solid #ef4444;" },
                    h("p", { style: "color: #ef4444; margin: 0;" }, this.errorMessage)
                )
            );
        }
        return alerts;
    }

    renderContent() {
        return h(
            "div",
            { class: "services-list" },
            this.renderSearch(),
            this.renderList()
        );
    }

    renderSearch() {
        return h(
            "div",
            {
                class: "dashboard-card",
                style: "padding: 0.85rem 1rem; margin-bottom: var(--space-3);",
            },
            h("input", {
                type: "text",
                placeholder: "Search by patient name or email...",
                value: this.searchTerm,
                style: "width: 100%; padding: 0.55rem 0.7rem; border: 1px solid var(--color-line); border-radius: 6px; font-size: 0.88rem; box-sizing: border-box;",
                oninput: e => this.setSearchTerm(e.target.value),
            })
        );
    }

    renderList() {
        const filtered = this.getFilteredPatients();

        if (filtered.length === 0) {
            return h(
                "div",
                { class: "dashboard-card text-center py-4" },
                h(
                    "p",
                    { class: "dashboard-muted" },
                    this.searchTerm
                        ? `No patients match "${this.searchTerm}".`
                        : "You haven't attended to any patients yet."
                )
            );
        }

        return h(
            "div",
            { class: "services-list" },
            filtered.map(patient => this.renderPatientCard(patient))
        );
    }

    renderPatientCard(patient) {
        const isExpanded = this.selectedPatientId === patient.patient_id;
        const count = patient.consultations_count ?? 0;

        return h(
            "div",
            { class: "dashboard-card service-item-card", style: "padding: 1rem 1.1rem; margin-bottom: var(--space-3);" },
            h(
                "div",
                {
                    style: "display: flex; justify-content: space-between; align-items: flex-start; gap: var(--space-3); cursor: pointer;",
                    onclick: () => this.selectPatient(patient.patient_id),
                },
                h(
                    "div",
                    { style: "min-width: 0;" },
                    h(
                        "h3",
                        { style: "margin: 0 0 4px; font-size: 1.02rem; font-weight: 600; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;" },
                        patient.full_name || "Unknown Patient"
                    ),
                    h(
                        "p",
                        { class: "dashboard-muted", style: "margin: 0; font-size: 0.8rem; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;" },
                        patient.email || ""
                    )
                ),
                h(
                    "span",
                    {
                        class: "dashboard-badge",
                        style: "background: var(--color-primary, #0284c7); font-size: 0.7rem; padding: 3px 9px; border-radius: 5px; white-space: nowrap; flex-shrink: 0;",
                    },
                    `${count} consult${count === 1 ? "" : "s"}`
                )
            ),
            h(
                "div",
                {
                    style: "margin-top: var(--space-3); padding-top: var(--space-3); border-top: 1px solid var(--color-line); display: flex; flex-direction: column; gap: 7px;",
                },
                patient.phone_number
                    ? h(
                          "p",
                          { style: "margin: 0; font-size: 0.86rem;" },
                          h("span", { class: "dashboard-muted", style: "font-size: 0.78rem;" }, "Phone: "),
                          h("span", { style: "font-weight: 600;" }, patient.phone_number)
                      )
                    : null,
                patient.gender
                    ? h(
                          "p",
                          { style: "margin: 0; font-size: 0.86rem;" },
                          h("span", { class: "dashboard-muted", style: "font-size: 0.78rem;" }, "Gender: "),
                          h("span", { style: "font-weight: 600;" }, patient.gender)
                      )
                    : null,
                h(
                    "p",
                    { style: "margin: 0; font-size: 0.86rem;" },
                    h("span", { class: "dashboard-muted", style: "font-size: 0.78rem;" }, "Last seen: "),
                    h("span", { style: "font-weight: 600;" }, this.formatShortDate(patient.last_consultation_at))
                )
            ),
            h(
                "div",
                { style: "margin-top: var(--space-3);" },
                h(
                    "button",
                    {
                        class: "btn btn-outline",
                        style: "padding: 0.4rem 0.75rem; font-size: 0.8rem; border-radius: 6px;",
                        onclick: () => this.selectPatient(patient.patient_id),
                    },
                    isExpanded ? "Hide Notes" : "View Notes"
                )
            ),
            isExpanded ? this.renderPatientNotes(patient) : null
        );
    }

    renderPatientNotes(patient) {
        const isLoading = this.notesLoadingId === patient.patient_id;
        const notes = this.notesByPatient[patient.patient_id];

        if (isLoading) {
            return h(
                "div",
                { style: "margin-top: var(--space-3); padding: 0.85rem;" },
                h("p", { class: "dashboard-muted" }, "Loading consultation notes...")
            );
        }

        if (this.notesError) {
            return h(
                "div",
                { style: "margin-top: var(--space-3); padding: 0.85rem;" },
                h("p", { style: "color: #ef4444; margin: 0;" }, this.notesError)
            );
        }

        if (!notes || notes.length === 0) {
            return h(
                "div",
                { style: "margin-top: var(--space-3); padding: 0.85rem;" },
                h("p", { class: "dashboard-muted" }, "No consultation notes recorded for this patient yet.")
            );
        }

        return h(
            "div",
            { style: "margin-top: var(--space-3); display: flex; flex-direction: column; gap: var(--space-3);" },
            notes.map(note => this.renderConsultationNote(note))
        );
    }

    renderConsultationNote(note) {
        const sections = this.parseDoctorNotes(note.doctor_notes);
        const medications = Array.isArray(note.medications) ? note.medications : [];

        return h(
            "div",
            {
                style: "padding: 0.9rem 1rem; background: rgba(2,132,199,0.04); border-radius: 8px; border: 1px solid var(--color-line);",
            },
            h(
                "p",
                { class: "dashboard-muted", style: "margin: 0 0 10px; font-size: 0.78rem; font-weight: 600;" },
                `Consultation · ${this.formatDate(note.booking_date || note.created_at)}`
            ),
            sections.map(section =>
                h(
                    "div",
                    { style: "margin-bottom: 12px;" },
                    h(
                        "h4",
                        {
                            style: "margin: 0 0 6px; font-size: 0.86rem; font-weight: 700; color: var(--color-primary, #0284c7); text-transform: uppercase; letter-spacing: 0.03em;",
                        },
                        section.title
                    ),
                    this.splitParagraphs(section.body).map(paragraph =>
                        h(
                            "p",
                            { style: "margin: 0 0 8px; font-size: 0.88rem; line-height: 1.55;" },
                            paragraph
                        )
                    ),
                    section.title === "Plan" && medications.length > 0
                        ? this.renderMedicationsList(medications, note)
                        : null
                )
            )
        );
    }

    renderMedicationsList(medications, note) {
        return h(
            "div",
            { style: "margin-top: 4px; display: flex; flex-direction: column; gap: 8px;" },
            h(
                "div",
                { style: "display: flex; justify-content: space-between; align-items: center;" },
                h(
                    "p",
                    { class: "dashboard-muted", style: "margin: 0; font-size: 0.72rem; font-weight: 600; text-transform: uppercase; letter-spacing: 0.03em;" },
                    "Prescription"
                ),
                h(
                    "button",
                    {
                        style: "font-size: 0.74rem; color: var(--color-primary, #0284c7); font-weight: 600; background: none; border: none; cursor: pointer; padding: 0;",
                        onclick: e => {
                            e.stopPropagation();
                            this.downloadPrescription(note);
                        },
                    },
                    "Download prescription"
                )
            ),
            medications.map(med => this.renderMedicationCard(med))
        );
    }

    renderMedicationCard(med) {
        const details = [med.dose, med.frequency, med.duration].filter(Boolean).join(" · ");

        return h(
            "div",
            { style: "padding: 8px 10px; background: var(--color-bg-muted, #f1f5f9); border-radius: 6px;" },
            h("p", { style: "margin: 0 0 2px; font-size: 0.86rem; font-weight: 600;" }, med.medication || "Unnamed medication"),
            details ? h("p", { class: "dashboard-muted", style: "margin: 0; font-size: 0.78rem;" }, details) : null,
            med.instructions
                ? h("p", { style: "margin: 4px 0 0; font-size: 0.78rem; font-style: italic; line-height: 1.4;" }, med.instructions)
                : null
        );
    }

    async downloadPrescription(note) {
        try {
            const blob = await api.getBlob(`/consultations/booking/${note.booking_id}/prescription-pdf`);
            const url = URL.createObjectURL(blob);

            const link = document.createElement("a");
            link.href = url;
            link.download = `prescription-${note.booking_id}.pdf`;
            document.body.appendChild(link);
            link.click();
            link.remove();

            URL.revokeObjectURL(url);
        } catch (error) {
            console.error("Failed to download prescription:", error);
            this.notesError = error.message || "Failed to download prescription.";
            this.update();
        }
    }

    update() {
        if (!this.el) return;
        const newTree = this.render();
        this.el.replaceChildren(...(Array.isArray(newTree) ? newTree : [newTree]).flat());
    }
}
