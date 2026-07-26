// js/components/patient/PatientCare.js

import { Component } from "../../core/component.js";
import { h } from "../../utils/dom.js";
import api from "../../services/api.js";

const PENDING_STATUSES = ["pending", "pending_confirmation", "reschedule_requested"];
const CONFIRMED_STATUSES = ["confirmed"];
const COMPLETED_STATUSES = ["completed"];

const STATUS_LABELS = {
    pending: "Pending",
    pending_confirmation: "Awaiting Confirmation",
    reschedule_requested: "Time Suggested",
    confirmed: "Confirmed",
    completed: "Completed",
    cancelled: "Cancelled",
};

const SECTION_ORDER = ["Outcome", "Plan", "Follow-up"];

export default class PatientCare extends Component {
    constructor(patient) {
        super();
        this.patient = patient ?? {};

        this.loading = true;
        this.errorMessage = "";

        this.bookings = [];
        this.recordsByBookingId = {};

        this.activeTab = "upcoming";
        this.expandedBookingId = null;
    }

    async afterMount() {
        await this.loadData();
    }

    // ---------- Data loading ----------

    async loadData() {
        this.loading = true;
        this.errorMessage = "";
        this.update();

        try {
            const [bookingsRes, recordsRes] = await Promise.all([
                api.get("/bookings?page=1&limit=50"),
                api.get("/consultations/my-records"),
            ]);

            const bookingsPayload = bookingsRes.data || bookingsRes;
            this.bookings = bookingsPayload.rows || bookingsPayload.data || bookingsPayload.items || [];

            const recordsPayload = recordsRes.data || recordsRes;
            const records = Array.isArray(recordsPayload) ? recordsPayload : recordsPayload.rows || recordsPayload.data || [];

            this.recordsByBookingId = {};
            records.forEach(record => {
                this.recordsByBookingId[record.booking_id] = record;
            });
        } catch (error) {
            console.error("Failed to load care history:", error);
            this.errorMessage = error.message || "Failed to load your appointments.";
        } finally {
            this.loading = false;
            this.update();
        }
    }

    // ---------- Interaction ----------

    setTab(tab) {
        if (this.activeTab === tab) return;
        this.activeTab = tab;
        this.expandedBookingId = null;
        this.update();
    }

    toggleBooking(bookingId) {
        this.expandedBookingId = this.expandedBookingId === bookingId ? null : bookingId;
        this.update();
    }

    // ---------- Derived data ----------

    getStatusesForTab(tab) {
        if (tab === "confirmed") return CONFIRMED_STATUSES;
        if (tab === "completed") return COMPLETED_STATUSES;
        return PENDING_STATUSES;
    }

    getFilteredBookings() {
        const statuses = this.getStatusesForTab(this.activeTab);
        return this.bookings
            .filter(b => statuses.includes(b.status))
            .sort((a, b) => new Date(b.booking_date) - new Date(a.booking_date));
    }

    getTabCount(tab) {
        const statuses = this.getStatusesForTab(tab);
        return this.bookings.filter(b => statuses.includes(b.status)).length;
    }

    // ---------- Note parsing (same approach as doctor-side PatientRecords.js) ----------

    parseDoctorNotes(rawText) {
        if (!rawText || typeof rawText !== "string") return [];

        const sectionRegex = /(Outcome|Plan|Follow-up)\n-+\n([\s\S]*?)(?=\n\n(?:Outcome|Plan|Follow-up)\n-+|\s*$)/g;
        const sections = [];
        let match;

        while ((match = sectionRegex.exec(rawText)) !== null) {
            sections.push({ title: match[1], body: match[2].trim() });
        }

        if (sections.length === 0) {
            return [{ title: "Notes", body: rawText.trim() }];
        }

        return sections.sort(
            (a, b) => SECTION_ORDER.indexOf(a.title) - SECTION_ORDER.indexOf(b.title)
        );
    }

    splitParagraphs(text) {
        if (!text) return [];
        let paragraphs = text.split(/\n\s*\n/).map(p => p.trim()).filter(Boolean);
        if (paragraphs.length <= 1) {
            paragraphs = text.split(/\n/).map(p => p.trim()).filter(Boolean);
        }
        return paragraphs.length ? paragraphs : [text.trim()];
    }

    // ---------- Formatting ----------

    formatDateTime(dateString) {
        if (!dateString) return "N/A";
        return new Date(dateString).toLocaleString(undefined, {
            year: "numeric",
            month: "short",
            day: "numeric",
            hour: "2-digit",
            minute: "2-digit",
        });
    }

    // ---------- Render ----------

    render() {
        return h(
            "div",
            { class: "dashboard-page queue-page" },
            this.renderHeader(),
            this.renderAlerts(),
            this.loading
                ? h(
                      "div",
                      { class: "dashboard-card text-center py-4" },
                      h("p", { class: "dashboard-muted" }, "Loading your appointments...")
                  )
                : this.renderContent()
        );
    }

    renderHeader() {
        return h(
            "section",
            { class: "dashboard-header" },
            h("p", { class: "dashboard-greeting" }, "My Care"),
            h("h1", { class: "dashboard-title" }, "Appointments & Records"),
            h(
                "p",
                { class: "dashboard-subtitle" },
                "Track your appointments and view your consultation notes."
            )
        );
    }

