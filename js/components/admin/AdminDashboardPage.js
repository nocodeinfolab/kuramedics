import { Component } from "../../core/component.js";
import { h } from "../../utils/dom.js";
import api from "../../services/api.js";

export default class AdminDashboardPage extends Component {
    constructor() {
        super();

        this.activeTab = "verifications";
        this.loading = true;
        this.admin = null;
        this.accessDenied = false;

        this.queue = [];
        this.queueLoading = true;
        this.reviewingId = null;
        this.errorMessage = "";
        this.successMessage = "";

        this.tabs = [
            { id: "verifications", label: "Verifications" },
        ];
    }

    afterMount() {
        this.checkAccessAndLoad();
    }

    checkAccessAndLoad() {
        const token = localStorage.getItem("accessToken");
        const cachedUser = localStorage.getItem("user");

        if (!token || !cachedUser) {
            window.location.hash = "/admin/login";
            return;
        }

        let user;
        try {
            user = JSON.parse(cachedUser);
        } catch {
            window.location.hash = "/admin/login";
            return;
        }

        if (user.role !== "admin") {
            this.accessDenied = true;
            this.loading = false;
            this.update();
            return;
        }

        this.admin = user;
        this.loading = false;
        this.update();
        this.loadVerificationQueue();
    }

    async loadVerificationQueue() {
        this.queueLoading = true;
        this.errorMessage = "";
        this.update();

        try {
            const res = await api.get("/admin/doctor-verifications");
            const payload = res.data || res;
            this.queue = payload.items || payload.rows || payload.data || [];
        } catch (error) {
            console.error("Failed to load verification queue:", error);
            this.errorMessage = error.message || "Failed to load verification queue.";
        } finally {
            this.queueLoading = false;
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
            await this.loadVerificationQueue();
        } catch (error) {
            console.error("Failed to review doctor verification:", error);
            this.errorMessage = error.message || "Failed to update verification status.";
        } finally {
            this.reviewingId = null;
            this.update();
        }
    }

    logout() {
        localStorage.removeItem("accessToken");
        localStorage.removeItem("refreshToken");
        localStorage.removeItem("user");
        window.location.hash = "/admin/login";
    }

    formatDate(dateString) {
        if (!dateString) return "N/A";
        return new Date(dateString).toLocaleDateString(undefined, {
            year: "numeric",
            month: "short",
            day: "numeric",
        });
    }

    render() {
        if (this.loading) {
            return h("div", { class: "dashboard-loading" }, "Loading admin dashboard...");
        }

        if (this.accessDenied) {
            return h(
                "div",
                { class: "dashboard-page", style: "max-width: 480px; margin: 60px auto; padding: var(--space-3); text-align: center;" },
                h("h1", { class: "dashboard-title", style: "color: var(--color-ink);" }, "Access Denied"),
                h("p", { class: "dashboard-muted" }, "This account does not have admin access."),
                h(
                    "button",
                    { class: "btn btn-primary", style: "margin-top: var(--space-4);", onclick: () => { window.location.hash = "/"; } },
                    "Return Home"
                )
            );
        }

        return h(
            "div",
            { class: "dashboard-page", style: "max-width: 900px; margin: 0 auto; padding: var(--space-5);" },
            this.renderHeader(),
            this.renderAlerts(),
            this.renderVerificationQueue()
        );
    }

    renderHeader() {
        return h(
            "section",
            { class: "dashboard-header", style: "display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 12px;" },
            h(
                "div",
                {},
                h("p", { class: "dashboard-greeting" }, "Admin"),
                h("h1", { class: "dashboard-title" }, "Doctor Verifications")
            ),
            h(
                "button",
                {
                    class: "btn btn-outline",
                    style: "color: var(--color-white); border-color: rgba(255,255,255,0.4);",
                    onclick: () => this.logout(),
                },
                "Log Out"
            )
        );
    }

    renderAlerts() {
        const alerts = [];
        if (this.errorMessage) {
            alerts.push(
                h("div", { class: "dashboard-card", style: "border-left: 4px solid #ef4444; margin-bottom: var(--space-3);" },
                    h("p", { style: "color: #ef4444; margin: 0;" }, this.errorMessage))
            );
        }
        if (this.successMessage) {
            alerts.push(
                h("div", { class: "dashboard-card", style: "border-left: 4px solid #10b981; margin-bottom: var(--space-3);" },
                    h("p", { style: "color: #10b981; margin: 0;" }, this.successMessage))
            );
        }
        return alerts;
    }

