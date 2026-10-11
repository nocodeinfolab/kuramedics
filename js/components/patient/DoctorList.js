// js/components/patient/DoctorList.js

import { Component } from "../../core/component.js";
import { h } from "../../utils/dom.js";
import api from "../../services/api.js";

const icon = (paths, size = 18) => h("svg", { viewBox: "0 0 24 24", fill: "none", width: String(size), height: String(size), "aria-hidden": "true" }, ...paths.map(d => h("path", { d, stroke: "currentColor", "stroke-width": "1.8", "stroke-linecap": "round", "stroke-linejoin": "round" })));

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
    truncateBioForLines(bio, approxCharsPerLine = 45, lines = 5) {
        if (!bio) return "";
        const maxChars = approxCharsPerLine * lines;
        if (bio.length <= maxChars) return bio;
        // trim a bit further to leave room for the "See more" text itself
        return bio.slice(0, maxChars - 15).trimEnd() + "… ";
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
            { class: "patient-doctor-list" },
            this.renderHeader(),
            h(
                "div",
                { class: "dl-stack" },
                this.triageResult ? this.renderTriageBanner() : null,
                this.errorMessage ? this.renderError(this.errorMessage) : null,
                this.renderFilters(),
                this.loading ? this.renderSkeleton() : this.renderList(),
                this.renderLoadMore()
            )
        );
    }

    renderError(message) {
        return h(
            "div",
            { class: "dl-alert", role: "alert" },
            h(
                "div",
                { class: "dl-alert-icon" },
                icon(["M12 9v4", "M12 17h.01", "M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"], 18)
            ),
            h("p", { class: "dl-alert-text" }, message)
        );
    }

    renderSkeleton() {
        return h(
            "div",
            { class: "dl-list", "aria-busy": "true", "aria-label": "Loading doctors" },
            ...[0, 1, 2].map(() =>
                h(
                    "div",
                    { class: "dl-card dl-card--skeleton" },
                    h("div", { class: "dl-skel dl-skel--avatar" }),
                    h(
                        "div",
                        { class: "dl-skel-body" },
                        h("div", { class: "dl-skel dl-skel--line dl-skel--short" }),
                        h("div", { class: "dl-skel dl-skel--line dl-skel--tiny" }),
                        h("div", { class: "dl-skel dl-skel--line" })
                    )
                )
            )
        );
    }

    renderHeader() {
        return h(
            "section",
            { class: "dashboard-header patient-home" },
            h(
                "div",
                { class: "ph-hero" },
                h(
                    "button",
                    {
                        class: "ph-hero__back",
                        type: "button",
                        "aria-label": "Back",
                        onclick: () => this.onBackToTriage?.(),
                    },
                    icon(["M15 18l-6-6 6-6"], 18)
                ),
                h(
                    "div",
                    { class: "ph-hero__text" },
                    h("p", { class: "dashboard-greeting" }, "Find Care"),
                    h("h1", { class: "dashboard-title" }, "Choose a doctor")
                )
            )
        );
    }
    renderTriageBanner() {
        return h(
            "div",
            { class: "dl-triage-banner" },
            h(
                "div",
                { class: "dl-triage-icon" },
                icon(["M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8L12 3z"], 18)
            ),
            h(
                "p",
                { class: "dl-triage-text" },
                `Based on what you described, we suggest `,
                h("strong", {}, this.triageResult.suggested_specialization || "General Practice"),
                `. You can change this below if you'd prefer a different specialist.`
            )
        );
    }

    renderFilters() {
        return h(
            "div",
            { class: "dl-filters" },
            h(
                "div",
                { class: "dl-select-wrap" },
                h(
                    "select",
                    {
                        class: "dl-select",
                        "aria-label": "Specialization",
                        value: this.selectedSpecialization,
                        onchange: e => this.setSpecialization(e.target.value),
                    },
                    h("option", { value: "" }, "All specializations"),
                    this.specializations.map(spec =>
                        h("option", { value: spec }, spec)
                    )
                ),
                h("span", { class: "dl-select-chevron" }, icon(["M6 9l6 6 6-6"], 16))
            ),
            h(
                "div",
                { class: "dl-search-row" },
                h(
                    "div",
                    { class: "dl-search-wrap" },
                    h(
                        "span",
                        { class: "dl-search-icon" },
                        icon(["M11 19a8 8 0 1 0 0-16 8 8 0 0 0 0 16", "M21 21l-4.35-4.35"], 16)
                    ),
                    h("input", {
                        type: "text",
                        class: "dl-search-input",
                        placeholder: "Search doctor or clinic",
                        value: this.searchTerm,
                        oninput: e => this.setSearchTerm(e.target.value),
                        onkeydown: e => {
                            if (e.key === "Enter") this.submitSearch();
                        },
                    })
                ),
                h(
                    "button",
                    {
                        class: "dl-search-btn",
                        type: "button",
                        "aria-label": "Search",
                        onclick: () => this.submitSearch(),
                    },
                    h("span", null, "Search")
                )
            )
        );
    }

    renderList() {
        if (this.doctors.length === 0) {
            const filtered = this.selectedSpecialization || this.searchTerm;
            return h(
                "div",
                { class: "dl-empty" },
                h(
                    "div",
                    { class: "dl-empty-icon" },
                    icon(["M11 19a8 8 0 1 0 0-16 8 8 0 0 0 0 16", "M21 21l-4.35-4.35"], 22)
                ),
                h(
                    "p",
                    { class: "dl-empty-title" },
                    filtered ? "No doctors match your filters" : "No doctors available right now"
                ),
                h(
                    "p",
                    { class: "dl-empty-text" },
                    filtered
                        ? "Try a different specialization or clear your search."
                        : "Please check back in a moment."
                )
            );
        }

        return h(
            "div",
            { class: "dl-list" },
            this.doctors.map(doctor => this.renderDoctorCard(doctor))
        );
    }

    renderDoctorCard(doctor) {
        const initial = (doctor.full_name || "?").charAt(0).toUpperCase();
        const bio = doctor.bio ? this.truncateBioForLines(doctor.bio) : "";
        const showSeeMore = doctor.bio && doctor.bio.length > (45 * 5);

        return h(
            "button",
            {
                class: "dl-card",
                type: "button",
                onclick: () => this.selectDoctor(doctor),
            },
            h(
                "div",
                { class: "dl-card-row" },
                doctor.avatar_url
                    ? h("img", {
                          class: "dl-avatar",
                          src: doctor.avatar_url,
                          alt: doctor.full_name || "Doctor",
                      })
                    : h("div", { class: "dl-avatar dl-avatar--initial" }, initial),
                h(
                    "div",
                    { class: "dl-card-body" },
                    h("h3", { class: "dl-name" }, doctor.full_name || "Unnamed Doctor"),
                    h(
                        "span",
                        { class: "dl-chip" },
                        doctor.specialization || "General Practice"
                    ),
                    doctor.years_of_experience
                        ? h(
                              "p",
                              { class: "dl-meta" },
                              `${doctor.years_of_experience} years of experience`
                          )
                        : null,
                    doctor.clinic_name
                        ? h("p", { class: "dl-meta" }, doctor.clinic_name)
                        : null
                ),
                h(
                    "span",
                    { class: "dl-chevron" },
                    icon(["M9 6l6 6-6 6"], 18)
                )
            ),
            bio
                ? h(
                      "p",
                      { class: "dl-bio" },
                      bio,
                      showSeeMore
                          ? h("span", { class: "dl-bio-more" }, "See more")
                          : null
                  )
                : null
        );
    }

    renderLoadMore() {
        if (!this.hasMore || this.loading) return null;

        return h(
            "div",
            { class: "dl-load-more-wrap" },
            h(
                "button",
                {
                    class: "dl-load-more",
                    type: "button",
                    disabled: this.loadingMore,
                    onclick: () => this.loadDoctors({ reset: false }),
                },
                this.loadingMore
                    ? h("span", { class: "dl-spinner" })
                    : null,
                h("span", null, this.loadingMore ? "Loading…" : "Load more")
            )
        );
    }

    update() {
        if (!this.el) return;
        const newTree = this.render();
        this.el.replaceChildren(...(Array.isArray(newTree) ? newTree : [newTree]).flat());
    }
}
