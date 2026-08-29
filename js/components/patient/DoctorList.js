// js/components/patient/DoctorList.js

import { Component } from "../../core/component.js";
import { h } from "../../utils/dom.js";
import api from "../../services/api.js";

const PAGE_LIMIT = 10;

export default class DoctorList extends Component {
    /**
     * @param {object} patient
     * @param {object|null} triageResult - result from TriageForm, or null if skipped
     * @param {(doctor: object) => void} onSelectDoctor
     * @param {() => void} onBackToTriage
     */
    constructor(patient, triageResult, onSelectDoctor, onBackToTriage) {
        super();
        this.patient = patient ?? {};
        this.triageResult = triageResult ?? null;
        this.onSelectDoctor = onSelectDoctor;
        this.onBackToTriage = onBackToTriage;

        this.loading = true;
        this.loadingMore = false;
        this.errorMessage = "";

        this.doctors = [];
        this.page = 0;
        this.hasMore = true;
        this.totalCount = 0;

        this.specializations = [];
        this.selectedSpecialization = triageResult?.suggested_specialization || "";
        this.searchTerm = "";
    }

    async afterMount() {
        await Promise.all([
            this.loadSpecializations(),
            this.loadDoctors({ reset: true }),
        ]);
    }

    // ---------- Data loading ----------

    async loadSpecializations() {
        try {
            const res = await api.get("/directory/specializations");
            const payload = res.data || res;
            this.specializations = Array.isArray(payload) ? payload : payload.rows || payload.data || [];
            this.update();
        } catch (error) {
            console.error("Failed to load specializations:", error);
            // Non-critical — the dropdown just won't populate. Doctor list still works.
        }
    }

    async loadDoctors({ reset = false } = {}) {
        if (reset) {
            this.loading = true;
            this.page = 0;
            this.doctors = [];
            this.hasMore = true;
        } else {
            this.loadingMore = true;
        }
        this.errorMessage = "";
        this.update();

        try {
            const nextPage = this.page + 1;
            const params = new URLSearchParams({
                page: String(nextPage),
                limit: String(PAGE_LIMIT),
            });
            if (this.selectedSpecialization) params.set("specialization", this.selectedSpecialization);
            if (this.searchTerm.trim()) params.set("search", this.searchTerm.trim());

            const res = await api.get(`/directory?${params.toString()}`);
            const payload = res.data || res;
            const rows = payload.rows || payload.data || payload.items || [];
            const total = payload.total ?? payload.count ?? rows.length;

            this.doctors = reset ? rows : [...this.doctors, ...rows];
            this.totalCount = total;
            this.page = nextPage;
            this.hasMore = this.doctors.length < total;
        } catch (error) {
            console.error("Failed to load doctors:", error);
            this.errorMessage = error.message || "Failed to load doctors.";
        } finally {
            this.loading = false;
            this.loadingMore = false;
            this.update();
        }
    }

    // ---------- Interaction ----------

    setSpecialization(value) {
        this.selectedSpecialization = value;
        this.loadDoctors({ reset: true });
    }

    setSearchTerm(value) {
        this.searchTerm = value;
        this.update();
    }

    submitSearch() {
        this.loadDoctors({ reset: true });
    }

    selectDoctor(doctor) {
        if (typeof this.onSelectDoctor === "function") {
            this.onSelectDoctor(doctor);
        }
    }

    // ---------- Render ----------

