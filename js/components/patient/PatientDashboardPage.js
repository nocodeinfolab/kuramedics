// js/components/patient/PatientDashboardPage.js

import { Component } from "../../core/component.js";
import { h } from "../../utils/dom.js";
import api from "../../services/api.js";

const REQUIRED_TRIAGE_FIELDS = ["date_of_birth", "gender"];

const GENDER_OPTIONS = [
    { value: "female", label: "Female" },
    { value: "male", label: "Male" },
    { value: "other", label: "Other" },
    { value: "prefer_not_to_say", label: "Prefer not to say" },
];
const BLOOD_GROUP_OPTIONS = ["A+", "A-", "B+", "B-", "AB+", "AB-", "O+", "O-", "Not sure"];

export default class PatientDashboardPage extends Component {
    constructor() {
        super();

        this.loading = true;
        this.patient = null;

        this.needsOnboarding = false;
        this.onboardingDraft = {
            date_of_birth: "",
            gender: "",
            blood_group: "",
            allergies: "",
            chronic_conditions: "",
        };
        this.onboardingSaving = false;
        this.onboardingError = "";
        this.dashboardSummary = null;
        this.dashboardLoading = true;
        this.dashboardError = "";

        this.activeTab = "home";

        this.tabs = [
            { id: "home", label: "Home", icon: "house" },
            { id: "find", label: "Find Care", icon: "search" },
            { id: "care", label: "My Care", icon: "heart" },
            { id: "messages", label: "Messages", icon: "chat" },
            { id: "profile", label: "Profile", icon: "person" },
        ];
    }

    afterMount() {
        this.loadPatient();
    }

    // ---------- Data loading ----------

    async loadPatient() {
        this.loading = true;
        this.update();

        try {
            const res = await api.get("/patient-profile/me");
            const profile = res.data || res;

            this.patient = profile;
            this.needsOnboarding = REQUIRED_TRIAGE_FIELDS.some(field => !profile?.[field]);

            if (!this.needsOnboarding) {
                await this.loadDashboardSummary();
            }

            if (this.needsOnboarding) {
                this.onboardingDraft = {
                    date_of_birth: profile?.date_of_birth || "",
                    gender: profile?.gender || "",
                    blood_group: profile?.blood_group || "",
                    allergies: profile?.allergies || "",
                    chronic_conditions: profile?.chronic_conditions || "",
                };
            }
        } catch (error) {
            console.error("Failed to load patient profile:", error);
            // Treat as needing onboarding rather than dead-ending the page
            this.needsOnboarding = true;
        } finally {
            this.loading = false;
            this.update();
        }
    }
    async loadDashboardSummary() {
        this.dashboardLoading = true;
        this.dashboardError = "";
        this.update();

        try {
            const res = await api.get("/patient/dashboard/summary");
            this.dashboardSummary = res.data || res;
        } catch (error) {
            console.error("Failed to load dashboard summary:", error);
            this.dashboardError = error.message || "Failed to load your dashboard.";
        } finally {
            this.dashboardLoading = false;
            this.update();
        }
    }
    
    // ---------- Onboarding ----------

    setOnboardingField(field, value) {
        this.onboardingDraft = { ...this.onboardingDraft, [field]: value };
    }

    async submitOnboarding() {
        const { date_of_birth, gender } = this.onboardingDraft;

        if (!date_of_birth || !gender) {
            this.onboardingError = "Date of birth and gender are required to continue.";
            this.update();
            return;
        }

        this.onboardingSaving = true;
        this.onboardingError = "";
        this.update();

        try {
            const res = await api.put("/patient-profile/me", this.onboardingDraft);
            const profile = res.data || res;

            this.patient = profile;
            this.needsOnboarding = false;
            this.loadDashboardSummary();
        } catch (error) {
            console.error("Failed to save patient profile:", error);
            this.onboardingError = error.message || "Failed to save your details. Please try again.";
        } finally {
            this.onboardingSaving = false;
            this.update();
        }
    }

    // ---------- Tab navigation ----------

    setTab(tabId) {
        if (this.activeTab === tabId) return;
        this.activeTab = tabId;
        this.update();
    }

    // ---------- Render ----------

