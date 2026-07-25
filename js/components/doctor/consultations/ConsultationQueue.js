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
        this.expandedAction = null; // 'confirm' | 'suggest' | 'decline' | 'clinical_notes'
        this.draft = { date: "", note: "" };

        // Tracks structured draft notes for each booking
        this.clinicalNotesMap = {};
        this.draftSaveTimers = {};
        this.draftSaving = {};
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

    async handleSaveClinicalNotes(booking) {
        await this.saveDraft(booking.id);
    
        this.actionLoadingId = booking.id;
        this.errorMessage = "";
        this.successMessage = "";
        this.update();
    
        try {
            await api.post("/consultations", {
                booking_id: booking.id
            });
    
            this.successMessage =
                `Consultation completed for ${booking.patient_name}.`;
    
            this.closeActionForm();
    
        } catch (error) {
            console.error(error);
    
            this.errorMessage =
                error.message || "Failed to complete consultation.";
    
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

    async openActionForm(bookingId, action) {
        this.expandedBookingId = bookingId;
        this.expandedAction = action;
        this.draft = { date: "", note: "" };
        this.errorMessage = "";

        // If opening clinical notes, fetch existing draft/consultation if not already loaded
        if (action === "clinical_notes" && !this.clinicalNotesMap[bookingId]) {
            this.actionLoadingId = bookingId;
            this.update();

            try {
                // Try fetching draft consultation notes
                const res = await api.get(
                    `/consultations/booking/${bookingId}/draft`

                    console.log("Draft response:", res);
                    console.log("Draft response.data:", res.data);
                    console.log("Draft response.data?.data:", res.data?.data);
                );
                
                const draftData = res.data || res;
                
                this.clinicalNotesMap[bookingId] = {
                    raw_notes: draftData.raw_notes || "",
                    outcome_notes: draftData.outcome_notes || "",
                    plan_notes: draftData.plan_notes || "",
                    follow_up_notes: draftData.follow_up_notes || ""
                };
            } catch (err) {
                // Ignore 404s if no draft exists yet
                this.clinicalNotesMap[bookingId] = "";
            } finally {
                this.actionLoadingId = null;
            }
        }

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

    setClinicalField(bookingId, field, value) {
        const draft = this.clinicalNotesMap[bookingId] || {
            raw_notes: "",
            outcome_notes: "",
            plan_notes: "",
            follow_up_notes: ""
        };
    
        draft[field] = value;
        this.clinicalNotesMap[bookingId] = draft;
    
        this.scheduleDraftSave(bookingId);
    }
    scheduleDraftSave(bookingId) {
        clearTimeout(this.draftSaveTimers[bookingId]);
    
        this.draftSaveTimers[bookingId] = setTimeout(() => {
            this.saveDraft(bookingId);
        }, 3000);
    }
    async saveDraft(bookingId) {
        const draft = this.clinicalNotesMap[bookingId];
    
        if (!draft) return;
    
        this.draftSaving[bookingId] = true;
        
    
        try {
            await api.patch(
                `/consultations/booking/${bookingId}/draft`,
                draft
            );
        } catch (err) {
            console.error("Draft save failed", err);
        } finally {
            this.draftSaving[bookingId] = false;
            
        }
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

    // ---------- Reason parsing ----------

    parseReason(reason) {
        if (!reason || typeof reason !== "string") return null;

        const KNOWN_LABELS = ["Symptoms", "Duration", "Notes", "Urgency"];
        let firstIdx = -1;
        for (const label of KNOWN_LABELS) {
            const idx = reason.indexOf(`${label}:`);
            if (idx !== -1 && (firstIdx === -1 || idx < firstIdx)) firstIdx = idx;
        }

        if (firstIdx === -1) return { type: null, tags: [], notes: reason.trim() };

        const type = firstIdx > 0 ? reason.slice(0, firstIdx).replace(/:\s*$/, "").trim() : null;
        const rest = reason.slice(firstIdx);

        const pattern = new RegExp(`(${KNOWN_LABELS.join("|")}):\\s*`, "g");
        const parts = rest.split(pattern);

        const tags = [];
        let notes = "";
        for (let i = 1; i < parts.length; i += 2) {
            const label = parts[i];
            const value = (parts[i + 1] || "").replace(/\|\s*$/, "").trim();
            if (!value) continue;
            if (label === "Notes") {
                notes = value;
            } else {
                tags.push({ label, value });
            }
        }

        return { type, tags, notes };
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
                style: "display: flex; flex-direction: column; gap: 10px; padding: 0.85rem 1rem; margin-bottom: var(--space-3);",
            },
            h("input", {
                type: "text",
                placeholder: "Search by patient name...",
                value: this.searchTerm,
                style: "width: 100%; padding: 0.55rem 0.7rem; border: 1px solid var(--color-line); border-radius: 6px; font-size: 0.88rem; box-sizing: border-box;",
                oninput: e => this.setSearchTerm(e.target.value),
            }),
            this.activeTab === "completed" && this.getTabCount("completed") > 0
                ? h(
                      "button",
                      {
                          class: "btn btn-outline",
                          style: "padding: 0.4rem 0.75rem; font-size: 0.8rem; border-radius: 6px; align-self: flex-start;",
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
            { class: "dashboard-card service-item-card", style: "padding: 1rem 1.1rem; margin-bottom: var(--space-3);" },
            h(
                "div",
                { style: "display: flex; justify-content: space-between; align-items: flex-start; gap: var(--space-3);" },
                h(
                    "div",
                    { style: "min-width: 0;" },
                    h(
                        "h3",
                        { style: "margin: 0 0 4px; font-size: 1.02rem; font-weight: 600; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;" },
                        booking.patient_name || "Unknown Patient"
                    ),
                    h(
                        "p",
                        { class: "dashboard-muted", style: "margin: 0; font-size: 0.8rem; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;" },
                        booking.patient_email || ""
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
            h(
                "div",
                {
                    style: "margin-top: var(--space-3); padding-top: var(--space-3); border-top: 1px solid var(--color-line); display: flex; flex-direction: column; gap: 7px;",
                },
                h(
                    "p",
                    { style: "margin: 0; font-size: 0.86rem;" },
                    h("span", { class: "dashboard-muted", style: "font-size: 0.78rem;" }, "Requested: "),
                    h("span", { style: "font-weight: 600;" }, this.formatDateTime(booking.booking_date))
                ),
                h(
                    "p",
                    { style: "margin: 0; font-size: 0.86rem;" },
                    h("span", { class: "dashboard-muted", style: "font-size: 0.78rem;" }, "Consult: "),
                    h(
                        "span",
                        { style: "font-weight: 600;" },
                        `${booking.consultation_service_name || "General"} · ${this.formatCurrency(booking.consultation_fee_amount)}`
                    )
                )
            ),
            this.renderReasonSection(booking),
            this.renderCardActions(booking, isProcessing),
            isExpanded ? this.renderActionForm(booking, isProcessing) : null
        );
    }

    renderReasonSection(booking) {
        const parsed = this.parseReason(booking.reason);
        if (!parsed) return null;

        const { type, tags, notes } = parsed;
        if (!type && tags.length === 0 && !notes) return null;

        return h(
            "div",
            { style: "margin-top: var(--space-3);" },
            type
                ? h(
                      "span",
                      { style: "font-size: 0.82rem; font-weight: 600; color: var(--color-primary, #0284c7);" },
                      type
                  )
                : null,
            tags.length > 0
                ? h(
                      "div",
                      { style: "display: flex; flex-wrap: wrap; gap: 6px; margin-top: 6px;" },
                      tags.map(tag =>
                          h(
                              "span",
                              {
                                  style: "font-size: 0.76rem; line-height: 1.4; padding: 3px 9px; border-radius: 10px; background: var(--color-bg-muted, #f1f5f9); color: var(--color-ink-faint, #64748b); white-space: nowrap;",
                              },
                              `${tag.label}: ${tag.value}`
                          )
                      )
                  )
                : null,
            notes
                ? h(
                      "p",
                      {
                          class: "dashboard-muted",
                          style: "margin: 6px 0 0; font-size: 0.8rem; line-height: 1.45;",
                      },
                      notes
                  )
                : null
        );
    }

    renderCardActions(booking, isProcessing) {
        const buttons = [];

        const btnStyle = "padding: 0.4rem 0.75rem; font-size: 0.8rem; border-radius: 6px; line-height: 1.4;";

        if (PENDING_STATUSES.includes(booking.status)) {
            buttons.push(
                h(
                    "button",
                    {
                        class: "btn btn-primary",
                        style: btnStyle,
                        disabled: isProcessing,
                        onclick: () => this.openActionForm(booking.id, "confirm"),
                    },
                    "Confirm"
                ),
                h(
                    "button",
                    {
                        class: "btn btn-outline",
                        style: btnStyle,
                        disabled: isProcessing,
                        onclick: () => this.openActionForm(booking.id, "suggest"),
                    },
                    "Suggest Time"
                ),
                h(
                    "button",
                    {
                        class: "btn btn-outline",
                        style: `${btnStyle} color: #ef4444; border-color: #ef4444;`,
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
                        class: "btn btn-outline",
                        style: btnStyle,
                        disabled: isProcessing,
                        onclick: () => this.openActionForm(booking.id, "clinical_notes"),
                    },
                    "Clinical Notes"
                ),
                h(
                    "button",
                    {
                        class: "btn btn-primary",
                        style: btnStyle,
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
                        style: btnStyle,
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
            { style: "display: flex; gap: 8px; margin-top: var(--space-3); flex-wrap: wrap;" },
            buttons
        );
    }

    renderActionForm(booking, isProcessing) {
        const action = this.expandedAction;
    
        const fieldLabelStyle = "display: block; margin-bottom: 5px; font-size: 0.76rem;";
        const fieldInputStyle = "padding: 0.5rem; border: 1px solid var(--color-line); border-radius: 6px; width: 100%; font-size: 0.88rem; box-sizing: border-box;";
    
        // 1. Render Clinical Notes view
        if (action === "clinical_notes") {
            const draft = this.clinicalNotesMap[booking.id] || {
                raw_notes: "",
                outcome_notes: "",
                plan_notes: "",
                follow_up_notes: ""
            };
    
            const isSaving = !!this.draftSaving[booking.id];
    
            return h(
                "div",
                {
                    style: "margin-top: var(--space-3); padding: 0.85rem; background: rgba(2,132,199,0.04); border-radius: 8px;",
                },
                h("label", { class: "dashboard-muted", style: fieldLabelStyle }, "Raw Notes"),
                h("textarea", {
                    rows: 3,
                    value: draft.raw_notes,
                    style: `${fieldInputStyle} font-family: inherit; resize: vertical;`,
                    oninput: e => this.setClinicalField(booking.id, "raw_notes", e.target.value)
                }),
                
                h("label", { class: "dashboard-muted", style: `${fieldLabelStyle} margin-top:10px;` }, "Outcome"),
                h("textarea", {
                    rows: 2,
                    value: draft.outcome_notes,
                    style: `${fieldInputStyle} font-family: inherit; resize: vertical;`,
                    oninput: e => this.setClinicalField(booking.id, "outcome_notes", e.target.value)
                }),
                
                h("label", { class: "dashboard-muted", style: `${fieldLabelStyle} margin-top:10px;` }, "Plan"),
                h("textarea", {
                    rows: 2,
                    value: draft.plan_notes,
                    style: `${fieldInputStyle} font-family: inherit; resize: vertical;`,
                    oninput: e => this.setClinicalField(booking.id, "plan_notes", e.target.value)
                }),
                
                h("label", { class: "dashboard-muted", style: `${fieldLabelStyle} margin-top:10px;` }, "Follow-up"),
                h("textarea", {
                    rows: 2,
                    value: draft.follow_up_notes,
                    style: `${fieldInputStyle} font-family: inherit; resize: vertical;`,
                    oninput: e => this.setClinicalField(booking.id, "follow_up_notes", e.target.value)
                }),
    
                h(
                    "p",
                    { class: "dashboard-muted", style: "margin-top:8px; font-size:0.75rem;" },
                    isSaving ? "Saving draft..." : "Draft saved automatically"
                ),
    
                h(
                    "div",
                    { style: "display: flex; gap: 8px; margin-top: 12px;" },
                    h(
                        "button",
                        {
                            class: "btn btn-primary",
                            style: "padding: 0.4rem 0.75rem; font-size: 0.8rem; border-radius: 6px;",
                            disabled: isProcessing,
                            onclick: () => this.handleSaveClinicalNotes(booking),
                        },
                        isProcessing ? "Saving..." : "Complete Consultation"
                    ),
                    h(
                        "button",
                        {
                            class: "btn btn-outline",
                            style: "padding: 0.4rem 0.75rem; font-size: 0.8rem; border-radius: 6px;",
                            disabled: isProcessing,
                            onclick: () => this.closeActionForm(),
                        },
                        "Cancel"
                    )
                )
            );
        }
    
        // 2. Render Standard confirmation / suggest / decline forms
        const dateField =
            action === "confirm" || action === "suggest"
                ? h(
                      "div",
                      {},
                      h(
                          "label",
                          { class: "dashboard-muted", style: fieldLabelStyle },
                          action === "confirm" ? "Confirmed time (optional)" : "Proposed new time"
                      ),
                      h("input", {
                          type: "datetime-local",
                          value: this.draft.date,
                          style: fieldInputStyle,
                          oninput: e => this.setDraftField("date", e.target.value),
                      })
                  )
                : null;
    
        const noteField = h(
            "div",
            { style: "margin-top: 10px;" },
            h(
                "label",
                { class: "dashboard-muted", style: fieldLabelStyle },
                action === "decline" ? "Reason (optional)" : "Note (optional)"
            ),
            h("textarea", {
                rows: 3,
                value: this.draft.note,
                style: `${fieldInputStyle} font-family: inherit; resize: vertical;`,
                oninput: e => this.setDraftField("note", e.target.value),
            })
        );
    
        const submitLabel =
            action === "confirm" ? "Confirm" : action === "suggest" ? "Send Time" : "Confirm Decline";
    
        const submitHandler = () => {
            if (action === "confirm") return this.handleConfirm(booking);
            if (action === "suggest") return this.handleSuggestTime(booking);
            if (action === "decline") return this.handleDecline(booking);
        };
    
        return h(
            "div",
            {
                style: "margin-top: var(--space-3); padding: 0.85rem; background: rgba(2,132,199,0.04); border-radius: 8px;",
            },
            dateField,
            noteField,
            h(
                "div",
                { style: "display: flex; gap: 8px; margin-top: 12px;" },
                h(
                    "button",
                    {
                        class: "btn btn-primary",
                        style: "padding: 0.4rem 0.75rem; font-size: 0.8rem; border-radius: 6px;",
                        disabled: isProcessing,
                        onclick: submitHandler,
                    },
                    isProcessing ? "Processing..." : submitLabel
                ),
                h(
                    "button",
                    {
                        class: "btn btn-outline",
                        style: "padding: 0.4rem 0.75rem; font-size: 0.8rem; border-radius: 6px;",
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
            { class: "text-center", style: "margin-top: var(--space-2);" },
            h(
                "button",
                {
                    class: "btn btn-outline",
                    style: "padding: 0.35rem 0.8rem; font-size: 0.75rem; border-radius: 5px;",
                    disabled: this.loadingMore,
                    onclick: () => this.loadBookings({ reset: false }),
                },
                this.loadingMore ? "Loading..." : "Load More"
            )
        );
    }

    update() {
        if (!this.el) return;
        const newTree = this.render();
        this.el.replaceChildren(...(Array.isArray(newTree) ? newTree : [newTree]).flat());
    }
}
