import { Component } from "../../core/component.js";
import { h } from "../../utils/dom.js";
import api from "../../services/api.js";

export default class AdminOverview extends Component {
    constructor() {
        super();
        this.stats = null;
        this.loading = true;
        this.errorMessage = "";
    }

    async afterMount() {
        await this.loadStats();
    }

    async loadStats() {
        this.loading = true;
        this.errorMessage = "";
        this.update();

        try {
            const res = await api.get("/admin/stats");
            this.stats = res.data || res;
        } catch (error) {
            console.error("Failed to load admin stats:", error);
            this.errorMessage = error.message || "Failed to load platform stats.";
        } finally {
            this.loading = false;
            this.update();
        }
    }

    formatCurrency(amount) {
        return new Intl.NumberFormat("en-NG", { style: "currency", currency: "NGN", maximumFractionDigits: 0 }).format(amount || 0);
    }

    render() {
        return h(
            "div",
            {},
            this.renderHeader(),
            this.errorMessage ? h("div", { class: "admin-alert admin-alert--error" }, this.errorMessage) : null,
            this.loading
                ? h("div", { class: "admin-card admin-empty-state" }, "Loading platform overview...")
                : this.renderStats()
        );
    }

    renderHeader() {
        return h(
            "div",
            { class: "admin-header" },
            h(
                "div",
                {},
                h("p", { class: "admin-header__eyebrow" }, "Dashboard"),
                h("h1", { class: "admin-header__title" }, "Platform Overview"),
                h("p", { class: "admin-header__subtitle" }, "Key metrics across doctors, patients, bookings, and revenue.")
            )
        );
    }

    renderStats() {
        const overview = this.stats?.overview || {};
        const doctors = this.stats?.doctors || {};

        return h(
            "div",
            {},
            h(
                "div",
                { class: "admin-stats-grid" },
                this.statCard("Total Doctors", overview.totalDoctors ?? 0),
                this.statCard("Total Patients", overview.totalPatients ?? 0),
                this.statCard("Total Bookings", overview.totalBookings ?? 0),
                this.statCard("Revenue This Month", this.formatCurrency(overview.revenueMonth)),
                this.statCard("Pending Verifications", doctors.pendingReview ?? 0),
                this.statCard("Verified Doctors", doctors.verified ?? 0)
            )
        );
    }

    statCard(label, value) {
        return h(
            "div",
            { class: "admin-stat-card" },
            h("p", { class: "admin-stat-card__label" }, label),
            h("p", { class: "admin-stat-card__value" }, String(value))
        );
    }

    update() {
        if (!this.el) return;
        const newTree = this.render();
        this.el.replaceChildren(...(Array.isArray(newTree) ? newTree : [newTree]).flat());
    }
}