    render() {
        if (this.loading) {
            return h(
                "div",
                { class: "dashboard-loading" },
                "Loading your dashboard..."
            );
        }

        if (this.needsOnboarding) {
            return this.renderOnboarding();
        }

        return h(
            "div",
            { class: "patient-dashboard" },
            h(
                "main",
                { class: "patient-dashboard__content" },
                this.renderActiveTab()
            ),
            this.renderBottomNavigation()
        );
    }

    // ---------- Onboarding view ----------

    renderOnboarding() {
        const fieldLabelStyle = "display: block; margin-bottom: 5px; font-size: 0.82rem; font-weight: 600;";
        const fieldInputStyle = "padding: 0.6rem 0.7rem; border: 1px solid var(--color-line); border-radius: 6px; width: 100%; font-size: 0.9rem; box-sizing: border-box; font-family: inherit;";

        return h(
            "main",
            { class: "dashboard-page", style: "max-width: 480px; margin: 0 auto; padding: var(--space-3);" },
            h(
                "section",
                { class: "dashboard-header" },
            
                h(
                    "div",
                    { class: "dashboard-header__content" },
            
                    h(
                        "h1",
                        { class: "dashboard-title" },
                        `${this.getGreeting()}, ${this.getFirstName(this.patient?.full_name)}`
                    ),
            
                    h(
                        "p",
                        { class: "dashboard-subtitle" },
                        "Your personal healthcare hub."
                    ),
            
                    h(
                        "p",
                        { class: "dashboard-date" },
                        this.getTodayLabel()
                    )
                )
            ),

            this.onboardingError
                ? h(
                      "div",
                      { class: "dashboard-card", style: "border-left: 4px solid #ef4444; margin-bottom: var(--space-3);" },
                      h("p", { style: "color: #ef4444; margin: 0;" }, this.onboardingError)
                  )
                : null,

            h(
                "div",
                { class: "dashboard-card", style: "padding: 1.1rem; display: flex; flex-direction: column; gap: 14px;" },

                h(
                    "div",
                    {},
                    h("label", { style: fieldLabelStyle }, "Date of birth"),
                    h("input", {
                        type: "date",
                        value: this.onboardingDraft.date_of_birth,
                        style: fieldInputStyle,
                        oninput: e => this.setOnboardingField("date_of_birth", e.target.value),
                    })
                ),

                h(
                    "div",
                    {},
                    h("label", { style: fieldLabelStyle }, "Gender"),
                    h(
                        "select",
                        {
                            value: this.onboardingDraft.gender,
                            style: fieldInputStyle,
                            onchange: e => this.setOnboardingField("gender", e.target.value),
                        },
                        h("option", { value: "" }, "Select..."),
                        GENDER_OPTIONS.map(option =>
                            h("option", { value: option.value }, option.label)
                        )
                    )
                ),

                h(
                    "div",
                    {},
                    h("label", { style: fieldLabelStyle }, "Blood group (optional)"),
                    h(
                        "select",
                        {
                            value: this.onboardingDraft.blood_group,
                            style: fieldInputStyle,
                            onchange: e => this.setOnboardingField("blood_group", e.target.value),
                        },
                        h("option", { value: "" }, "Not sure / skip"),
                        BLOOD_GROUP_OPTIONS.map(option =>
                            h("option", { value: option }, option)
                        )
                    )
                ),

                h(
                    "div",
                    {},
                    h("label", { style: fieldLabelStyle }, "Any known allergies? (optional)"),
                    h("input", {
                        type: "text",
                        placeholder: "e.g. penicillin, peanuts — or leave blank if none",
                        value: this.onboardingDraft.allergies,
                        style: fieldInputStyle,
                        oninput: e => this.setOnboardingField("allergies", e.target.value),
                    })
                ),

                h(
                    "div",
                    {},
                    h("label", { style: fieldLabelStyle }, "Any ongoing health conditions? (optional)"),
                    h("input", {
                        type: "text",
                        placeholder: "e.g. diabetes, hypertension — or leave blank if none",
                        value: this.onboardingDraft.chronic_conditions,
                        style: fieldInputStyle,
                        oninput: e => this.setOnboardingField("chronic_conditions", e.target.value),
                    })
                ),

                h(
                    "button",
                    {
                        class: "btn btn-primary",
                        style: "padding: 0.65rem 1rem; font-size: 0.9rem; border-radius: 8px; margin-top: 6px;",
                        disabled: this.onboardingSaving,
                        onclick: () => this.submitOnboarding(),
                    },
                    this.onboardingSaving ? "Saving..." : "Continue to dashboard"
                )
            )
        );
    }

