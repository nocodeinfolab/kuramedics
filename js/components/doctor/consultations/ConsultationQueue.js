// js/components/doctor/queue/DoctorQueuePage.js

import { Component } from "../../../core/component.js";
import { h } from "../../../utils/dom.js";
import api from "../../../services/api.js";

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

const PAGE_LIMIT = 20;

export default class DoctorQueuePage extends Component {
    constructor(doctor) {
        super();
        this.doctor = doctor ?? {};

        this.loading = true;
        this.loadingMore = false;
        this.archivingAll = false;
        this.actionLoadingId = null;

        this.errorMessage = "";
        this.successMessage = "";

        this.bookings = [];
        this.page = 0;
        this.hasMore = true;
        this.totalCount = 0;

        this.activeTab = "pending";
        this.searchTerm = "";

        this.expandedBookingId = null;
        this.expandedAction = null; // 'confirm' | 'suggest' | 'decline'
        this.draft = { date: "", note: "" };
    }

    async afterMount() {
        await this.loadBookings({ reset: true });
    }

    // ---------- Data loading ----------

    async loadBookings({ reset = false } = {}) {
        if (reset) {
            this.loading = true;
            this.page = 0;
            this.bookings = [];
            this.hasMore = true;
        } else {
            this.loadingMore = true;
        }
        this.errorMessage = "";
        this.update();

        try {
            const nextPage = this.page + 1;
            const res = await api.get(`/bookings?page=${nextPage}&limit=${PAGE_LIMIT}`);
            const payload = res.data || res;
            const rows = payload.rows || payload.data || payload.items || [];
            const total = payload.total ?? payload.count ?? rows.length;

            this.bookings = reset ? rows : [...this.bookings, ...rows];
            this.totalCount = total;
            this.page = nextPage;
            this.hasMore = this.bookings.length < total;
        } catch (error) {
            console.error("Failed to load bookings:", error);
            this.errorMessage = error.message || "Failed to load appointment queue.";
        } finally {
            this.loading = false;
            this.loadingMore = false;
            this.update();
        }
    }

    replaceBookingInList(updatedBooking) {
        if (!updatedBooking?.id) return;
        this.bookings = this.bookings.map(b =>
            b.id === updatedBooking.id ? { ...b, ...updatedBooking } : b
        );
    }

    removeBookingFromList(bookingId) {
        this.bookings = this.bookings.filter(b => b.id !== bookingId);
    }

    // ---------- Actions ----------

    async handleConfirm(booking) {
        this.actionLoadingId = booking.id;
        this.errorMessage = "";
        this.successMessage = "";
        this.update();

        try {
            const body = {};
            if (this.draft.date) body.booking_date = new Date(this.draft.date).toISOString();
            if (this.draft.note) body.confirmation_note = this.draft.note;

            const res = await api.patch(`/bookings/${booking.id}/confirm`, body);
            const updated = res.data || res;
            this.replaceBookingInList(updated);
            this.successMessage = `Appointment with ${booking.patient_name} confirmed.`;
            this.closeActionForm();
        } catch (error) {
            console.error("Failed to confirm booking:", error);
            this.errorMessage = error.message || "Failed to confirm appointment.";
        } finally {
            this.actionLoadingId = null;
            this.update();
        }
    }

    async handleSuggestTime(booking) {
        if (!this.draft.date) {
            this.errorMessage = "Please select a proposed date and time.";
            this.update();
            return;
        }

        this.actionLoadingId = booking.id;
        this.errorMessage = "";
        this.successMessage = "";
        this.update();

        try {
            const res = await api.patch(`/bookings/${booking.id}/suggest-time`, {
                booking_date: new Date(this.draft.date).toISOString(),
                confirmation_note: this.draft.note || undefined,
            });
            const updated = res.data || res;
            this.replaceBookingInList(updated);
            this.successMessage = `New time proposed to ${booking.patient_name}.`;
            this.closeActionForm();
        } catch (error) {
            console.error("Failed to suggest new time:", error);
            this.errorMessage = error.message || "Failed to suggest a new time.";
        } finally {
            this.actionLoadingId = null;
            this.update();
        }
    }

    async handleDecline(booking) {
        this.actionLoadingId = booking.id;
        this.errorMessage = "";
        this.successMessage = "";
        this.update();

        try {
            const res = await api.patch(`/bookings/${booking.id}/decline`, {
                reason: this.draft.note || undefined,
            });
            const updated = res.data || res;
            this.replaceBookingInList(updated);
            this.successMessage = `Appointment request from ${booking.patient_name} declined.`;
            this.closeActionForm();
        } catch (error) {
            console.error("Failed to decline booking:", error);
            this.errorMessage = error.message || "Failed to decline appointment.";
        } finally {
            this.actionLoadingId = null;
            this.update();
        }
    }

