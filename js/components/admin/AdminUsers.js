import { Component } from "../../core/component.js";
import { h } from "../../utils/dom.js";
import api from "../../services/api.js";

export default class AdminUsers extends Component {
    constructor() {
        super();
        this.doctors = [];
        this.patients = [];
        this.activeFilter = "doctors";
        this.loading = true;
        this.actingId = null;
        this.errorMessage = "";
        this.successMessage = "";
    }

    async afterMount() {
        await this.loadUsers();
    }

    async loadUsers() {
        this.loading = true;
        this.errorMessage = "";
        this.update();

        try {
            const res = await api.get("/admin/users?limit=50");
            const payload = res.data || res;
            this.doctors = payload.doctors || [];
            this.patients = payload.patients || [];
        } catch (error) {
            console.error("Failed to load users:", error);
            this.errorMessage = error.message || "Failed to load users.";
        } finally {
            this.loading = false;
            this.update();
        }
    }

    async handleAction(userId, action) {
        let notes = "";
        if (action !== "restore") {
            notes = window.prompt(`Add a note for this ${action} action (optional):`) || "";
        }
        if (action === "remove" && !window.confirm("This permanently deletes the user account. Continue?")) {
            return;
        }

        this.actingId = userId;
        this.errorMessage = "";
        this.successMessage = "";
        this.update();

        try {
            await api.patch(`/admin/users/${userId}/access`, { action, notes });
            this.successMessage = `User account ${action}d successfully.`;
            await this.loadUsers();
        } catch (error) {
            console.error("Failed to update user access:", error);
            this.errorMessage = error.message || "Failed to update user access.";
        } finally {
            this.actingId = null;
            this.update();
        }
    }

    setFilter(filter) {
        if (this.activeFilter === filter) return;
        this.activeFilter = filter;
        this.update();
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
            this.renderTabs(),
            this.loading
                ? h("div", { class: "admin-card admin-empty-state" }, "Loading users...")
                : this.renderUserList()
        );
    }

    renderHeader() {
        return h(
            "div",
            { class: "admin-header" },
            h(
                "div",
                {},
                h("p", { class: "admin-header__eyebrow" }, "Accounts"),
                h("h1", { class: "admin-header__title" }, "Users"),
                h("p", { class: "admin-header__subtitle" }, "Suspend, restore, or remove doctor and patient accounts.")
            )
        );
    }

    renderAlerts() {
        const alerts = [];
        if (this.errorMessage) alerts.push(h("div", { class: "admin-alert admin-alert--error" }, this.errorMessage));
        if (this.successMessage) alerts.push(h("div", { class: "admin-alert admin-alert--success" }, this.successMessage));
        return alerts;
    }

    renderTabs() {
        return h(
            "div",
            { class: "admin-tabs" },
            h("button", { class: `admin-tab ${this.activeFilter === "doctors" ? "admin-tab--active" : ""}`, onclick: () => this.setFilter("doctors") }, `Doctors (${this.doctors.length})`),
            h("button", { class: `admin-tab ${this.activeFilter === "patients" ? "admin-tab--active" : ""}`, onclick: () => this.setFilter("patients") }, `Patients (${this.patients.length})`)
        );
    }

    renderUserList() {
        const list = this.activeFilter === "doctors" ? this.doctors : this.patients;

        return h(
            "div",
            { class: "admin-card" },
            list.length === 0
                ? h("p", { class: "admin-muted" }, `No ${this.activeFilter} found.`)
                : h("div", { class: "admin-row-list" }, list.map(user => this.renderUserRow(user)))
        );
    }

    renderUserRow(user) {
        const isActing = this.actingId === user.id;
        const status = user.account_status || "active";
        const pillTone = status === "active" ? "success" : "danger";

        return h(
            "div",
            { class: "admin-row" },
            h(
                "div",
                { class: "admin-row__top" },
                h(
                    "div",
                    { style: "min-width: 0;" },
                    h("p", { class: "admin-row__title" }, user.full_name || "Unnamed"),
                    h("p", { class: "admin-row__subtitle" }, user.email),
                    h("p", { class: "admin-row__meta" }, `Joined: ${this.formatDate(user.created_at)}${user.specialization ? ` · ${user.specialization}` : ""}`)
                ),
                h("span", { class: `admin-pill admin-pill--${pillTone}` }, status)
            ),
            h(
                "div",
                { class: "admin-row__actions" },
                status === "active"
                    ? h("button", { class: "btn btn-ghost admin-btn-sm", style: "color: #ef4444; border-color: #ef4444;", disabled: isActing, onclick: () => this.handleAction(user.id, "suspend") }, "Suspend")
                    : h("button", { class: "btn btn-primary admin-btn-sm", disabled: isActing, onclick: () => this.handleAction(user.id, "restore") }, "Restore"),
                h("button", { class: "btn btn-ghost admin-btn-sm", style: "color: #ef4444; border-color: #ef4444;", disabled: isActing, onclick: () => this.handleAction(user.id, "remove") }, "Remove")
            )
        );
    }

    update() {
        if (!this.el) return;
        const newTree = this.render();
        this.el.replaceChildren(...(Array.isArray(newTree) ? newTree : [newTree]).flat());
    }
}