    renderVerificationQueue() {
        if (this.queueLoading) {
            return h("div", { class: "dashboard-card text-center py-4" },
                h("p", { class: "dashboard-muted" }, "Loading verification queue..."));
        }

        const pending = this.queue.filter(d => d.verification_status === "pending_review");
        const others = this.queue.filter(d => d.verification_status !== "pending_review");

        return h(
            "div",
            { class: "services-list" },
            h("h3", { style: "margin: 0 0 var(--space-2);" }, `Pending Review (${pending.length})`),
            pending.length === 0
                ? h("div", { class: "dashboard-card" }, h("p", { class: "dashboard-muted" }, "No doctors awaiting review."))
                : pending.map(d => this.renderDoctorRow(d)),

            others.length > 0
                ? h("h3", { style: "margin: var(--space-5) 0 var(--space-2);" }, "Other Doctors")
                : null,
            ...others.map(d => this.renderDoctorRow(d))
        );
    }

    renderDoctorRow(doctor) {
        const isReviewing = this.reviewingId === doctor.user_id;
        const statusColors = {
            unsubmitted: "var(--color-ink-faint)",
            pending_review: "#f59e0b",
            verified: "#10b981",
            rejected: "#ef4444",
            suspended: "#ef4444",
        };

        return h(
            "div",
            { class: "dashboard-card service-item-card" },
            h(
                "div",
                { style: "display: flex; justify-content: space-between; align-items: flex-start; gap: var(--space-3);" },
                h(
                    "div",
                    { style: "min-width: 0;" },
                    h("h3", { style: "margin: 0 0 4px;" }, doctor.full_name || "Unnamed Doctor"),
                    h("p", { class: "dashboard-muted", style: "margin: 0; font-size: 0.85rem;" }, doctor.email),
                    h("p", { class: "dashboard-muted", style: "margin: 4px 0 0; font-size: 0.8rem;" },
                        `${doctor.specialization || "General Practice"} · MDCN: ${doctor.mdcn_registration_number || "Not provided"}`),
                    h("p", { class: "dashboard-muted", style: "margin: 4px 0 0; font-size: 0.78rem;" },
                        `Submitted: ${this.formatDate(doctor.verification_submitted_at)}`)
                ),
                h(
                    "span",
                    {
                        class: "dashboard-badge",
                        style: `background: ${statusColors[doctor.verification_status] || "var(--color-ink-faint)"}; white-space: nowrap;`,
                    },
                    (doctor.verification_status || "unsubmitted").replace("_", " ")
                )
            ),
            doctor.verification_notes
                ? h("p", { class: "dashboard-muted", style: "margin-top: 8px; font-size: 0.8rem; font-style: italic;" },
                    `Notes: ${doctor.verification_notes}`)
                : null,
            h(
                "div",
                { style: "display: flex; gap: 8px; margin-top: var(--space-3); flex-wrap: wrap;" },
                h("button", {
                    class: "btn btn-primary",
                    style: "padding: 0.4rem 0.8rem; font-size: 0.8rem;",
                    disabled: isReviewing,
                    onclick: () => this.handleReview(doctor.user_id, "approve"),
                }, isReviewing ? "..." : "Approve"),
                h("button", {
                    class: "btn btn-outline",
                    style: "padding: 0.4rem 0.8rem; font-size: 0.8rem;",
                    disabled: isReviewing,
                    onclick: () => this.handleReview(doctor.user_id, "reject"),
                }, "Reject"),
                h("button", {
                    class: "btn btn-outline",
                    style: "padding: 0.4rem 0.8rem; font-size: 0.8rem;",
                    disabled: isReviewing,
                    onclick: () => this.handleReview(doctor.user_id, "request_correction"),
                }, "Request Correction"),
                doctor.verification_status === "verified"
                    ? h("button", {
                        class: "btn btn-outline",
                        style: "padding: 0.4rem 0.8rem; font-size: 0.8rem; color: #ef4444; border-color: #ef4444;",
                        disabled: isReviewing,
                        onclick: () => this.handleReview(doctor.user_id, "suspend"),
                    }, "Suspend")
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