    async handleMarkCompleted(booking) {
        this.actionLoadingId = booking.id;
        this.errorMessage = "";
        this.successMessage = "";
        this.update();

        try {
            const res = await api.patch(`/bookings/${booking.id}/status`, {
                status: "completed",
            });
            const updated = res.data || res;
            this.replaceBookingInList(updated);
            this.successMessage = `Marked appointment with ${booking.patient_name} as completed.`;
        } catch (error) {
            console.error("Failed to mark booking completed:", error);
            this.errorMessage = error.message || "Failed to mark appointment as completed.";
        } finally {
            this.actionLoadingId = null;
            this.update();
        }
    }

    async handleArchive(booking) {
        this.actionLoadingId = booking.id;
        this.errorMessage = "";
        this.successMessage = "";
        this.update();

        try {
            await api.patch(`/bookings/${booking.id}/archive`, {});
            this.removeBookingFromList(booking.id);
            this.successMessage = `Archived appointment with ${booking.patient_name}.`;
        } catch (error) {
            console.error("Failed to archive booking:", error);
            this.errorMessage = error.message || "Failed to archive appointment.";
        } finally {
            this.actionLoadingId = null;
            this.update();
        }
    }

    async handleArchiveAllCompleted() {
        const completedIds = this.bookings
            .filter(b => COMPLETED_STATUSES.includes(b.status))
            .map(b => b.id);

        if (completedIds.length === 0) return;

        this.archivingAll = true;
        this.errorMessage = "";
        this.successMessage = "";
        this.update();

        try {
            const res = await api.patch("/bookings/archive-completed", { all: true });
            const result = res.data || res;
            this.bookings = this.bookings.filter(b => !COMPLETED_STATUSES.includes(b.status));
            this.successMessage = `Archived ${result.archived_count ?? completedIds.length} completed appointment(s).`;
        } catch (error) {
            console.error("Failed to archive completed bookings:", error);
            this.errorMessage = error.message || "Failed to archive completed appointments.";
        } finally {
            this.archivingAll = false;
            this.update();
        }
    }

    // ---------- Inline form state ----------

    openActionForm(bookingId, action) {
        this.expandedBookingId = bookingId;
        this.expandedAction = action;
        this.draft = { date: "", note: "" };
        this.errorMessage = "";
        this.update();
    }

    closeActionForm() {
        this.expandedBookingId = null;
        this.expandedAction = null;
        this.draft = { date: "", note: "" };
        this.update();
    }

    setDraftField(field, value) {
        this.draft = { ...this.draft, [field]: value };
    }

    setTab(tab) {
        if (this.activeTab === tab) return;
        this.activeTab = tab;
        this.closeActionForm();
        this.update();
    }

    setSearchTerm(term) {
        this.searchTerm = term;
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
        const term = this.searchTerm.trim().toLowerCase();

        return this.bookings
            .filter(b => statuses.includes(b.status))
            .filter(b => !term || (b.patient_name || "").toLowerCase().includes(term))
            .sort((a, b) => new Date(a.booking_date) - new Date(b.booking_date));
    }

