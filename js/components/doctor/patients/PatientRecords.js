// js/components/doctor/patients/PatientRecords.js

import { Component } from "../../../core/component.js";
import { h } from "../../../utils/dom.js";
import api from "../../../services/api.js";

const SECTION_ORDER = ["Outcome", "Plan", "Follow-up"];
const PATIENTS_PAGE_LIMIT = 20;
const NOTES_PAGE_LIMIT = 5;
const icon = (paths, size = 18) =>
    h(
        "svg",
        { viewBox: "0 0 24 24", fill: "none", width: String(size), height: String(size), "aria-hidden": "true" },
        ...paths.map(d =>
            h("path", {
                d,
                stroke: "currentColor",
                "stroke-width": "1.8",
                "stroke-linecap": "round",
                "stroke-linejoin": "round"
            })
        )
    );

const PI = {
    search: ["M11 19a8 8 0 1 0 0-16 8 8 0 0 0 0 16z", "M21 21l-4.3-4.3"],
    phone: ["M22 16.9v3a2 2 0 0 1-2.2 2 19.8 19.8 0 0 1-8.6-3.1 19.5 19.5 0 0 1-6-6A19.8 19.8 0 0 1 2.1 4.2 2 2 0 0 1 4.1 2h3a2 2 0 0 1 2 1.7c.1 1 .4 1.9.7 2.8a2 2 0 0 1-.5 2.1L8.1 9.9a16 16 0 0 0 6 6l1.3-1.3a2 2 0 0 1 2.1-.4c.9.3 1.8.6 2.8.7a2 2 0 0 1 1.7 2z"],
    user: ["M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2", "M12 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8z"],
    calendar: [
        "M5 5h14a1 1 0 0 1 1 1v14a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1z",
        "M4 9h16", "M8 3v4", "M16 3v4"
    ],
    people: [
        "M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2",
        "M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8z",
        "M23 21v-2a4 4 0 0 0-3-3.9", "M16 3.1a4 4 0 0 1 0 7.8"
    ],
    chevron: ["M6 9l6 6 6-6"],
    download: ["M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4", "M7 10l5 5 5-5", "M12 15V3"],
    alert: ["M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0z", "M12 9v4", "M12 17h.01"],
    file: ["M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z", "M14 2v6h6", "M8 13h8", "M8 17h5"]
};

const getInitials = name => {
    const parts = (name || "").trim().split(/\s+/).filter(Boolean);
    if (parts.length === 0) return "P";
    if (parts.length === 1) return parts[0].charAt(0).toUpperCase();
    return (parts[0].charAt(0) + parts[parts.length - 1].charAt(0)).toUpperCase();
};

export default class PatientRecords extends Component {
    constructor(doctor) {
        super();
        this.doctor = doctor ?? {};

        this.loading = true;
        this.loadingMore = false;
        this.errorMessage = "";

        this.patients = [];
        this.page = 0;
        this.hasMore = true;
        this.totalCount = 0;

        this.searchTerm = "";
        this._searchDebounceTimer = null;

        this.selectedPatientId = null;
        // Per-patient notes state: { rows: [], page, hasMore, totalCount, loading, loadingMore }
        this.notesByPatient = {};
        this.notesError = "";
    }

    async afterMount() {
        await this.loadPatients({ reset: true });
    }

    // ---------- Data loading ----------

    async loadPatients({ reset = false } = {}) {
        if (reset) {
            this.loading = true;
            this.page = 0;
            this.patients = [];
            this.hasMore = true;
        } else {
            this.loadingMore = true;
        }
        this.errorMessage = "";
        this.update();

        try {
            const nextPage = this.page + 1;
            const params = new URLSearchParams({
                page: nextPage,
                limit: PATIENTS_PAGE_LIMIT,
            });
            if (this.searchTerm.trim()) params.set("search", this.searchTerm.trim());

            const res = await api.get(`/consultations/patients?${params.toString()}`);
            const payload = res.data || res;
            const rows = payload.items || [];
            const total = payload.pagination?.totalItems ?? rows.length;

            this.patients = reset ? rows : [...this.patients, ...rows];
            this.totalCount = total;
            this.page = nextPage;
            this.hasMore = this.patients.length < total;
        } catch (error) {
            console.error("Failed to load patients:", error);
            this.errorMessage = error.message || "Failed to load patient list.";
        } finally {
            this.loading = false;
            this.loadingMore = false;
            this.update();
        }
    }

    setSearchTerm(term) {
        this.searchTerm = term;
        this.update(); // reflect typing immediately

        clearTimeout(this._searchDebounceTimer);
        this._searchDebounceTimer = setTimeout(() => {
            this.loadPatients({ reset: true });
        }, 350);
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

        if (this.notesByPatient[patientId]) return; // already loaded at least once

        await this.loadNotesForPatient(patientId, { reset: true });
    }

