// js/components/doctor/settings/SettingsPage.js

import { Component } from "../../../core/component.js";
import { h } from "../../../utils/dom.js";

export default class SettingsPage extends Component {
    constructor(profile = {}, onNavigate = () => {}) {
        super();
        this.profile = profile;
        this.onNavigate = onNavigate;
    }

    render() {
        return h(
            "div",
            { class: "dashboard-page settings-page" },
            this.renderHero(),
            this.renderProfileCard(),
            this.renderAccountCard(),
            this.renderConsultationServicesCard(), // <--- ADDED HERE
            this.renderSecurityCard()
        );
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
                "Manage your professional profile, consultation services, subscription and account security."
            )
        );
    }

    renderProfileCard() {
        const profile = this.profile || {};
        const name = profile.full_name?.trim() || "Complete your profile";
        const specialization = profile.specialization || "No specialization";
        const avatar = profile.avatar_url;
        const verified = profile.verification_status === "verified";
        const initial = name.charAt(0).toUpperCase() || "D";

        return h(
            "div",
            {
                class: "dashboard-card settings-profile-card settings-card--clickable",
                onclick: () => this.onNavigate("profile")
            },
            avatar
                ? h("img", {
                      class: "settings-profile-avatar",
                      src: avatar,
                      alt: name
                  })
                : h(
                      "div",
                      { class: "settings-profile-avatar settings-profile-avatar--placeholder" },
                      initial
                  ),
            h("h2", {}, name),
            h("p", { class: "dashboard-muted" }, specialization),
            h(
                "div",
                { class: "dashboard-hero-meta" },
                h(
                    "span",
                    { class: "dashboard-badge" },
                    verified ? "Verified" : "Profile Incomplete"
                )
            ),
            h(
                "span",
                { class: "btn btn-primary" },
                profile.profile_id ? "Edit Profile" : "Complete Profile"
            )
        );
    }

    renderAccountCard() {
        return h(
            "div",
            {
                class: "dashboard-card settings-menu-card settings-card--clickable",
                onclick: () => this.onNavigate("subscription")
            },
            h("h3", {}, "Subscription"),
            h(
                "p",
                { class: "dashboard-muted" },
                "Manage your subscription and billing."
            )
        );
    }

    // NEW METHOD
    renderConsultationServicesCard() {
        return h(
            "div",
            {
                class: "settings-menu-card",
                onclick: () => this.onNavigate("consultation-services")
            },
            h("div", { class: "settings-menu-card__icon" }, "💼"),
            h(
                "div",
                { class: "settings-menu-card__content" },
                h("h3", { class: "settings-menu-card__title" }, "Consultation Services"),
                h("p", { class: "settings-menu-card__text" }, "Manage service rates, durations, and availability notes.")
            ),
            h("div", { class: "settings-menu-card__arrow" }, "→")
        );
    }

    renderSecurityCard() {
        return h(
            "div",
            {
                class: "dashboard-card settings-menu-card settings-card--clickable",
                onclick: () => this.onNavigate("security")
            },
            h("h3", {}, "Security"),
            h(
                "p",
                { class: "dashboard-muted" },
                "Password, login sessions and account protection."
            )
        );
    }
}
