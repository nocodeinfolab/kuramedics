import { Component } from "../../core/component.js";
import { h } from "../../utils/dom.js";
import AdminOverview from "./AdminOverview.js";
import AdminVerifications from "./AdminVerifications.js";
import AdminUsers from "./AdminUsers.js";
import AdminSubscriptionSettings from "./AdminSubscriptionSettings.js";
import AdminAppUpdates from "./AdminAppUpdates.js";

const Icons = {
    grid: () => h("svg", { width: "18", height: "18", viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", "stroke-width": "2", "stroke-linecap": "round", "stroke-linejoin": "round" },
        h("rect", { x: "3", y: "3", width: "7", height: "7" }), h("rect", { x: "14", y: "3", width: "7", height: "7" }),
        h("rect", { x: "14", y: "14", width: "7", height: "7" }), h("rect", { x: "3", y: "14", width: "7", height: "7" })),
    shield: () => h("svg", { width: "18", height: "18", viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", "stroke-width": "2", "stroke-linecap": "round", "stroke-linejoin": "round" },
        h("path", { d: "M12 22s8-4 8-11V5l-8-3-8 3v6c0 7 8 11 8 11z" })),
    people: () => h("svg", { width: "18", height: "18", viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", "stroke-width": "2", "stroke-linecap": "round", "stroke-linejoin": "round" },
        h("path", { d: "M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" }), h("circle", { cx: "9", cy: "7", r: "4" }),
        h("path", { d: "M23 21v-2a4 4 0 0 0-3-3.87" }), h("path", { d: "M16 3.13a4 4 0 0 1 0 7.75" })),
    settings: () => h("svg", { width: "18", height: "18", viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", "stroke-width": "2", "stroke-linecap": "round", "stroke-linejoin": "round" },
        h("circle", { cx: "12", cy: "12", r: "3" }),
        h("path", { d: "M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" })),
    logout: () => h("svg", { width: "18", height: "18", viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", "stroke-width": "2", "stroke-linecap": "round", "stroke-linejoin": "round" },
        h("path", { d: "M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" }), h("polyline", { points: "16 17 21 12 16 7" }), h("line", { x1: "21", y1: "12", x2: "9", y2: "12" })),
    refresh: () => h("svg", { width: "18", height: "18", viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", "stroke-width": "2", "stroke-linecap": "round", "stroke-linejoin": "round" },
        h("polyline", { points: "23 4 23 10 17 10" }), h("polyline", { points: "1 20 1 14 7 14" }),
        h("path", { d: "M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15" })),
};

export default class AdminDashboardPage extends Component {
    constructor() {
        super();
        this.activeSection = "overview";
        this.loading = true;
        this.admin = null;
        this.accessDenied = false;
        this.pendingCount = 0;
        this._sectionInstances = {};
        this._sectionWrappers = {};

        this.sections = [
            { id: "overview", label: "Overview", icon: Icons.grid },
            { id: "verifications", label: "Verifications", icon: Icons.shield, badgeKey: "pendingCount" },
            { id: "users", label: "Users", icon: Icons.people },
            { id: "subscription", label: "Subscription Settings", icon: Icons.settings },
            { id: "updates", label: "App Updates", icon: Icons.refresh },
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
        this.updateContent();
    }

    setSection(sectionId) {
        if (this.activeSection === sectionId) return;
        this.activeSection = sectionId;
        this.updateContent();
        this.updateSidebarActiveState();
    }

    onPendingCountChanged(count) {
        this.pendingCount = count;
        this.updateSidebarActiveState();
    }

    logout() {
        localStorage.removeItem("accessToken");
        localStorage.removeItem("refreshToken");
        localStorage.removeItem("user");
        window.location.hash = "/admin/login";
    }

    render() {
        if (this.loading) {
            return h("div", { class: "admin-loading" }, "Loading admin dashboard...");
        }

        if (this.accessDenied) {
            return h(
                "div",
                { style: "max-width: 480px; margin: 60px auto; padding: var(--space-5); text-align: center;" },
                h("h1", { class: "admin-header__title" }, "Access Denied"),
                h("p", { class: "admin-muted" }, "This account does not have admin access."),
                h("button", { class: "btn btn-primary", style: "margin-top: var(--space-4);", onclick: () => { window.location.hash = "/"; } }, "Return Home")
            );
        }

        return h(
            "div",
            { class: "admin-dashboard" },
            this.renderSidebar(),
            h("main", { id: "admin-dashboard-content", class: "admin-dashboard__content" })
        );
    }

    renderSidebar() {
        return h(
            "nav",
            { class: "admin-sidebar" },
            h(
                "div",
                { class: "admin-sidebar__brand" },
                h("span", { class: "admin-sidebar__brand-mark" }),
                h("span", { class: "admin-sidebar__brand-name" }, "KuraMedics Admin")
            ),
            h(
                "div",
                { class: "admin-sidebar__nav" },
                this.sections.map(section =>
                    h(
                        "button",
                        {
                            class: `admin-sidebar__item ${this.activeSection === section.id ? "admin-sidebar__item--active" : ""}`,
                            "data-section": section.id,
                            onclick: () => this.setSection(section.id),
                        },
                        h("span", { class: "admin-sidebar__icon" }, section.icon()),
                        h("span", {}, section.label),
                        section.badgeKey && this[section.badgeKey] > 0
                            ? h("span", { class: "admin-sidebar__badge" }, String(this[section.badgeKey]))
                            : null
                    )
                )
            ),
            h(
                "div",
                { class: "admin-sidebar__footer" },
                h("button", { class: "admin-sidebar__logout", onclick: () => this.logout() }, Icons.logout(), h("span", {}, "Log Out"))
            )
        );
    }

    updateSidebarActiveState() {
        if (!this.el) return;
        this.el.querySelectorAll("[data-section]").forEach(btn => {
            const isActive = btn.dataset.section === this.activeSection;
            btn.classList.toggle("admin-sidebar__item--active", isActive);
        });

        const verificationsBtn = this.el.querySelector('[data-section="verifications"]');
        if (verificationsBtn) {
            let badge = verificationsBtn.querySelector(".admin-sidebar__badge");
            if (this.pendingCount > 0) {
                if (!badge) {
                    badge = document.createElement("span");
                    badge.className = "admin-sidebar__badge";
                    verificationsBtn.appendChild(badge);
                }
                badge.textContent = String(this.pendingCount);
            } else if (badge) {
                badge.remove();
            }
        }
    }

    updateContent() {
        if (!this.el) return;
        const container = this.el.querySelector("#admin-dashboard-content");
        if (!container) return;

        Object.entries(this._sectionWrappers).forEach(([id, wrapper]) => {
            wrapper.style.display = id === this.activeSection ? "" : "none";
        });

        if (this._sectionInstances[this.activeSection]) {
            const wrapper = this._sectionWrappers[this.activeSection];
            if (wrapper && wrapper.parentNode !== container) {
                container.appendChild(wrapper);
            }
            return;
        }

        const wrapper = document.createElement("div");
        container.appendChild(wrapper);
        this._sectionWrappers[this.activeSection] = wrapper;

        let instance;
        switch (this.activeSection) {
            case "overview":
                instance = new AdminOverview();
                break;
            case "verifications":
                instance = new AdminVerifications((count) => this.onPendingCountChanged(count));
                break;
            case "users":
                instance = new AdminUsers();
                break;
            case "subscription":
                instance = new AdminSubscriptionSettings();
                break;
            case "updates":
                instance = new AdminAppUpdates();
                break;
            default:
                instance = new AdminOverview();
        }

        this._sectionInstances[this.activeSection] = instance;
        instance.mount(wrapper);
    }
}
