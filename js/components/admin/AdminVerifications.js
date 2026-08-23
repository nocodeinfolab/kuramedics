import { Component } from "../../core/component.js";
import { h } from "../../utils/dom.js";
import api from "../../services/api.js";

export default class AdminVerifications extends Component {
    constructor(onPendingCountChanged) {
        super();
        this.onPendingCountChanged = typeof onPendingCountChanged === "function" ? onPendingCountChanged : () => {};
        this.queue = [];
        this.loading = true;
        this.reviewingId = null;
        this.errorMessage = "";
        this.successMessage = "";
    }

    async afterMount() {
        await this.loadQueue();
    }

    async loadQueue() {
        this.loading = true;
        this.errorMessage = "";
        this.update();

        try {
            const res = await api.get("/admin/doctor-verifications");
            const payload = res.data || res;
            this.queue = payload.items || payload.rows || payload.data || [];

            const pendingCount = this.queue.filter(d => d.verification_status === "pending_review").length;
            this.onPendingCountChanged(pendingCount);
        } catch (error) {
            console.error("Failed to load verification queue:", error);
            this.errorMessage = error.message || "Failed to load verification queue.";
        } finally {
            this.loading = false;
            this.update();
        }
    }

    async handleReview(doctorId, action) {
        let notes = "";
        if (["reject", "request_correction", "suspend"].includes(action)) {
            notes = window.prompt("Please provide a reason (required for this action):") || "";
            if (!notes.trim()) {
                this.errorMessage = "Review notes are required for this action.";
                this.update();
                return;
            }
        }

        this.reviewingId = doctorId;
        this.errorMessage = "";
        this.successMessage = "";
        this.update();

        try {
            const res = await api.patch(`/admin/doctor-verifications/${doctorId}`, { action, notes });
            const updated = res.data || res;
            this.successMessage = `Doctor verification updated to "${updated.verification_status || action}".`;
            await this.loadQueue();
        } catch (error) {
            console.error("Failed to review doctor verification:", error);
            this.errorMessage = error.message || "Failed to update verification status.";
        } finally {
            this.reviewingId = null;
            this.update();
        }
    }

    formatDate(dateString) {
        if (!dateString) return "N/A";
        return new Date(dateString).toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" });
    }

    render() {
        return h(
            "div",
            {},
            this.renderHeader(),
            this.renderAlerts(),
            this.loading
                ? h("div", { class: "admin-card admin-empty-state" }, "Loading verification queue...")
                : this.renderQueue()
        );
    }

    renderHeader() {
        return h(
            "div",
            { class: "admin-header" },
            h(
                "div",
                {},
                h("p", { class: "admin-header__eyebrow" }, "Compliance"),
                h("h1", { class: "admin-header__title" }, "Doctor Verifications"),
                h("p", { class: "admin-header__subtitle" }, "Review submitted credentials and approve or reject doctor profiles.")
            )
        );
    }

    renderAlerts() {
        const alerts = [];
        if (this.errorMessage) alerts.push(h("div", { class: "admin-alert admin-alert--error" }, this.errorMessage));
        if (this.successMessage) alerts.push(h("div", { class: "admin-alert admin-alert--success" }, this.successMessage));
        return alerts;
    }

    renderQueue() {
        const pending = this.queue.filter(d => d.verification_status === "pending_review");
        const others = this.queue.filter(d => d.verification_status !== "pending_review");

        return h(
            "div",
            {},
            h(
                "div",
                { class: "admin-card" },
                h(
                    "div",
                    { class: "admin-card__header" },
                    h("h3", { class: "admin-card__title" }, `Pending Review (${pending.length})`)
                ),
                pending.length === 0
                    ? h("p", { class: "admin-muted" }, "No doctors awaiting review.")
                    : h("div", { class: "admin-row-list" }, pending.map(d => this.renderDoctorRow(d)))
            ),
            others.length > 0
                ? h(
                      "div",
                      { class: "admin-card" },
                      h("div", { class: "admin-card__header" }, h("h3", { class: "admin-card__title" }, "Other Doctors")),
                      h("div", { class: "admin-row-list" }, others.map(d => this.renderDoctorRow(d)))
                  )
                : null
        );
    }

    renderDoctorRow(doctor) {
        const isReviewing = this.reviewingId === doctor.user_id;
        const pillTone = {
            unsubmitted: "neutral", pending_review: "warning", verified: "success", rejected: "danger", suspended: "danger",
        }[doctor.verification_status] || "neutral";

        return h(
            "div",
            { class: "admin-row" },
            h(
                "div",
                { class: "admin-row__top" },
                h(
                    "div",
                    { style: "min-width: 0;" },
                    h("p", { class: "admin-row__title" }, doctor.full_name || "Unnamed Doctor"),
                    h("p", { class: "admin-row__subtitle" }, doctor.email),
                    h("p", { class: "admin-row__meta" }, `${doctor.specialization || "General Practice"} · MDCN: ${doctor.mdcn_registration_number || "Not provided"}`),
                    h("p", { class: "admin-row__meta" }, `Submitted: ${this.formatDate(doctor.verification_submitted_at)}`)
                ),
                h("span", { class: `admin-pill admin-pill--${pillTone}` }, (doctor.verification_status || "unsubmitted").replace("_", " "))
            ),
            doctor.verification_notes
                ? h("p", { class: "admin-muted", style: "font-style: italic;" }, `Notes: ${doctor.verification_notes}`)
                : null,
            h(
                "div",
                { class: "admin-row__actions" },
                h("button", { class: "btn btn-primary admin-btn-sm", disabled: isReviewing, onclick: () => this.handleReview(doctor.user_id, "approve") }, isReviewing ? "..." : "Approve"),
                h("button", { class: "btn btn-ghost admin-btn-sm", disabled: isReviewing, onclick: () => this.handleReview(doctor.user_id, "reject") }, "Reject"),
                h("button", { class: "btn btn-ghost admin-btn-sm", disabled: isReviewing, onclick: () => this.handleReview(doctor.user_id, "request_correction") }, "Request Correction"),
                doctor.verification_status === "verified"
                    ? h("button", { class: "btn btn-ghost admin-btn-sm", style: "color: #ef4444; border-color: #ef4444;", disabled: isReviewing, onclick: () => this.handleReview(doctor.user_id, "suspend") }, "Suspend")
                    : null
            )
        );
    }

    update() {
        if (!this.el) return;
        const newTree = this.render();
        this.el.replaceChildren(...(Array.isArray(newTree) ? newTree : [newTree]).flat());
    }
}
