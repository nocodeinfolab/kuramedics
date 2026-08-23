// js/components/doctor/DashboardHome.js

import { Component } from "../../core/component.js";
import { h } from "../../utils/dom.js";
import api from "../../services/api.js";

export default class DashboardHome extends Component {

    constructor(doctor, onNavigate) {
        super();
        this.doctor = doctor ?? {};
        this.onNavigate = typeof onNavigate === "function" 
            ? onNavigate 
            : (tabName) => {
                window.dispatchEvent(new CustomEvent("dashboard:navigate", { detail: { tab: tabName } }));
            };

        this.recentBookings = [];
        this.summaryLoading = true;
    }

    async afterMount() {
        await this.loadDashboardSummary();
    }

    async loadDashboardSummary() {
        try {
            const res = await api.get("/bookings/dashboard-summary");
            const summary = res.data || res;
            this.recentBookings = summary.recentBookings || [];
        } catch (error) {
            console.error("Failed to load recent activity:", error);
        } finally {
            this.summaryLoading = false;
            this.update();
        }
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

    /**
     * Returns a semantic tone for the current verification status,
     * used to color-code badges consistently across the page.
     */
    getVerificationTone() {
        const rawStatus = (
            this.doctor?.verification_status || 
            this.doctor?.status || 
            ""
        ).toLowerCase();

        switch (rawStatus) {
            case "verified":
            case "approved":
                return "success";
            case "pending_review":
            case "pending":
                return "warning";
            case "rejected":
                return "danger";
            default:
                return "neutral";
        }
    }
    getFirstName() {
        const fullName = this.doctor?.full_name?.trim();
        if (!fullName) return "Doctor";

        const titlePattern = /^(dr|prof|professor|mr|mrs|ms|miss|engr|barr|chief)\.?\s+/i;
        const withoutTitle = fullName.replace(titlePattern, "");

        const firstWord = withoutTitle.split(/\s+/)[0];
        return firstWord || "Doctor";
    }

    getSubscriptionTone() {
        const status = (this.doctor?.subscription_status || "active").toLowerCase();
        if (status === "active" || status === "trialing") return "success";
        if (status === "past_due" || status === "expiring") return "warning";
        if (status === "cancelled" || status === "expired") return "danger";
        return "neutral";
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
        const firstName = this.getFirstName();

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
                this.badge(this.getFormattedVerificationStatus(), this.getVerificationTone()),
                this.badge(this.doctor.subscription_plan_name || "Starter Plan", this.getSubscriptionTone())
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
            this.statCard("Today's Queue", this.doctor?.todays_queue ?? 0),
            this.statCard("Patients", this.doctor?.patients ?? 0),
            this.statCard("Upcoming", this.doctor?.upcoming ?? 0),
            this.statCard("Completed", this.doctor?.completed ?? 0)
        );
    }

    renderSubscription() {
        const planName = this.doctor.subscription_plan_name || "Starter";
        const status = this.doctor.subscription_status || "Active";
        const tone = this.getSubscriptionTone();

        return h(
            "section",
            { class: "dashboard-card" },
            h(
                "div",
                { style: "display: flex; align-items: center; justify-content: space-between; gap: var(--space-3);" },
                h("h3", { style: "margin: 0;" }, "Subscription"),
                this.badge(status, tone)
            ),
            h("p", { class: "dashboard-value", style: "margin-top: var(--space-2);" }, planName),
            h(
                "p",
                { class: "dashboard-muted" },
                "Your plan determines commission rates and platform visibility for new patients."
            ),
            h(
                "button",
                {
                    class: "btn btn-outline",
                    style: "margin-top: var(--space-3); padding: 0.4rem 0.9rem; font-size: var(--step-small);",
                    onclick: () => this.onNavigate("settings", "subscription")
                },
                "Manage Subscription"
            )
        );
    }

    renderVerification() {
        const tone = this.getVerificationTone();
        const label = this.getFormattedVerificationStatus();

        const copy = {
            success: "Your profile is verified. Patients can find and book you with confidence.",
            warning: "Your submission is under review. We'll notify you as soon as it's approved.",
            danger: "Your last submission needs attention before it can be approved. Please review and resubmit.",
            neutral: "A verified badge builds trust with patients and improves your visibility in search results."
        }[tone];

        return h(
            "section",
            { class: "dashboard-card" },
            h(
                "div",
                { style: "display: flex; align-items: center; justify-content: space-between; gap: var(--space-3);" },
                h("h3", { style: "margin: 0;" }, "Verification"),
                this.badge(label, tone)
            ),
            h(
                "p",
                { class: "dashboard-muted", style: "margin-top: var(--space-2);" },
                copy
            ),
            tone !== "success"
                ? h(
                      "button",
                      {
                          class: "btn btn-outline",
                          style: "margin-top: var(--space-3); padding: 0.4rem 0.9rem; font-size: var(--step-small);",
                          onclick: () => this.onNavigate("settings")
                      },
                      tone === "danger" ? "Review Submission" : "Complete Profile"
                  )
                : null
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
                this.actionButton("Edit Profile", () => this.onNavigate("settings", "profile")),
                this.actionButton("Consultation Fees", () => this.onNavigate("settings", "consultation-services")),
                this.actionButton("Availability", () => this.onNavigate("settings", "consultation-services")),
                this.actionButton("Booking Link", () => this.onNavigate("settings", "doctor-card"))
            )
        );
    }

    renderRecentActivity() {
        return h(
            "section",
            { class: "dashboard-card" },
            h("h3", {}, "Recent Activity"),
            this.summaryLoading
                ? h("p", { class: "dashboard-muted" }, "Loading recent activity...")
                : this.recentBookings.length === 0
                    ? h("p", { class: "dashboard-muted" }, "No recent activity yet.")
                    : h(
                          "div",
                          { style: "display: flex; flex-direction: column; gap: 10px; margin-top: var(--space-2);" },
                          this.recentBookings.map(booking => this.renderActivityRow(booking))
                      )
        );
    }

    renderActivityRow(booking) {
        const statusText = {
            pending: "New booking request",
            pending_confirmation: "Awaiting your confirmation",
            reschedule_requested: "You suggested a new time",
            confirmed: "Appointment confirmed",
            completed: "Consultation completed",
            cancelled: "Booking cancelled",
        }[booking.status] || booking.status;

        return h(
            "div",
            {
                style: "display: flex; justify-content: space-between; align-items: center; gap: 10px; padding: 0.6rem 0; border-bottom: 1px solid var(--color-line);",
            },
            h(
                "div",
                { style: "min-width: 0;" },
                h(
                    "p",
                    { style: "margin: 0; font-size: 0.88rem; font-weight: 600; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;" },
                    booking.patient_name || "Patient"
                ),
                h(
                    "p",
                    { class: "dashboard-muted", style: "margin: 2px 0 0; font-size: 0.78rem;" },
                    statusText
                )
            ),
            h(
                "p",
                { class: "dashboard-muted", style: "margin: 0; font-size: 0.75rem; white-space: nowrap; flex-shrink: 0;" },
                this.formatDate(booking.booking_date)
            )
        );
    }

    formatDate(dateString) {
        if (!dateString) return "";
        return new Date(dateString).toLocaleDateString(undefined, {
            month: "short",
            day: "numeric",
        });
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

    
    badge(text, tone = "neutral") {
        const tones = {
            success: "background: #10b981;",
            warning: "background: #eab308;",
            danger: "background: #ef4444;",
            neutral: "" // falls back to default dashboard-badge styling
        };

        return h(
            "span",
            { class: "dashboard-badge", style: tones[tone] || "" },
            text
        );
    }
}
