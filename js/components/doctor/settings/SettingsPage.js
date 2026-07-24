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
                "Manage your professional profile, subscription and account security."
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
                { class: "btn btn-primary" }, // Changed from button to span to prevent nested interactive controls
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
