// js/components/doctor/DashboardHome.js

import { Component } from "../../core/component.js";
import { h } from "../../utils/dom.js";

export default class DashboardHome extends Component {

    constructor(doctor, onNavigate) {
        super();
        this.doctor = doctor ?? {};
        // Navigation function passed from the parent dashboard container
        this.onNavigate = typeof onNavigate === "function" 
            ? onNavigate 
            : (tabName) => {
                // Event fallback if no callback was provided directly
                window.dispatchEvent(new CustomEvent("dashboard:navigate", { detail: { tab: tabName } }));
            };
    }

    /**
     * Maps raw backend status values to user-friendly UI labels.
     */
    getFormattedVerificationStatus() {
        const rawStatus = (
            this.doctor?.verification_status || 
            this.doctor?.status || 
            ""
        ).toLowerCase();

        switch (rawStatus) {
            case "unsubmitted":
            case "draft":
                return "Incomplete Profile";
            case "pending_review":
            case "pending":
                return "Verification Pending";
            case "verified":
            case "approved":
                return "Verified";
            case "rejected":
                return "Action Required";
            default:
                return "Incomplete Profile";
        }
    }

    render() {
        return h(
            "div",
            { class: "doctor-home" },
            this.renderHero(),
            this.renderStatusBanner(),
            this.renderStatistics(),
            this.renderSubscription(),
            this.renderVerification(),
            this.renderQuickActions(),
            this.renderRecentActivity()
        );
    }

    renderHero() {
        const firstName = this.doctor?.full_name?.split(" ")[0] || "Doctor";

        return h(
            "section",
            { class: "dashboard-header" },
            h("p", { class: "dashboard-greeting" }, "Welcome back"),
            h("h1", { class: "dashboard-title" }, `Dr. ${firstName}`),
            h(
                "p",
                { class: "dashboard-subtitle" },
                this.doctor.specialization || "Complete your professional profile to start receiving bookings."
            ),
            h(
                "div",
                { class: "dashboard-hero-meta" },
                this.badge(this.getFormattedVerificationStatus()),
                this.badge(this.doctor.subscription_plan_name || "Starter Plan")
            )
        );
    }

    renderStatusBanner() {
        const status = (
            this.doctor?.verification_status || 
            this.doctor?.status || 
            ""
        ).toLowerCase();

        // Only show banner if status is unsubmitted or draft
        if (status !== "unsubmitted" && status !== "draft") {
            return null;
        }

        return h(
            "div",
            {
                class: "dashboard-card alert-banner",
                style: `
                    margin-top: var(--space-4);
                    background: rgba(234, 179, 8, 0.1);
                    border: 1px solid rgba(234, 179, 8, 0.4);
                    border-left: 4px solid #eab308;
                    cursor: pointer;
                    transition: transform 0.2s ease, box-shadow 0.2s ease;
                    display: flex;
                    align-items: center;
                    justify-content: space-between;
                    gap: var(--space-3);
                `,
                onclick: () => this.onNavigate("settings") // Navigates directly to settings
            },
            h(
                "div",
                { style: "display: flex; align-items: center; gap: var(--space-3);" },
                h("span", { style: "font-size: 1.5rem;" }, "⚠️"),
                h(
                    "div",
                    {},
                    h(
                        "h4",
                        { style: "margin: 0 0 var(--space-1); color: var(--color-ink); font-weight: 600;" },
                        "Complete your profile and submit for verification"
                    ),
                    h(
                        "p",
                        { class: "dashboard-muted", style: "margin: 0; font-size: var(--step-small);" },
                        "Only verified doctor profiles are published and visible to prospective patients."
                    )
                )
            ),
            h(
                "span",
                { style: "font-weight: 600; color: var(--color-primary); font-size: 0.9rem; white-space: nowrap;" },
                "Open Settings →"
            )
        );
    }

    renderStatistics() {
        return h(
            "section",
            { class: "dashboard-section stats-grid" },
            this.statCard("Today's Queue", "0"),
            this.statCard("Patients", "0"),
            this.statCard("Unread", "0"),
            this.statCard("Earnings", "₦0")
        );
    }

    renderSubscription() {
        return h(
            "section",
            { class: "dashboard-card" },
            h("h3", {}, "Subscription"),
            h("p", { class: "dashboard-value" }, this.doctor.subscription_plan_name || "Starter"),
            h("p", { class: "dashboard-muted" }, `Status: ${this.doctor.subscription_status || "Active"}`)
        );
    }

    renderVerification() {
        return h(
            "section",
            { class: "dashboard-card" },
            h("h3", {}, "Verification"),
            h("p", { class: "dashboard-value" }, this.getFormattedVerificationStatus()),
            h("p", { class: "dashboard-muted" }, "Verified doctors appear higher in patient search results.")
        );
    }

    renderQuickActions() {
        return h(
            "section",
            { class: "dashboard-card" },
            h("h3", {}, "Quick Actions"),
            h(
                "div",
                { class: "quick-actions" },
                this.actionButton("Edit Profile", () => this.onNavigate("settings")),
                this.actionButton("Consultation Fees", () => this.onNavigate("services")),
                this.actionButton("Availability", () => this.onNavigate("availability")),
                this.actionButton("Booking Link")
            )
        );
    }

    renderRecentActivity() {
        return h(
            "section",
            { class: "dashboard-card" },
            h("h3", {}, "Recent Activity"),
            h("p", { class: "dashboard-muted" }, "No recent activity yet.")
        );
    }

    statCard(title, value) {
        return h(
            "div",
            { class: "stat-card" },
            h("div", { class: "stat-value" }, value),
            h("div", { class: "stat-label" }, title)
        );
    }

    actionButton(label, onClick) {
        return h(
            "button",
            { class: "btn btn-outline", onclick: onClick },
            label
        );
    }

    badge(text) {
        return h("span", { class: "dashboard-badge" }, text);
    }
}
