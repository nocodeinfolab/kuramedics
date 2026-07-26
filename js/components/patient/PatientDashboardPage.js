// js/components/patient/PatientDashboardPage.js

import { Component } from "../../core/component.js";
import { h } from "../../utils/dom.js";
import api from "../../services/api.js";
import PatientCare from "./PatientCare.js";
import PatientMessaging from "./PatientMessaging.js";

const REQUIRED_TRIAGE_FIELDS = ["date_of_birth", "gender"];

const GENDER_OPTIONS = [
    { value: "female", label: "Female" },
    { value: "male", label: "Male" },
    { value: "other", label: "Other" },
    { value: "prefer_not_to_say", label: "Prefer not to say" },
];
const BLOOD_GROUP_OPTIONS = ["A+", "A-", "B+", "B-", "AB+", "AB-", "O+", "O-", "Not sure"];

// Inline Modern SVG Icons Helper
const Icons = {
    calendar: () => h("svg", { width: "20", height: "20", viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", "stroke-width": "2", "stroke-linecap": "round", "stroke-linejoin": "round" },
        h("rect", { x: "3", y: "4", width: "18", height: "18", rx: "2", ry: "2" }),
        h("line", { x1: "16", y1: "2", x2: "16", y2: "6" }),
        h("line", { x1: "8", y1: "2", x2: "8", y2: "6" }),
        h("line", { x1: "3", y1: "10", x2: "21", y2: "10" })
    ),
    message: () => h("svg", { width: "20", height: "20", viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", "stroke-width": "2", "stroke-linecap": "round", "stroke-linejoin": "round" },
        h("path", { d: "M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" })
    ),
    stethoscope: () => h("svg", { width: "20", height: "20", viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", "stroke-width": "2", "stroke-linecap": "round", "stroke-linejoin": "round" },
        h("path", { d: "M4.8 2.3A.3.3 0 0 0 4.5 2.6V8.5a5.5 5.5 0 0 0 11 0V2.6a.3.3 0 0 0-.3-.3h-1.4a.3.3 0 0 0-.3.3v5.9a3.5 3.5 0 0 1-7 0V2.6a.3.3 0 0 0-.3-.3H4.8z" }),
        h("path", { d: "M10 14v2a4 4 0 0 0 4 4h1a3 3 0 1 0 0-6h-1" })
    ),
    userCheck: () => h("svg", { width: "20", height: "20", viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", "stroke-width": "2", "stroke-linecap": "round", "stroke-linejoin": "round" },
        h("path", { d: "M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" }),
        h("circle", { cx: "8.5", cy: "7", r: "4" }),
        h("polyline", { points: "17 11 19 13 23 9" })
    ),
    activity: () => h("svg", { width: "20", height: "20", viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", "stroke-width": "2", "stroke-linecap": "round", "stroke-linejoin": "round" },
        h("polyline", { points: "22 12 18 12 15 21 9 3 6 12 2 12" })
    ),
    alert: () => h("svg", { width: "20", height: "20", viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", "stroke-width": "2", "stroke-linecap": "round", "stroke-linejoin": "round" },
        h("circle", { cx: "12", cy: "12", r: "10" }),
        h("line", { x1: "12", y1: "8", x2: "12", y2: "12" }),
        h("line", { x1: "12", y1: "16", x2: "12.01", y2: "16" })
    )
};

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

            if (!this.needsOnboarding) {
                this.updatePage();
            }
        }
    }

    // ---------- Onboarding ----------

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
        this.updatePage();
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
                {
                    id: "patient-dashboard-content",
                    class: "patient-dashboard__content",
                }
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
            
            case "profile":
                return this.renderComingSoon("Profile", "Manage your contact details, emergency contact, and medical summary.");
            default:
                return this.renderHomeTab();
        }
    }

    mountCurrentPage(container) {
        switch (this.activeTab) {
            case "care":
                new PatientCare(this.patient).mount(container);
                break;
            case "messages":
                container.replaceChildren(
                    this.renderComingSoon(
                        "Messages",
                        "Secure messaging with your doctors.Secure messaging with your doctors.Secure messaging with your doctors.Secure messaging with your doctors."
                    )
                );
                break;
            default:
                container.replaceChildren(this.renderActiveTab());
        }
    }

    updatePage() {
        if (!this.el) return;
    
        const container = this.el.querySelector("#patient-dashboard-content");
        if (!container) return;
    
        this.mountCurrentPage(container);
    
        const buttons = this.el.querySelectorAll(".patient-bottom-nav__item");
    
        buttons.forEach((button, index) => {
            button.classList.toggle(
                "patient-bottom-nav__item--active",
                this.tabs[index].id === this.activeTab
            );
        });
    }
    renderHomeTab() {
        const summary = this.dashboardSummary;
        const hasProfileGaps =
            !this.patient?.blood_group && !this.patient?.allergies && !this.patient?.chronic_conditions;

        // Determine if the patient has any appointments at all (upcoming or past)
        const hasAnyAppointment = summary?.next_appointment || summary?.recent_consultation;

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
                    h("div", { class: "dashboard-header__divider" }),
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

                      // 1. Messages card (unread count or empty state)
                      summary?.unread_message_count > 0
                          ? this.renderUnreadMessagesCard(summary.unread_message_count)
                          : this.renderNoMessagesCard(),

                      // 2. Appointment card (next appointment, or "Book your first appointment" if none at all)
                      summary?.next_appointment
                          ? this.renderNextAppointmentCard(summary.next_appointment)
                          : hasAnyAppointment
                              ? null // If there is a recent consultation but no upcoming, we skip the appointment card (the consultation card will show past visit)
                              : this.renderBookFirstAppointmentCard(),

                      // 3. Recent consultation card (actual or empty state)
                      summary?.recent_consultation
                          ? this.renderRecentConsultationCard(summary.recent_consultation)
                          : this.renderNoConsultationCard(),

                      // 4. Profile nudge (always if gaps)
                      hasProfileGaps ? this.renderProfileNudgeCard() : null,

                      // 5. Symptom check (always)
                      this.renderSymptomCheckCard()
                  )
        );
    }

    // ---------- Card renderers for empty states ----------

    renderNoMessagesCard() {
        return h(
            "div",
            { class: "dashboard-card", style: "padding: 1rem 1.1rem; display: flex; justify-content: space-between; align-items: center; gap: 10px;" },
            h(
                "div",
                { style: "display: flex; align-items: center; gap: 12px;" },
                h(
                    "div",
                    { style: "padding: 8px; background: rgba(59, 130, 246, 0.1); color: #3b82f6; border-radius: 8px; display: flex; align-items: center; justify-content: center; flex-shrink: 0;" },
                    Icons.message()
                ),
                h(
                    "p",
                    { style: "margin: 0; font-size: 0.9rem; color: #6b7280;" },
                    "No new messages."
                )
            ),
            h(
                "button",
                {
                    class: "btn btn-outline",
                    style: "padding: 0.4rem 0.8rem; font-size: 0.78rem; border-radius: 6px; flex-shrink: 0;",
                    onclick: () => this.setTab("messages"),
                },
                "Open"
            )
        );
    }

    renderNoConsultationCard() {
        return h(
            "div",
            { class: "dashboard-card", style: "padding: 1rem 1.1rem;" },
            h(
                "div",
                { style: "display: flex; gap: 12px; align-items: center;" },
                h(
                    "div",
                    { style: "padding: 8px; background: rgba(99, 102, 241, 0.1); color: #6366f1; border-radius: 8px; display: flex; align-items: center; justify-content: center; flex-shrink: 0;" },
                    Icons.stethoscope()
                ),
                h(
                    "p",
                    { style: "margin: 0; font-size: 0.9rem; color: #6b7280;" },
                    "You haven't had a consultation yet."
                )
            )
        );
    }

    renderBookFirstAppointmentCard() {
        return h(
            "div",
            { class: "dashboard-card", style: "padding: 1rem 1.1rem; display: flex; justify-content: space-between; align-items: center; gap: 10px;" },
            h(
                "div",
                { style: "display: flex; align-items: center; gap: 12px;" },
                h(
                    "div",
                    { style: "padding: 8px; background: rgba(16, 185, 129, 0.1); color: #10b981; border-radius: 8px; display: flex; align-items: center; justify-content: center; flex-shrink: 0;" },
                    Icons.calendar()
                ),
                h(
                    "p",
                    { style: "margin: 0; font-size: 0.9rem;" },
                    "Book your first appointment."
                )
            ),
            h(
                "button",
                {
                    class: "btn btn-primary",
                    style: "padding: 0.4rem 0.8rem; font-size: 0.78rem; border-radius: 6px; flex-shrink: 0;",
                    onclick: () => this.setTab("find"),
                },
                "Find Care"
            )
        );
    }

    // ---------- Existing card renderers (unchanged) ----------

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
                { style: "display: flex; justify-content: space-between; align-items: flex-start; gap: 12px;" },
                h(
                    "div",
                    { style: "display: flex; gap: 12px; align-items: flex-start;" },
                    h(
                        "div",
                        { style: "padding: 8px; background: rgba(16, 185, 129, 0.1); color: #10b981; border-radius: 8px; display: flex; align-items: center; justify-content: center; flex-shrink: 0;" },
                        Icons.calendar()
                    ),
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
                    )
                ),
                h(
                    "span",
                    {
                        class: "dashboard-badge",
                        style: `background: ${badgeColor}; font-size: 0.7rem; padding: 3px 9px; border-radius: 5px; white-space: nowrap; color: #ffffff;`,
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
                "div",
                { style: "display: flex; align-items: center; gap: 12px;" },
                h(
                    "div",
                    { style: "padding: 8px; background: rgba(59, 130, 246, 0.1); color: #3b82f6; border-radius: 8px; display: flex; align-items: center; justify-content: center; flex-shrink: 0;" },
                    Icons.message()
                ),
                h(
                    "p",
                    { style: "margin: 0; font-size: 0.9rem;" },
                    `You have ${count} new message${count === 1 ? "" : "s"}`
                )
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
            h(
                "div",
                { style: "display: flex; gap: 12px; align-items: flex-start;" },
                h(
                    "div",
                    { style: "padding: 8px; background: rgba(99, 102, 241, 0.1); color: #6366f1; border-radius: 8px; display: flex; align-items: center; justify-content: center; flex-shrink: 0;" },
                    Icons.stethoscope()
                ),
                h(
                    "div",
                    {},
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
                        "View my consultation notes"
                    )
                )
            )
        );
    }

    renderProfileNudgeCard() {
        return h(
            "div",
            { class: "dashboard-card", style: "padding: 1rem 1.1rem; background: rgba(2,132,199,0.04);" },
            h(
                "div",
                { style: "display: flex; gap: 12px; align-items: flex-start;" },
                h(
                    "div",
                    { style: "padding: 8px; background: rgba(2, 132, 199, 0.1); color: #0284c7; border-radius: 8px; display: flex; align-items: center; justify-content: center; flex-shrink: 0;" },
                    Icons.userCheck()
                ),
                h(
                    "div",
                    {},
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
                )
            )
        );
    }

    renderSymptomCheckCard() {
        return h(
            "div",
            { class: "dashboard-card", style: "padding: 1rem 1.1rem;" },
            h(
                "div",
                { style: "display: flex; gap: 12px; align-items: flex-start;" },
                h(
                    "div",
                    { style: "padding: 8px; background: rgba(236, 72, 153, 0.1); color: #ec4899; border-radius: 8px; display: flex; align-items: center; justify-content: center; flex-shrink: 0;" },
                    Icons.activity()
                ),
                h(
                    "div",
                    {},
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
                )
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