    async loadNotesForPatient(patientId, { reset = false } = {}) {
        const existing = this.notesByPatient[patientId] || {
            rows: [], page: 0, hasMore: true, totalCount: 0, loading: false, loadingMore: false,
        };

        if (reset) {
            existing.loading = true;
            existing.page = 0;
            existing.rows = [];
            existing.hasMore = true;
        } else {
            existing.loadingMore = true;
        }
        this.notesByPatient[patientId] = existing;
        this.notesError = "";
        this.update();

        try {
            const nextPage = existing.page + 1;
            const res = await api.get(
                `/consultations/patients/${patientId}/notes?page=${nextPage}&limit=${NOTES_PAGE_LIMIT}`
            );
            const payload = res.data || res;
            const rows = payload.items || [];
            const total = payload.pagination?.totalItems ?? rows.length;

            existing.rows = reset ? rows : [...existing.rows, ...rows];
            existing.totalCount = total;
            existing.page = nextPage;
            existing.hasMore = existing.rows.length < total;
        } catch (error) {
            console.error("Failed to load patient notes:", error);
            this.notesError = error.message || "Failed to load consultation notes.";
        } finally {
            existing.loading = false;
            existing.loadingMore = false;
            this.notesByPatient[patientId] = existing;
            this.update();
        }
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
            { class: "dashboard-page queue-page doctor-records" },
            this.renderHeader(),
            this.renderAlerts(),
            this.loading ? this.renderSkeleton() : this.renderContent()
        );
    }
    
    renderSkeleton() {
        return h(
            "div",
            { "aria-busy": "true", "aria-label": "Loading patient records" },
            ...[0, 1, 2].map(() =>
                h(
                    "div",
                    { class: "dashboard-card pr-card" },
                    h(
                        "div",
                        { class: "pr-card__head" },
                        h("div", { class: "skeleton skeleton--circle" }),
                        h(
                            "div",
                            { class: "pr-card__who" },
                            h("div", { class: "skeleton skeleton--line-sm" }),
                            h("div", { class: "skeleton skeleton--line-sm skeleton--short" })
                        )
                    ),
                    h("div", { class: "skeleton skeleton--line" })
                )
            )
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
            ),
            this.loading
                ? null
                : h(
                      "div",
                      { class: "dashboard-hero-meta" },
                      h("span", { class: "hero-chip" },
                          h("span", { class: "hero-chip__dot" }),
                          `${this.totalCount} patient${this.totalCount === 1 ? "" : "s"}`)
                  )
        );
    }
    renderAlerts() {
        const alerts = [];
        if (this.errorMessage) {
            alerts.push(
                h("div", { class: "pr-alert", role: "alert" },
                    icon(PI.alert, 18),
                    h("span", {}, this.errorMessage))
            );
        }
        return alerts;
    }
    renderContent() {
        return h(
            "div",
            { class: "services-list" },
            this.renderSearch(),
            this.renderList(),
            this.renderLoadMore()
        );
    }

    renderSearch() {
        return h(
            "div",
            { class: "pr-search" },
            icon(PI.search, 18),
            h("input", {
                type: "text",
                class: "pr-search__input",
                placeholder: "Search by patient name or email...",
                "aria-label": "Search patients",
                value: this.searchTerm,
                oninput: e => this.setSearchTerm(e.target.value),
            })
        );
    }

    renderList() {
        if (this.patients.length === 0) {
            return h(
                "div",
                { class: "dashboard-card pr-empty" },
                h("span", { class: "pr-empty__icon" }, icon(PI.people, 22)),
                h(
                    "p",
                    { class: "pr-empty__title" },
                    this.searchTerm ? "No matches" : "No patients yet"
                ),
                h(
                    "p",
                    { class: "pr-empty__text" },
                    this.searchTerm
                        ? `No patients match "${this.searchTerm}".`
                        : "Patients you have attended to will appear here."
                )
            );
        }
    
        return h(
            "div",
            { class: "services-list" },
            this.patients.map(patient => this.renderPatientCard(patient))
        );
    }

    renderLoadMore() {
        if (!this.hasMore) return null;
        return h(
            "div",
            { class: "pr-more-wrap" },
            h(
                "button",
                {
                    type: "button",
                    class: "btn btn-outline pr-more",
                    disabled: this.loadingMore,
                    onclick: () => this.loadPatients({ reset: false }),
                },
                this.loadingMore ? "Loading..." : "Load more patients"
            )
        );
    }

    renderPatientCard(patient) {
        const isExpanded = this.selectedPatientId === patient.patient_id;
        const count = patient.consultations_count ?? 0;
        const name = patient.full_name || "Unknown Patient";
        const gender = patient.gender
            ? patient.gender.charAt(0).toUpperCase() + patient.gender.slice(1).toLowerCase()
            : null;
    
        const detail = (iconPaths, label, value) =>
            h(
                "div",
                { class: "pr-detail" },
                h("span", { class: "pr-detail__icon" }, icon(iconPaths, 16)),
                h(
                    "div",
                    {},
                    h("span", { class: "pr-detail__label" }, label),
                    h("span", { class: "pr-detail__value" }, value)
                )
            );
    
        return h(
            "div",
            { class: "dashboard-card service-item-card pr-card" },
            h(
                "div",
                {
                    class: "pr-card__head",
                    role: "button",
                    tabindex: "0",
                    "aria-expanded": String(isExpanded),
                    onclick: () => this.selectPatient(patient.patient_id),
                    onkeydown: e => {
                        if (e.key === "Enter" || e.key === " ") {
                            e.preventDefault();
                            this.selectPatient(patient.patient_id);
                        }
                    },
                },
                h("div", { class: "pr-card__avatar" }, getInitials(name)),
                h(
                    "div",
                    { class: "pr-card__who" },
                    h("h3", { class: "pr-card__name" }, name),
                    h("p", { class: "pr-card__email" }, patient.email || "")
                ),
                h("span", { class: "pr-count" }, `${count} consult${count === 1 ? "" : "s"}`)
            ),
            h(
                "div",
                { class: "pr-card__details" },
                patient.phone_number ? detail(PI.phone, "Phone", patient.phone_number) : null,
                gender ? detail(PI.user, "Gender", gender) : null,
                detail(PI.calendar, "Last seen", this.formatShortDate(patient.last_consultation_at))
            ),
            h(
                "button",
                {
                    type: "button",
                    class: `pr-toggle${isExpanded ? " pr-toggle--open" : ""}`,
                    onclick: () => this.selectPatient(patient.patient_id),
                },
                h("span", {}, isExpanded ? "Hide notes" : "View notes"),
                icon(PI.chevron, 16)
            ),
            isExpanded ? this.renderPatientNotes(patient) : null
        );
    }
    renderPatientNotes(patient) {
        const state = this.notesByPatient[patient.patient_id];
    
        if (!state || state.loading) {
            return h(
                "div",
                { class: "pr-notes", "aria-busy": "true" },
                h("div", { class: "skeleton skeleton--line" }),
                h("div", { class: "skeleton skeleton--line skeleton--short" })
            );
        }
    
        if (this.notesError) {
            return h(
                "div",
                { class: "pr-notes" },
                h("div", { class: "pr-alert", role: "alert" },
                    icon(PI.alert, 18),
                    h("span", {}, this.notesError))
            );
        }
    
        if (!state.rows || state.rows.length === 0) {
            return h(
                "div",
                { class: "pr-notes" },
                h("p", { class: "pr-notes__empty" }, "No consultation notes recorded for this patient yet.")
            );
        }
    
        return h(
            "div",
            { class: "pr-notes" },
            state.rows.map(note => this.renderConsultationNote(note)),
            state.hasMore
                ? h(
                      "div",
                      { class: "pr-more-wrap" },
                      h(
                          "button",
                          {
                              type: "button",
                              class: "btn btn-outline pr-more",
                              disabled: state.loadingMore,
                              onclick: () => this.loadNotesForPatient(patient.patient_id, { reset: false }),
                          },
                          state.loadingMore ? "Loading..." : "Load older notes"
                      )
                  )
                : null
        );
    }

    renderConsultationNote(note) {
        const sections = this.parseDoctorNotes(note.doctor_notes);
        const medications = Array.isArray(note.medications) ? note.medications : [];
    
        return h(
            "div",
            { class: "pr-note" },
            h(
                "div",
                { class: "pr-note__head" },
                h("span", { class: "pr-note__icon" }, icon(PI.file, 16)),
                h(
                    "span",
                    { class: "pr-note__date" },
                    this.formatDate(note.booking_date || note.created_at)
                )
            ),
            note.follow_up_date
                ? h(
                      "p",
                      { class: "pr-followup" },
                      icon(PI.calendar, 14),
                      h("span", {}, `Follow-up due ${this.formatShortDate(note.follow_up_date)}`)
                  )
                : null,
            sections.map(section =>
                h(
                    "div",
                    { class: "pr-section" },
                    h("h4", { class: "pr-section__title" }, section.title),
                    this.splitParagraphs(section.body).map(paragraph =>
                        h("p", { class: "pr-section__text" }, paragraph)
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
            { class: "pr-meds" },
            h(
                "div",
                { class: "pr-meds__head" },
                h("span", { class: "pr-meds__title" }, "Prescription"),
                h(
                    "button",
                    {
                        type: "button",
                        class: "pr-meds__download",
                        onclick: e => {
                            e.stopPropagation();
                            this.downloadPrescription(note);
                        },
                    },
                    icon(PI.download, 14),
                    h("span", {}, "Download")
                )
            ),
            medications.map(med => this.renderMedicationCard(med))
        );
    }
    
    renderMedicationCard(med) {
        const details = [med.dose, med.frequency, med.duration].filter(Boolean).join(" · ");
    
        return h(
            "div",
            { class: "pr-med" },
            h("p", { class: "pr-med__name" }, med.medication || "Unnamed medication"),
            details ? h("p", { class: "pr-med__details" }, details) : null,
            med.instructions ? h("p", { class: "pr-med__instructions" }, med.instructions) : null
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