    // ---------- Main dashboard tabs ----------

    renderActiveTab() {
        switch (this.activeTab) {
            case "home":
                return this.renderHomeTab();
            case "find":
                return this.renderComingSoon("Find Care", "Browse and book verified doctors, guided by AI triage.");
            case "care":
                return this.renderComingSoon("My Care", "Your appointments and consultation notes from every doctor you've seen.");
            case "messages":
                return this.renderComingSoon("Messages", "Secure conversations with your doctors.");
            case "profile":
                return this.renderComingSoon("Profile", "Manage your contact details, emergency contact, and medical summary.");
            default:
                return this.renderHomeTab();
        }
    }

    renderHomeTab() {
        const summary = this.dashboardSummary;
        const hasProfileGaps =
            !this.patient?.blood_group && !this.patient?.allergies && !this.patient?.chronic_conditions;

        return h(
            "div",
            { class: "dashboard-page" },
            h(
                "section",
                { class: "dashboard-header" },
            
                h(
                    "div",
                    { class: "dashboard-header__content" },
            
                    h(
                        "h1",
                        { class: "dashboard-title" },
                        `${this.getGreeting()}, ${this.getFirstName(this.patient?.full_name)}`
                    ),
            
                    h(
                        "p",
                        { class: "dashboard-subtitle" },
                        "Your personal healthcare hub."
                    ),
            
                    h(
                        "p",
                        { class: "dashboard-date" },
                        this.getTodayLabel()
                    )
                )
            ),
            this.dashboardLoading
                ? h(
                      "div",
                      { class: "dashboard-card text-center py-4" },
                      h("p", { class: "dashboard-muted" }, "Loading your dashboard...")
                  )
                : h(
                      "div",
                      { class: "services-list" },
                      this.dashboardError
                          ? h(
                                "div",
                                { class: "dashboard-card", style: "border-left: 4px solid #ef4444;" },
                                h("p", { style: "color: #ef4444; margin: 0;" }, this.dashboardError)
                            )
                          : null,
                      summary?.next_appointment ? this.renderNextAppointmentCard(summary.next_appointment) : null,
                      summary?.unread_message_count > 0
                          ? this.renderUnreadMessagesCard(summary.unread_message_count)
                          : null,
                      summary?.recent_consultation
                          ? this.renderRecentConsultationCard(summary.recent_consultation)
                          : null,
                      hasProfileGaps ? this.renderProfileNudgeCard() : null,
                      this.renderSymptomCheckCard()
                  )
        );
    }

    renderNextAppointmentCard(appointment) {
        const statusLabel =
            {
                pending: "Pending",
                pending_confirmation: "Awaiting Confirmation",
                reschedule_requested: "New Time Suggested",
                confirmed: "Confirmed",
            }[appointment.status] || appointment.status;

        const badgeColor = appointment.status === "confirmed" ? "#10b981" : "#f59e0b";

        return h(
            "div",
            { class: "dashboard-card", style: "padding: 1rem 1.1rem;" },
            h(
                "div",
                { style: "display: flex; justify-content: space-between; align-items: flex-start; gap: 10px;" },
                h(
                    "div",
                    {},
                    h("p", { class: "dashboard-muted", style: "margin: 0 0 4px; font-size: 0.78rem;" }, "Upcoming Appointment"),
                    h("p", { style: "margin: 0 0 4px; font-size: 1rem; font-weight: 600;" }, appointment.doctor_name || "Your doctor"),
                    h(
                        "p",
                        { class: "dashboard-muted", style: "margin: 0; font-size: 0.85rem;" },
                        this.formatDateTime(appointment.booking_date)
                    )
                ),
                h(
                    "span",
                    {
                        class: "dashboard-badge",
                        style: `background: ${badgeColor}; font-size: 0.7rem; padding: 3px 9px; border-radius: 5px; white-space: nowrap;`,
                    },
                    statusLabel
                )
            )
        );
    }

    renderUnreadMessagesCard(count) {
        return h(
            "div",
            {
                class: "dashboard-card",
                style: "padding: 1rem 1.1rem; display: flex; justify-content: space-between; align-items: center; gap: 10px; cursor: pointer;",
                onclick: () => this.setTab("messages"),
            },
            h(
                "p",
                { style: "margin: 0; font-size: 0.9rem;" },
                `You have ${count} new message${count === 1 ? "" : "s"}`
            ),
            h(
                "button",
                {
                    class: "btn btn-outline",
                    style: "padding: 0.4rem 0.8rem; font-size: 0.78rem; border-radius: 6px; flex-shrink: 0;",
                },
                "Open"
            )
        );
    }

