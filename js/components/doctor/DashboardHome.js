// js/components/doctor/DashboardHome.js

import { Component } from "../../core/component.js";
import { h } from "../../utils/dom.js";
import api from "../../services/api.js";

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

const ICONS = {
    alert: [
        "M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0z",
        "M12 9v4",
        "M12 17h.01"
    ],
    stethoscope: [
        "M5 3H4a2 2 0 0 0-2 2v4a6 6 0 0 0 12 0V5a2 2 0 0 0-2-2h-1",
        "M11 2v2",
        "M5 2v2",
        "M8 15a6 6 0 0 0 12 0v-3",
        "M18 10a2 2 0 1 0 4 0 2 2 0 1 0-4 0"
    ],
    user: [
        "M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2",
        "M12 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8z"
    ],
    fees: [
        "M3 7h18a1 1 0 0 1 1 1v8a1 1 0 0 1-1 1H3a1 1 0 0 1-1-1V8a1 1 0 0 1 1-1z",
        "M12 14.5a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5z"
    ],
    link: [
        "M10 13a5 5 0 0 0 7.5.5l3-3a5 5 0 0 0-7-7l-1.7 1.7",
        "M14 11a5 5 0 0 0-7.5-.5l-3 3a5 5 0 0 0 7 7l1.7-1.7"
    ],
    card: [
        "M3 6h18a1 1 0 0 1 1 1v10a1 1 0 0 1-1 1H3a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1z",
        "M2 10h20"
    ],
    shield: [
        "M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z",
        "M9 12l2 2 4-4"
    ],
    check: ["M5 12.5l4.5 4.5L19 7.5"],
    chevron: ["M9 6l6 6-6 6"]
};

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

        this._pollTimer = setInterval(() => {
            if (this.isAppVisible()) {
                this.loadDashboardSummary({ silent: true });
            }
        }, 60000);
    }

    isAppVisible() {
        return document.visibilityState === "visible";
    }

    beforeUnmount() {
        if (this._pollTimer) clearInterval(this._pollTimer);
    }

    async loadDashboardSummary({ silent = false } = {}) {
        if (!silent) {
            this.summaryLoading = true;
            this.update();
        }

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
    getGreeting() {
        const hour = new Date().getHours();
        if (hour < 12) return "Good morning";
        if (hour < 17) return "Good afternoon";
        return "Good evening";
    }
    
    heroChip(text, tone = "neutral") {
        return h(
            "span",
            { class: `hero-chip hero-chip--${tone}` },
            h("span", { class: "hero-chip__dot" }),
            text
        );
    }

    getSubscriptionTone() {
        const status = (this.doctor?.subscription_status || "active").toLowerCase();
        if (status === "active" || status === "trialing") return "success";
        if (status === "past_due" || status === "expiring") return "warning";
        if (status === "cancelled" || status === "expired") return "danger";
        return "neutral";
    }
    getSubscriptionLabel() {
        const status = (this.doctor?.subscription_status || "active").toLowerCase();
        return {
            active: "Active",
            trialing: "Free trial",
            past_due: "Payment overdue",
            expiring: "Expiring soon",
            cancelled: "Cancelled",
            expired: "Expired"
        }[status] || "Active";
    }
    
    chip(text, tone = "neutral") {
        return h("span", { class: `status-chip status-chip--${tone}` }, text);
    }

    render() {
        return h(
            "div",
            { class: "doctor-home" },
            this.renderHero(),
            this.renderStatusBanner(),
            this.renderServicesSetupBanner(),
            this.renderStatistics(),
            this.renderSubscription(),
            this.renderVerification(),
            this.renderQuickActions(),
            this.renderRecentActivity()
        );
    }

    renderHero() {
        const firstName = this.getFirstName();
        const title = firstName ? `Dr. ${firstName}` : "Welcome, Doctor";
        const avatarUrl = this.doctor.avatar_url ? api.resolveUrl(this.doctor.avatar_url) : null;
        const initial = (firstName || "D").charAt(0).toUpperCase();
    
        return h(
            "section",
            { class: "dashboard-header" },
            h(
                "div",
                { class: "hero-top" },
                h(
                    "div",
                    { class: "hero-avatar" },
                    avatarUrl
                        ? h("img", { class: "hero-avatar__img", src: avatarUrl, alt: "" })
                        : h("span", { class: "hero-avatar__initial" }, initial)
                ),
                h(
                    "div",
                    { class: "hero-text" },
                    h("p", { class: "dashboard-greeting" }, this.getGreeting()),
                    h("h1", { class: "dashboard-title" }, title),
                    h(
                        "p",
                        { class: "dashboard-subtitle" },
                        this.doctor.specialization || "Complete your professional profile to start receiving bookings."
                    )
                )
            ),
            h(
                "div",
                { class: "dashboard-hero-meta" },
                this.heroChip(this.getFormattedVerificationStatus(), this.getVerificationTone()),
                this.heroChip(this.doctor.subscription_plan_name || "Starter Plan", "plan")
            )
        );
    }

    renderActionBanner({ tone, iconPaths, title, text, onClick }) {
    return h(
        "button",
        {
            type: "button",
            class: `action-banner action-banner--${tone}`,
            onclick: onClick
        },
        h("span", { class: "action-banner__icon" }, icon(iconPaths, 20)),
        h(
            "span",
            { class: "action-banner__body" },
            h("span", { class: "action-banner__title" }, title),
            h("span", { class: "action-banner__text" }, text)
        ),
        h("span", { class: "action-banner__chevron" }, icon(ICONS.chevron, 18))
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
    
        return this.renderActionBanner({
            tone: "warning",
            iconPaths: ICONS.alert,
            title: "Complete your profile and submit for verification",
            text: "Only verified doctor profiles are published and visible to prospective patients.",
            onClick: () => this.onNavigate("settings")
        });
    }
    
    renderServicesSetupBanner() {
        const verificationStatus = (this.doctor?.verification_status || this.doctor?.status || "").toLowerCase();
        const isVerified = verificationStatus === "verified" || verificationStatus === "approved";
        const hasServices = Boolean(this.doctor?.has_enabled_consultation_service);
    
        if (!isVerified || hasServices) {
            return null;
        }
    
        return this.renderActionBanner({
            tone: "info",
            iconPaths: ICONS.stethoscope,
            title: "Set up your consultation services",
            text: "Add pricing and enable at least one consultation type so patients can book you.",
            onClick: () => this.onNavigate("settings", "consultation-services")
        });
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
        const status = (this.doctor.subscription_status || "active").toLowerCase();
        const tone = this.getSubscriptionTone();
        const needsAttention = status === "past_due" || status === "expiring" || status === "expired";
    
        const note = {
            past_due: "Your last payment didn't go through. Resolve it to keep your plan benefits.",
            expiring: "Your plan is about to expire. Renew to avoid losing your benefits.",
            expired: "Your plan has expired. Renew to restore your benefits."
        }[status];
    
        return h(
            "section",
            { class: "dashboard-card status-card" },
            h(
                "div",
                { class: "status-card__head" },
                h("span", { class: "status-card__icon" }, icon(ICONS.card, 20)),
                h("span", { class: "status-card__eyebrow" }, "Subscription"),
                this.chip(this.getSubscriptionLabel(), tone)
            ),
            h("p", { class: "status-card__value" }, planName),
            needsAttention && note
                ? h("p", { class: `status-card__note status-card__note--${tone}` }, note)
                : h(
                      "p",
                      { class: "status-card__text" },
                      "Your plan determines commission rates and platform visibility for new patients."
                  ),
            h(
                "button",
                {
                    type: "button",
                    class: "status-card__link",
                    onclick: () => this.onNavigate("settings", "subscription")
                },
                h("span", {}, needsAttention ? "Resolve now" : "Manage plan"),
                icon(ICONS.chevron, 16)
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
    
        // Which step is current: 0 = Profile, 1 = Review, 3 = everything done
        const current = { neutral: 0, danger: 0, warning: 1, success: 3 }[tone];
        const steps = ["Profile", "Review", "Verified"];
    
        return h(
            "section",
            { class: "dashboard-card status-card" },
            h(
                "div",
                { class: "status-card__head" },
                h("span", { class: "status-card__icon" }, icon(ICONS.shield, 20)),
                h("span", { class: "status-card__eyebrow" }, "Verification"),
                this.chip(label, tone)
            ),
            h(
                "ol",
                { class: "step-tracker", "aria-label": "Verification progress" },
                ...steps.map((name, i) => {
                    const state = i < current ? "done" : i === current ? "current" : "todo";
                    return h(
                        "li",
                        {
                            class: `step-tracker__item step-tracker__item--${state}${
                                state === "current" && tone === "danger" ? " step-tracker__item--danger" : ""
                            }`
                        },
                        h(
                            "span",
                            { class: "step-tracker__dot" },
                            state === "done" ? icon(ICONS.check, 12) : String(i + 1)
                        ),
                        h("span", { class: "step-tracker__label" }, name)
                    );
                })
            ),
            h("p", { class: "status-card__text" }, copy),
            tone !== "success"
                ? h(
                      "button",
                      {
                          type: "button",
                          class: "status-card__link",
                          onclick: () => this.onNavigate("settings")
                      },
                      h("span", {}, tone === "danger" ? "Review submission" : tone === "warning" ? "View profile" : "Complete profile"),
                      icon(ICONS.chevron, 16)
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
                { class: "quick-tiles" },
                this.actionTile("Edit Profile", "Photo, bio, licence", ICONS.user,
                    () => this.onNavigate("settings", "profile")),
                this.actionTile("Services & Fees", "Pricing and availability", ICONS.fees,
                    () => this.onNavigate("settings", "consultation-services")),
                this.actionTile("Booking Link", "Share your page", ICONS.link,
                    () => this.onNavigate("settings", "doctor-card")),
                this.actionTile("Subscription", "Plan and billing", ICONS.card,
                    () => this.onNavigate("settings", "subscription"))
            )
        );
    }
    
    actionTile(label, hint, iconPaths, onClick) {
        return h(
            "button",
            { type: "button", class: "quick-tile", onclick: onClick },
            h("span", { class: "quick-tile__icon" }, icon(iconPaths, 22)),
            h("span", { class: "quick-tile__label" }, label),
            h("span", { class: "quick-tile__hint" }, hint)
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