    getTabCount(tab) {
        const statuses = this.getStatusesForTab(tab);
        return this.bookings.filter(b => statuses.includes(b.status)).length;
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

    formatCurrency(amount) {
        return new Intl.NumberFormat("en-NG", {
            style: "currency",
            currency: "NGN",
            maximumFractionDigits: 0,
        }).format(amount || 0);
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
                      h("p", { class: "dashboard-muted" }, "Loading appointment queue...")
                  )
                : this.renderContent()
        );
    }

    renderHeader() {
        return h(
            "section",
            { class: "dashboard-header" },
            h("p", { class: "dashboard-greeting" }, "Doctor Queue"),
            h("h1", { class: "dashboard-title" }, "Appointment Queue"),
            h(
                "p",
                { class: "dashboard-subtitle" },
                "Review, confirm, and manage appointments booked by your patients."
            )
        );
    }

    renderAlerts() {
        const alerts = [];
        if (this.errorMessage) {
            alerts.push(
                h(
                    "div",
                    { class: "dashboard-card", style: "border-left: 4px solid #ef4444;" },
                    h("p", { style: "color: #ef4444; margin: 0;" }, this.errorMessage)
                )
            );
        }
        if (this.successMessage) {
            alerts.push(
                h(
                    "div",
                    { class: "dashboard-card", style: "border-left: 4px solid #10b981;" },
                    h("p", { style: "color: #10b981; margin: 0;" }, this.successMessage)
                )
            );
        }
        return alerts;
    }

    renderContent() {
        return h(
            "div",
            { class: "services-list" },
            this.renderControls(),
            this.renderTabs(),
            this.renderList(),
            this.renderLoadMore()
        );
    }

    renderControls() {
        return h(
            "div",
            {
                class: "dashboard-card",
                style: "display: flex; align-items: center; gap: var(--space-3); flex-wrap: wrap;",
            },
            h("input", {
                type: "text",
                placeholder: "Search by patient name...",
                value: this.searchTerm,
                style: "flex: 1; min-width: 220px; padding: 0.5rem 0.75rem; border: 1px solid var(--color-line); border-radius: 6px;",
                oninput: e => this.setSearchTerm(e.target.value),
            }),
            this.activeTab === "completed" && this.getTabCount("completed") > 0
                ? h(
                      "button",
                      {
                          class: "btn btn-outline",
                          disabled: this.archivingAll,
                          onclick: () => this.handleArchiveAllCompleted(),
                      },
                      this.archivingAll ? "Archiving..." : "Archive All Completed"
                  )
                : null
        );
    }

    renderTabs() {
        const tabs = [
            { key: "pending", label: "Pending" },
            { key: "confirmed", label: "Confirmed" },
            { key: "completed", label: "Completed" },
        ];

        return h(
            "div",
            {
                class: "dashboard-card",
                style: "display: flex; gap: var(--space-2); padding: var(--space-2);",
            },
            tabs.map(tab =>
                h(
                    "button",
                    {
                        class: `btn ${this.activeTab === tab.key ? "btn-primary" : "btn-outline"}`,
                        style: "padding: 0.4rem 1rem; font-size: var(--step-small);",
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
                    this.searchTerm
                        ? `No ${this.activeTab} appointments match "${this.searchTerm}".`
                        : `No ${this.activeTab} appointments right now.`
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
        const isProcessing = this.actionLoadingId === booking.id;
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
            { class: "dashboard-card service-item-card" },
            h(
                "div",
                { style: "display: flex; justify-content: space-between; align-items: flex-start; gap: var(--space-3);" },
                h(
                    "div",
                    {},
                    h("h3", { style: "margin: 0 0 4px;" }, booking.patient_name || "Unknown Patient"),
                    h(
                        "p",
                        { class: "dashboard-muted", style: "margin: 0; font-size: var(--step-small);" },
                        booking.patient_email || ""
                    )
                ),
                h(
                    "span",
                    { class: "dashboard-badge", style: `background: ${badgeColor};` },
                    statusLabel
                )
            ),
            h(
                "div",
                {
                    class: "input-group",
                    style: "margin-top: var(--space-3); padding-top: var(--space-3); border-top: 1px solid var(--color-line);",
                },
                h(
                    "div",
                    {},
                    h("span", { class: "dashboard-muted" }, "Requested Time"),
                    h("p", { style: "font-weight: 600; margin: 4px 0 0;" }, this.formatDateTime(booking.booking_date))
                ),
                h(
                    "div",
                    {},
                    h("span", { class: "dashboard-muted" }, "Consultation"),
                    h(
                        "p",
                        { style: "font-weight: 600; margin: 4px 0 0;" },
                        `${booking.consultation_service_name || "General"} · ${this.formatCurrency(booking.consultation_fee_amount)}`
                    )
                )
            ),
            booking.reason
                ? h(
                      "p",
                      { class: "dashboard-muted", style: "margin-top: var(--space-3); font-size: var(--step-small);" },
                      `Reason: ${booking.reason}`
                  )
                : null,
            this.renderCardActions(booking, isProcessing),
            isExpanded ? this.renderActionForm(booking, isProcessing) : null
        );
    }

    renderCardActions(booking, isProcessing) {
        const buttons = [];

        if (PENDING_STATUSES.includes(booking.status)) {
            buttons.push(
                h(
                    "button",
                    {
                        class: "btn btn-primary",
                        style: "padding: 0.4rem 0.8rem; font-size: var(--step-small);",
                        disabled: isProcessing,
                        onclick: () => this.openActionForm(booking.id, "confirm"),
                    },
                    "Confirm"
                ),
                h(
                    "button",
                    {
                        class: "btn btn-outline",
                        style: "padding: 0.4rem 0.8rem; font-size: var(--step-small);",
                        disabled: isProcessing,
                        onclick: () => this.openActionForm(booking.id, "suggest"),
                    },
                    "Suggest New Time"
                ),
                h(
                    "button",
                    {
                        class: "btn btn-outline",
                        style: "padding: 0.4rem 0.8rem; font-size: var(--step-small); color: #ef4444; border-color: #ef4444;",
                        disabled: isProcessing,
                        onclick: () => this.openActionForm(booking.id, "decline"),
                    },
                    "Decline"
                )
            );
        }

        if (CONFIRMED_STATUSES.includes(booking.status)) {
            buttons.push(
                h(
                    "button",
                    {
                        class: "btn btn-primary",
                        style: "padding: 0.4rem 0.8rem; font-size: var(--step-small);",
                        disabled: isProcessing,
                        onclick: () => this.handleMarkCompleted(booking),
                    },
                    isProcessing ? "Updating..." : "Mark Completed"
                )
            );
        }

        if (COMPLETED_STATUSES.includes(booking.status)) {
            buttons.push(
                h(
                    "button",
                    {
                        class: "btn btn-outline",
                        style: "padding: 0.4rem 0.8rem; font-size: var(--step-small);",
                        disabled: isProcessing,
                        onclick: () => this.handleArchive(booking),
                    },
                    isProcessing ? "Archiving..." : "Archive"
                )
            );
        }

        if (buttons.length === 0) return null;

        return h(
            "div",
            { style: "display: flex; gap: var(--space-2); margin-top: var(--space-3); flex-wrap: wrap;" },
            buttons
        );
    }

    renderActionForm(booking, isProcessing) {
        const action = this.expandedAction;

        const dateField =
            action === "confirm" || action === "suggest"
                ? h(
                      "div",
                      {},
                      h(
                          "label",
                          { class: "dashboard-muted", style: "display: block; margin-bottom: 4px; font-size: var(--step-small);" },
                          action === "confirm"
                              ? "Confirmed time (optional — defaults to requested time)"
                              : "Proposed new time"
                      ),
                      h("input", {
                          type: "datetime-local",
                          value: this.draft.date,
                          style: "padding: 0.4rem; border: 1px solid var(--color-line); border-radius: 6px; width: 100%;",
                          oninput: e => this.setDraftField("date", e.target.value),
                      })
                  )
                : null;

        const noteField = h(
            "div",
            { style: "margin-top: var(--space-2);" },
            h(
                "label",
                { class: "dashboard-muted", style: "display: block; margin-bottom: 4px; font-size: var(--step-small);" },
                action === "decline" ? "Reason (optional, shared with patient)" : "Note (optional, shared with patient)"
            ),
            h("textarea", {
                value: this.draft.note,
                rows: 2,
                style: "padding: 0.4rem; border: 1px solid var(--color-line); border-radius: 6px; width: 100%; font-family: inherit;",
                oninput: e => this.setDraftField("note", e.target.value),
            })
        );

        const submitLabel =
            action === "confirm" ? "Confirm Appointment" : action === "suggest" ? "Send Proposed Time" : "Confirm Decline";

        const submitHandler = () => {
            if (action === "confirm") return this.handleConfirm(booking);
            if (action === "suggest") return this.handleSuggestTime(booking);
            if (action === "decline") return this.handleDecline(booking);
        };

        return h(
            "div",
            {
                style: "margin-top: var(--space-3); padding: var(--space-3); background: rgba(2,132,199,0.04); border-radius: 8px;",
            },
            dateField,
            noteField,
            h(
                "div",
                { style: "display: flex; gap: var(--space-2); margin-top: var(--space-3);" },
                h(
                    "button",
                    {
                        class: "btn btn-primary",
                        style: "padding: 0.4rem 0.8rem; font-size: var(--step-small);",
                        disabled: isProcessing,
                        onclick: submitHandler,
                    },
                    isProcessing ? "Processing..." : submitLabel
                ),
                h(
                    "button",
                    {
                        class: "btn btn-outline",
                        style: "padding: 0.4rem 0.8rem; font-size: var(--step-small);",
                        disabled: isProcessing,
                        onclick: () => this.closeActionForm(),
                    },
                    "Cancel"
                )
            )
        );
    }

    renderLoadMore() {
        if (!this.hasMore) return null;

        return h(
            "div",
            { class: "text-center", style: "margin-top: var(--space-3);" },
            h(
                "button",
                {
                    class: "btn btn-outline",
                    disabled: this.loadingMore,
                    onclick: () => this.loadBookings({ reset: false }),
                },
                this.loadingMore ? "Loading..." : "Load More Appointments"
            )
        );
    }

    update() {
        if (!this.el) return;
        const newTree = this.render();
        this.el.replaceChildren(...(Array.isArray(newTree) ? newTree : [newTree]).flat());
    }
}