    renderRecentConsultationCard(consultation) {
        return h(
            "div",
            { class: "dashboard-card", style: "padding: 1rem 1.1rem;" },
            h("p", { class: "dashboard-muted", style: "margin: 0 0 4px; font-size: 0.78rem;" }, "Recent Visit"),
            h(
                "p",
                { style: "margin: 0 0 10px; font-size: 0.9rem;" },
                `Your consultation with ${consultation.doctor_name || "your doctor"} is complete.`
            ),
            h(
                "button",
                {
                    class: "btn btn-outline",
                    style: "padding: 0.45rem 0.85rem; font-size: 0.8rem; border-radius: 6px;",
                    onclick: () => this.setTab("care"),
                },
                "View my plan"
            )
        );
    }

    renderProfileNudgeCard() {
        return h(
            "div",
            { class: "dashboard-card", style: "padding: 1rem 1.1rem; background: rgba(2,132,199,0.04);" },
            h(
                "p",
                { style: "margin: 0 0 10px; font-size: 0.87rem;" },
                "Add your allergies and health history so doctors and AI triage understand your situation better."
            ),
            h(
                "button",
                {
                    class: "btn btn-outline",
                    style: "padding: 0.45rem 0.85rem; font-size: 0.8rem; border-radius: 6px;",
                    onclick: () => this.setTab("profile"),
                },
                "Complete your profile"
            )
        );
    }

    renderSymptomCheckCard() {
        return h(
            "div",
            { class: "dashboard-card", style: "padding: 1rem 1.1rem;" },
            h("p", { class: "dashboard-muted", style: "margin: 0 0 4px; font-size: 0.8rem;" }, "Not feeling well?"),
            h(
                "p",
                { style: "margin: 0 0 12px; font-size: 0.92rem;" },
                "Describe your symptoms and we'll help you find the right doctor."
            ),
            h(
                "button",
                {
                    class: "btn btn-primary",
                    style: "padding: 0.55rem 1rem; font-size: 0.85rem; border-radius: 8px;",
                    onclick: () => this.setTab("find"),
                },
                "Start symptom check"
            )
        );
    }

    renderComingSoon(title, description) {
        return h(
            "div",
            { class: "dashboard-page" },
            h(
                "section",
                { class: "dashboard-header" },
                h("h1", { class: "dashboard-title" }, title)
            ),
            h(
                "div",
                { class: "dashboard-card text-center py-4" },
                h("p", { class: "dashboard-muted" }, description),
                h("p", { class: "dashboard-muted", style: "margin-top: 6px; font-size: 0.8rem;" }, "Coming soon.")
            )
        );
    }

    renderBottomNavigation() {
        return h(
            "nav",
            { class: "patient-bottom-nav" },
            this.tabs.map(tab =>
                h(
                    "button",
                    {
                        class: `patient-bottom-nav__item ${
                            this.activeTab === tab.id ? "patient-bottom-nav__item--active" : ""
                        }`,
                        onclick: () => this.setTab(tab.id),
                    },
                    h("span", { class: `icon-${tab.icon} patient-bottom-nav__icon` }),
                    h("span", { class: "patient-bottom-nav__label" }, tab.label)
                )
            )
        );
    }
    formatDateTime(dateString) {
        if (!dateString) return "";
        return new Date(dateString).toLocaleString(undefined, {
            weekday: "short",
            month: "short",
            day: "numeric",
            hour: "2-digit",
            minute: "2-digit",
        });
    }
    getFirstName(fullName) {
        return fullName?.trim().split(" ")[0] || "";
    }
    
    getGreeting() {
        const hour = new Date().getHours();
    
        if (hour < 12) return "Good morning";
        if (hour < 17) return "Good afternoon";
        return "Good evening";
    }
    
    getTodayLabel() {
        return new Date().toLocaleDateString(undefined, {
            weekday: "long",
            day: "numeric",
            month: "long",
        }).replace(",", " •");
    }

    update() {
        if (!this.el) return;
        const newTree = this.render();
        this.el.replaceChildren(...(Array.isArray(newTree) ? newTree : [newTree]).flat());
    }
}
