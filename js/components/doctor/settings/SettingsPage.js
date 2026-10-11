import { Component } from "../../../core/component.js";
import { h } from "../../../utils/dom.js";
import api from "../../../services/api.js";
import pushNotifications from "../../../services/pushNotifications.js";

const icon = (paths, size = 20) =>
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

const SI = {
    user: ["M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2", "M12 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8z"],
    stethoscope: [
        "M5 3H4a2 2 0 0 0-2 2v4a6 6 0 0 0 12 0V5a2 2 0 0 0-2-2h-1",
        "M11 2v2", "M5 2v2", "M8 15a6 6 0 0 0 12 0v-3"
    ],
    card: ["M3 6h18a1 1 0 0 1 1 1v10a1 1 0 0 1-1 1H3a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1z", "M2 10h20"],
    wallet: [
        "M3.5 7.2A2.2 2.2 0 0 1 5.7 5h12.6a1 1 0 0 1 1 1v2.4",
        "M3.5 7.2v10.3a2 2 0 0 0 2 2h14a1 1 0 0 0 1-1V9.4a1 1 0 0 0-1-1H5.7a2.2 2.2 0 0 1-2.2-2.2z"
    ],
    plan: ["M12 2l3 6.5 7 .9-5.1 4.9 1.3 7-6.2-3.4-6.2 3.4 1.3-7L2 9.4l7-.9z"],
    shield: ["M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z", "M9 12l2 2 4-4"],
    logout: ["M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4", "M16 17l5-5-5-5", "M21 12H9"],
    chevron: ["M9 6l6 6-6 6"]
};

const getInitials = name => {
    const parts = (name || "").trim().split(/\s+/).filter(Boolean);
    if (parts.length === 0) return "D";
    if (parts.length === 1) return parts[0].charAt(0).toUpperCase();
    return (parts[0].charAt(0) + parts[parts.length - 1].charAt(0)).toUpperCase();
};

export default class SettingsPage extends Component {
    constructor(profile = {}, onNavigate = () => {}) {
        super();
        this.profile = profile;
        this.onNavigate = onNavigate;
        this.loggingOut = false;
    }
    
    async logout() {
        if (this.loggingOut) return;
    
        this.loggingOut = true;
        this.update();
    
        try {
            await api.post("/auth/logout", {});
        } catch (error) {
            console.error("Logout request failed:", error);
        } finally {
            await pushNotifications.unregister();
            api.clearSession();
        }
    }

    renderHero() {
        return h(
            "section",
            { class: "dashboard-header" },
            h("p", { class: "dashboard-greeting" }, "Doctor Account"),
            h("h1", { class: "dashboard-title" }, "Settings"),
            h(
                "p",
                { class: "dashboard-subtitle" },
                "Manage your professional profile, consultation services, subscription, and account security."
            )
        );
    }

    render() {
        return h(
            "div",
            { class: "dashboard-page settings-page doctor-settings" },
            this.renderHero(),
            this.renderProfileCard(),
            this.renderGroup("Practice", [
                this.renderRow({
                    iconPaths: SI.stethoscope,
                    title: "Consultation services",
                    text: "Rates, service types, durations and payment rules.",
                    onClick: () => this.onNavigate("consultation-services")
                }),
                this.renderRow({
                    iconPaths: SI.card,
                    title: "My doctor card",
                    text: "Download or share a card patients can use to book you.",
                    onClick: () => this.onNavigate("doctor-card")
                })
            ]),
            this.renderGroup("Billing", [
                this.renderRow({
                    iconPaths: SI.wallet,
                    title: "Finance",
                    text: "Earnings, payouts and billing history.",
                    onClick: () => this.onNavigate("finance")
                }),
                this.renderRow({
                    iconPaths: SI.plan,
                    title: "Subscription",
                    text: "Your plan, renewals and billing history.",
                    onClick: () => this.onNavigate("subscription")
                })
            ]),
            this.renderGroup("Account", [
                this.renderRow({
                    iconPaths: SI.shield,
                    title: "Security",
                    text: "Password, active sessions and credentials.",
                    onClick: () => this.onNavigate("security")
                }),
                this.renderLogoutRow()
            ])
        );
    }
    
    renderProfileCard() {
        const profile = this.profile || {};
        const name = profile.full_name || "Your profile";
        const avatarUrl = profile.avatar_url ? api.resolveUrl(profile.avatar_url) : null;
    
        const status = profile.verification_status;
        const chip = {
            verified: ["Verified", "success"],
            pending_review: ["Pending review", "warning"],
            suspended: ["Suspended", "danger"]
        }[status] || ["Profile incomplete", "neutral"];
    
        return h(
            "button",
            {
                type: "button",
                class: "sp-profile",
                onclick: () => this.onNavigate("profile")
            },
            h(
                "div",
                { class: "sp-profile__avatar" },
                avatarUrl
                    ? h("img", { class: "sp-profile__img", src: avatarUrl, alt: "" })
                    : h("span", {}, getInitials(profile.full_name))
            ),
            h(
                "div",
                { class: "sp-profile__body" },
                h("p", { class: "sp-profile__name" }, name),
                h("p", { class: "sp-profile__spec" }, profile.specialization || "No specialization set"),
                h("span", { class: `status-chip status-chip--${chip[1]}` }, chip[0])
            ),
            h("span", { class: "sp-chevron" }, icon(SI.chevron, 18))
        );
    }
    
    renderGroup(title, rows) {
        return h(
            "section",
            { class: "sp-group" },
            h("p", { class: "sp-group__title" }, title),
            h("div", { class: "sp-list" }, ...rows)
        );
    }
    
    renderRow({ iconPaths, title, text, onClick }) {
        return h(
            "button",
            { type: "button", class: "sp-row", onclick: onClick },
            h("span", { class: "sp-row__icon" }, icon(iconPaths, 20)),
            h(
                "span",
                { class: "sp-row__body" },
                h("span", { class: "sp-row__title" }, title),
                h("span", { class: "sp-row__text" }, text)
            ),
            h("span", { class: "sp-chevron" }, icon(SI.chevron, 18))
        );
    }
    
    renderLogoutRow() {
        return h(
            "button",
            {
                type: "button",
                class: "sp-row sp-row--danger",
                disabled: this.loggingOut,
                "aria-busy": String(this.loggingOut),
                onclick: () => this.logout()
            },
            h(
                "span",
                { class: "sp-row__icon" },
                this.loggingOut
                    ? h("span", { class: "btn-spinner btn-spinner--danger" })
                    : icon(SI.logout, 20)
            ),
            h(
                "span",
                { class: "sp-row__body" },
                h("span", { class: "sp-row__title" }, this.loggingOut ? "Logging out…" : "Log out"),
                h("span", { class: "sp-row__text" }, "Sign out of your account on this device.")
            )
        );
    }
}