    renderAlerts() {
        if (!this.errorMessage) return null;
        return h(
            "div",
            { class: "dashboard-card", style: "border-left: 4px solid #ef4444; margin-bottom: var(--space-3);" },
            h("p", { style: "color: #ef4444; margin: 0;" }, this.errorMessage)
        );
    }

    renderContent() {
        return h(
            "div",
            { class: "services-list" },
            this.renderTabs(),
            this.renderList()
        );
    }

    renderTabs() {
        const tabs = [
            { key: "upcoming", label: "Upcoming" },
            { key: "confirmed", label: "Confirmed" },
            { key: "completed", label: "Completed" },
        ];

        return h(
            "div",
            {
                class: "dashboard-card",
                style: "display: flex; gap: 8px; padding: 0.65rem 0.75rem; overflow-x: auto; margin-bottom: var(--space-3);",
            },
            tabs.map(tab =>
                h(
                    "button",
                    {
                        class: `btn ${this.activeTab === tab.key ? "btn-primary" : "btn-outline"}`,
                        style: "padding: 0.42rem 0.8rem; font-size: 0.8rem; border-radius: 6px; white-space: nowrap; flex-shrink: 0;",
                        onclick: () => this.setTab(tab.key),
                    },
                    `${tab.label} (${this.getTabCount(tab.key)})`
                )
            )
        );
    }

    renderList() {
        const filtered = this.getFilteredBookings();

        if (filtered.length === 0) {
            return h(
                "div",
                { class: "dashboard-card text-center py-4" },
                h(
                    "p",
                    { class: "dashboard-muted" },
                    `No ${this.activeTab} appointments right now.`
                )
            );
        }

        return h(
            "div",
            { class: "services-list" },
            filtered.map(booking => this.renderBookingCard(booking))
        );
    }

    renderBookingCard(booking) {
        const isExpanded = this.expandedBookingId === booking.id;
        const isCompleted = COMPLETED_STATUSES.includes(booking.status);
        const statusLabel = STATUS_LABELS[booking.status] || booking.status;

        const badgeColor =
            booking.status === "confirmed"
                ? "#10b981"
                : booking.status === "completed"
                ? "var(--color-ink-faint)"
                : booking.status === "reschedule_requested"
                ? "#f59e0b"
                : "#0284c7";

        return h(
            "div",
            {
                class: "dashboard-card service-item-card",
                style: `padding: 1rem 1.1rem; margin-bottom: var(--space-3); ${isCompleted ? "cursor: pointer;" : ""}`,
                onclick: isCompleted ? () => this.toggleBooking(booking.id) : null,
            },
            h(
                "div",
                { style: "display: flex; justify-content: space-between; align-items: flex-start; gap: var(--space-3);" },
                h(
                    "div",
                    { style: "min-width: 0;" },
                    h(
                        "h3",
                        { style: "margin: 0 0 4px; font-size: 1.02rem; font-weight: 600; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;" },
                        booking.doctor_name || "Unknown Doctor"
                    ),
                    h(
                        "p",
                        { class: "dashboard-muted", style: "margin: 0; font-size: 0.8rem;" },
                        `${booking.consultation_service_name || "General"} · ${this.formatDateTime(booking.booking_date)}`
                    )
                ),
                h(
                    "span",
                    {
                        class: "dashboard-badge",
                        style: `background: ${badgeColor}; font-size: 0.7rem; padding: 3px 9px; border-radius: 5px; white-space: nowrap; flex-shrink: 0;`,
                    },
                    statusLabel
                )
            ),
            isCompleted
                ? h(
                      "p",
                      { class: "dashboard-muted", style: "margin: 10px 0 0; font-size: 0.78rem;" },
                      isExpanded ? "Tap to hide notes" : "Tap to view notes"
                  )
                : null,
            isCompleted && isExpanded ? this.renderConsultationNotes(booking) : null
        );
    }

    renderConsultationNotes(booking) {
        const record = this.recordsByBookingId[booking.id];

        if (!record) {
            return h(
                "div",
                { style: "margin-top: var(--space-3); padding-top: var(--space-3); border-top: 1px solid var(--color-line);" },
                h("p", { class: "dashboard-muted" }, "No notes have been recorded for this consultation yet.")
            );
        }

        const sections = this.parseDoctorNotes(record.doctor_notes);

        return h(
            "div",
            {
                style: "margin-top: var(--space-3); padding-top: var(--space-3); border-top: 1px solid var(--color-line);",
                onclick: e => e.stopPropagation(),
            },
            sections.map(section =>
                h(
                    "div",
                    { style: "margin-bottom: 12px;" },
                    h(
                        "h4",
                        {
                            style: "margin: 0 0 6px; font-size: 0.86rem; font-weight: 700; color: var(--color-primary, #0284c7); text-transform: uppercase; letter-spacing: 0.03em;",
                        },
                        section.title
                    ),
                    this.splitParagraphs(section.body).map(paragraph =>
                        h(
                            "p",
                            { style: "margin: 0 0 8px; font-size: 0.88rem; line-height: 1.55;" },
                            paragraph
                        )
                    )
                )
            )
        );
    }

    update() {
        if (!this.el) return;
        const newTree = this.render();
        this.el.replaceChildren(...(Array.isArray(newTree) ? newTree : [newTree]).flat());
    }
}
