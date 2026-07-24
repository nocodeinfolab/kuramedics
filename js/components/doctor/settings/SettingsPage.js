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
            this.renderProfileHeader(),
            h(
                "div",
                { 
                    class: "settings-grid",
                    style: "display: grid; grid-template-columns: repeat(auto-fit, minmax(280px, 1fr)); gap: var(--space-4); margin-top: var(--space-4);" 
                },
                this.renderProfileCard(),
                this.renderConsultationServicesCard(),
                this.renderAccountCard(),
                this.renderSecurityCard()
            )
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
                "Manage your professional profile, consultation services, subscription, and account security."
            )
        );
    }

    renderProfileHeader() {
        const profile = this.profile || {};
        const name = profile.full_name?.trim() || "Complete your profile";
        const avatar = profile.avatar_url;
        const initial = name.charAt(0).toUpperCase() || "D";

        return h(
            "div",
            { 
                class: "settings-profile-header",
                style: "display: flex; align-items: center; gap: var(--space-3); margin-top: var(--space-4); margin-bottom: var(--space-2);"
            },
            avatar
                ? h("img", {
                      class: "settings-profile-avatar",
                      src: avatar,
                      alt: name,
                      style: "width: 50px; height: 50px; border-radius: 50%; object-fit: cover;"
                  })
                : h(
                      "div",
                      {
                          class: "settings-profile-avatar settings-profile-avatar--placeholder",
                          style: "width: 50px; height: 50px; border-radius: 50%; background: var(--color-primary); color: #fff; display: flex; align-items: center; justify-content: center; font-size: 1.3rem; font-weight: bold;"
                      },
                      initial
                  ),
            h("h2", { style: "margin: 0; font-size: var(--step-2);" }, name)
        );
    }

    renderProfileCard() {
        const profile = this.profile || {};
        const specialization = profile.specialization || "No specialization set";
        const status = profile.verification_status;

        // Determine badge label and color dynamically
        let badgeLabel = "Profile Incomplete";
        let badgeStyle = "background: var(--color-ink-faint);";

        if (status === "verified") {
            badgeLabel = "Verified";
            badgeStyle = "background: #10b981;";
        } else if (status === "pending_review") {
            badgeLabel = "Pending";
            badgeStyle = "background: #f59e0b;";
        }

        return h(
            "div",
            {
                class: "dashboard-card settings-menu-card settings-card--clickable",
                style: "cursor: pointer; display: flex; flex-direction: column; justify-content: space-between;",
                onclick: () => this.onNavigate("profile")
            },
            h(
                "div",
                {},
                h(
                    "div",
                    { style: "display: flex; align-items: center; justify-content: space-between; gap: var(--space-2); margin-bottom: var(--space-2);" },
                    h("h3", { style: "margin: 0;" }, specialization),
                    h(
                        "span",
                        {
                            class: "dashboard-badge",
                            style: `font-size: 0.72rem; padding: 2px 8px; border-radius: 4px; display: inline-block; ${badgeStyle}`
                        },
                        badgeLabel
                    )
                ),
                h(
                    "p",
                    { class: "dashboard-muted", style: "margin: 0;" },
                    "Update your personal bio, qualification details, MDCN number, and contact info."
                )
            ),
            h(
                "span",
                { class: "btn-link", style: "margin-top: var(--space-4); color: var(--color-primary); font-weight: bold;" },
                "Edit Profile →"
            )
        );
    }

    renderConsultationServicesCard() {
        return h(
            "div",
            {
                class: "dashboard-card settings-menu-card settings-card--clickable",
                style: "cursor: pointer; display: flex; flex-direction: column; justify-content: space-between;",
                onclick: () => this.onNavigate("consultation-services")
            },
            h(
                "div",
                {},
                h("h3", { style: "margin: 0 0 var(--space-2);" }, "Consultation Services"),
                h(
                    "p",
                    { class: "dashboard-muted", style: "margin: 0;" },
                    "Configure rates, service types, durations, and payment rules."
                )
            ),
            h(
                "span",
                { class: "btn-link", style: "margin-top: var(--space-4); color: var(--color-primary); font-weight: bold;" },
                "Manage Services →"
            )
        );
    }

    renderAccountCard() {
        return h(
            "div",
            {
                class: "dashboard-card settings-menu-card settings-card--clickable",
                style: "cursor: pointer; display: flex; flex-direction: column; justify-content: space-between;",
                onclick: () => this.onNavigate("subscription")
            },
            h(
                "div",
                {},
                h("h3", { style: "margin: 0 0 var(--space-2);" }, "Subscription"),
                h(
                    "p",
                    { class: "dashboard-muted", style: "margin: 0;" },
                    "Manage your plan, subscription renewals, and billing history."
                )
            ),
            h(
                "span",
                { class: "btn-link", style: "margin-top: var(--space-4); color: var(--color-primary); font-weight: bold;" },
                "View Plan →"
            )
        );
    }

    renderSecurityCard() {
        return h(
            "div",
            {
                class: "dashboard-card settings-menu-card settings-card--clickable",
                style: "cursor: pointer; display: flex; flex-direction: column; justify-content: space-between;",
                onclick: () => this.onNavigate("security")
            },
            h(
                "div",
                {},
                h("h3", { style: "margin: 0 0 var(--space-2);" }, "Security"),
                h(
                    "p",
                    { class: "dashboard-muted", style: "margin: 0;" },
                    "Update password, active login sessions, and account credentials."
                )
            ),
            h(
                "span",
                { class: "btn-link", style: "margin-top: var(--space-4); color: var(--color-primary); font-weight: bold;" },
                "Security Settings →"
            )
        );
    }
}