    render() {
        return h(
            "div",
            { class: "dashboard-page queue-page" },
            this.renderHeader(),
            this.triageResult ? this.renderTriageBanner() : null,
            this.errorMessage
                ? h(
                      "div",
                      { class: "dashboard-card", style: "border-left: 4px solid #ef4444; margin-bottom: var(--space-3);" },
                      h("p", { style: "color: #ef4444; margin: 0;" }, this.errorMessage)
                  )
                : null,
            this.renderFilters(),
            this.loading
                ? h(
                      "div",
                      { class: "dashboard-card text-center py-4" },
                      h("p", { class: "dashboard-muted" }, "Loading doctors...")
                  )
                : this.renderList(),
            this.renderLoadMore()
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
                    onclick: () => this.onBackToTriage?.(),
                },
                "← Back"
            ),
            h(
                "div",
                {},
                h("p", { class: "dashboard-greeting" }, "Find Care"),
                h("h1", { class: "dashboard-title" }, "Choose a doctor")
            )
        );
    }

    renderTriageBanner() {
        return h(
            "div",
            {
                class: "dashboard-card",
                style: "padding: 0.85rem 1rem; margin-bottom: var(--space-3); background: rgba(2,132,199,0.04);",
            },
            h(
                "p",
                { style: "margin: 0; font-size: 0.85rem;" },
                `Based on what you described, we suggest `,
                h("strong", {}, this.triageResult.suggested_specialization || "General Practice"),
                `. You can change this below if you'd prefer a different specialist.`
            )
        );
    }

    renderFilters() {
        return h(
            "div",
            {
                class: "dashboard-card",
                style: "display: flex; flex-direction: column; gap: 10px; padding: 0.85rem 1rem; margin-bottom: var(--space-3);",
            },
            h(
                "select",
                {
                    value: this.selectedSpecialization,
                    style: "width: 100%; padding: 0.55rem 0.7rem; border: 1px solid var(--color-line); border-radius: 6px; font-size: 0.88rem; box-sizing: border-box;",
                    onchange: e => this.setSpecialization(e.target.value),
                },
                h("option", { value: "" }, "All specializations"),
                this.specializations.map(spec =>
                    h("option", { value: spec }, spec)
                )
            ),
            h(
                "div",
                { style: "display: flex; gap: 8px;" },
                h("input", {
                    type: "text",
                    placeholder: "Search by doctor or clinic name...",
                    value: this.searchTerm,
                    style: "flex: 1; padding: 0.55rem 0.7rem; border: 1px solid var(--color-line); border-radius: 6px; font-size: 0.88rem; box-sizing: border-box;",
                    oninput: e => this.setSearchTerm(e.target.value),
                    onkeydown: e => {
                        if (e.key === "Enter") this.submitSearch();
                    },
                }),
                h(
                    "button",
                    {
                        class: "btn btn-outline",
                        style: "padding: 0.5rem 0.9rem; font-size: 0.82rem; border-radius: 6px; flex-shrink: 0;",
                        onclick: () => this.submitSearch(),
                    },
                    "Search"
                )
            )
        );
    }

    renderList() {
        if (this.doctors.length === 0) {
            return h(
                "div",
                { class: "dashboard-card text-center py-4" },
                h(
                    "p",
                    { class: "dashboard-muted" },
                    this.selectedSpecialization || this.searchTerm
                        ? "No doctors match your filters right now."
                        : "No doctors are available right now."
                )
            );
        }

        return h(
            "div",
            { class: "services-list" },
            this.doctors.map(doctor => this.renderDoctorCard(doctor))
        );
    }

    renderDoctorCard(doctor) {
        return h(
            "div",
            {
                class: "dashboard-card service-item-card",
                style: "padding: 1rem 1.1rem; margin-bottom: var(--space-3); cursor: pointer;",
                onclick: () => this.selectDoctor(doctor),
            },
            h(
                "div",
                { style: "display: flex; gap: 12px; align-items: flex-start;" },
                doctor.avatar_url
                    ? h("img", {
                          src: doctor.avatar_url,
                          alt: doctor.full_name || "Doctor",
                          style: "width: 48px; height: 48px; border-radius: 50%; object-fit: cover; flex-shrink: 0;",
                      })
                    : h(
                          "div",
                          {
                              style: "width: 48px; height: 48px; border-radius: 50%; background: var(--color-bg-muted, #f1f5f9); display: flex; align-items: center; justify-content: center; flex-shrink: 0; font-weight: 600; color: var(--color-primary, #0284c7);",
                          },
                          (doctor.full_name || "?").charAt(0).toUpperCase()
                      ),
                h(
                    "div",
                    { style: "min-width: 0; flex: 1;" },
                    h(
                        "h3",
                        { style: "margin: 0 0 4px; font-size: 1.0rem; font-weight: 600; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;" },
                        doctor.full_name || "Unnamed Doctor"
                    ),
                    h(
                        "span",
                        {
                            class: "dashboard-badge",
                            style: "background: var(--color-primary, #0284c7); font-size: 0.7rem; padding: 3px 9px; border-radius: 5px; white-space: nowrap;",
                        },
                        doctor.specialization || "General Practice"
                    ),
                    doctor.years_of_experience
                        ? h(
                              "p",
                              { class: "dashboard-muted", style: "margin: 6px 0 0; font-size: 0.8rem;" },
                              `${doctor.years_of_experience} years of experience`
                          )
                        : null,
                    doctor.clinic_name
                        ? h(
                              "p",
                              { class: "dashboard-muted", style: "margin: 4px 0 0; font-size: 0.8rem;" },
                              doctor.clinic_name
                          )
                        : null,
                    doctor.bio
                        ? h(
                              "p",
                              { style: "margin: 8px 0 0; font-size: 0.84rem; line-height: 1.45; overflow: hidden; text-overflow: ellipsis; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical;" },
                              doctor.bio,
                              " ",
                              h(
                                  "span",
                                  { style: "color: var(--color-primary, #0284c7); font-weight: 600; white-space: nowrap;" },
                                  "See more"
                              )
                          )
                        : null
                )
            )
        );
    }

    renderLoadMore() {
        if (!this.hasMore || this.loading) return null;

        return h(
            "div",
            { class: "text-center", style: "margin-top: var(--space-2);" },
            h(
                "button",
                {
                    class: "btn btn-outline",
                    style: "padding: 0.35rem 0.8rem; font-size: 0.75rem; border-radius: 5px;",
                    disabled: this.loadingMore,
                    onclick: () => this.loadDoctors({ reset: false }),
                },
                this.loadingMore ? "Loading..." : "Load More"
            )
        );
    }

    update() {
        if (!this.el) return;
        const newTree = this.render();
        this.el.replaceChildren(...(Array.isArray(newTree) ? newTree : [newTree]).flat());
    }
}
