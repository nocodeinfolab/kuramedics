// js/components/doctor/queue/DoctorQueuePage.js

import { Component } from "../../../core/component.js";
import api from "../../../services/api.js";
import { h, autoGrow } from "../../../utils/dom.js";
import VideoCallRoom from "../../shared/VideoCallRoom.js";

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
const icon = (paths, size = 18) =>
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

const QI = {
    search: ["M11 19a8 8 0 1 0 0-16 8 8 0 0 0 0 16z", "M21 21l-4.3-4.3"],
    calendar: [
        "M5 5h14a1 1 0 0 1 1 1v14a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1z",
        "M4 9h16", "M8 3v4", "M16 3v4"
    ],
    service: [
        "M5 3H4a2 2 0 0 0-2 2v4a6 6 0 0 0 12 0V5a2 2 0 0 0-2-2h-1",
        "M11 2v2", "M5 2v2", "M8 15a6 6 0 0 0 12 0v-3"
    ],
    lock: ["M6 11h12a1 1 0 0 1 1 1v8a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1v-8a1 1 0 0 1 1-1z", "M8 11V8a4 4 0 0 1 8 0v3"],
    alert: ["M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0z", "M12 9v4", "M12 17h.01"],
    check: ["M5 12.5l4.5 4.5L19 7.5"]
};

const STATUS_TONES = {
    pending: "info",
    pending_confirmation: "info",
    reschedule_requested: "warning",
    confirmed: "success",
    completed: "neutral"
};

const getInitials = name => {
    const parts = (name || "").trim().split(/\s+/).filter(Boolean);
    if (parts.length === 0) return "P";
    if (parts.length === 1) return parts[0].charAt(0).toUpperCase();
    return (parts[0].charAt(0) + parts[parts.length - 1].charAt(0)).toUpperCase();
};

export default class DoctorQueuePage extends Component {
    constructor(doctor, onOpenConversation) {
        super();
        this.doctor = doctor ?? {};
        this.onOpenConversation = onOpenConversation;

        this.loading = true;
        this.loadingMore = false;
        this.archivingAll = false;
        this.actionLoadingId = null;
        this.messageLoadingId = null;

        this.errorMessage = "";
        this.successMessage = "";

        this.tabs = {
            pending:   { bookings: [], page: 0, hasMore: true, totalCount: 0, loading: true, loadingMore: false },
            confirmed: { bookings: [], page: 0, hasMore: true, totalCount: 0, loading: true, loadingMore: false },
            completed: { bookings: [], page: 0, hasMore: true, totalCount: 0, loading: true, loadingMore: false },
        };
        this.searchTerm = "";
        this._searchDebounceTimer = null;

        this.activeTab = "pending";

        this.expandedBookingId = null;
        this.expandedAction = null; // 'confirm' | 'suggest' | 'decline' | 'clinical_notes'
        this.draft = { date: "", note: "" };

        // Tracks structured draft notes for each booking
        this.clinicalNotesMap = {};
        this.draftSaveTimers = {};
        this.draftSaving = {};
    }

    async afterMount() {
        await this.loadBookings(this.activeTab, { reset: true });
        
        ["pending", "confirmed", "completed"]
            .filter(tab => tab !== this.activeTab)
            .forEach(tab => this.loadBookings(tab, { reset: true }));
    }

    // ---------- Data loading ----------

    async loadBookings(tab, { reset = false } = {}) {
        const state = this.tabs[tab];
    
        if (reset) {
            state.loading = true;
            state.page = 0;
            state.bookings = [];
            state.hasMore = true;
        } else {
            state.loadingMore = true;
        }
        this.errorMessage = "";
        this.update();
    
        try {
            const nextPage = state.page + 1;
            const params = new URLSearchParams({
                page: nextPage,
                limit: PAGE_LIMIT,
                status: tab,
            });
            if (this.searchTerm.trim()) params.set("search", this.searchTerm.trim());
    
            const res = await api.get(`/bookings?${params.toString()}`);
            const payload = res.data || res;
            const rows = payload.rows || payload.data || payload.items || [];
            const total = payload.total ?? payload.count ?? rows.length;
    
            state.bookings = reset ? rows : [...state.bookings, ...rows];
            state.totalCount = total;
            state.page = nextPage;
            state.hasMore = state.bookings.length < total;
        } catch (error) {
            console.error(`Failed to load ${tab} bookings:`, error);
            this.errorMessage = error.message || "Failed to load appointment queue.";
        } finally {
            state.loading = false;
            state.loadingMore = false;
            this.update();
        }
    }
    moveBookingBetweenTabs(updatedBooking, fromTab, toTab) {
        const from = this.tabs[fromTab];
        const to = this.tabs[toTab];
    
        from.bookings = from.bookings.filter(b => b.id !== updatedBooking.id);
        from.totalCount = Math.max(0, from.totalCount - 1);
    
        const destinationAlreadyLoaded = to.bookings.length > 0 || !to.hasMore;
        if (destinationAlreadyLoaded) {
            to.bookings = [updatedBooking, ...to.bookings];
        }
        to.totalCount += 1;
    }
    replaceBookingInList(updatedBooking) {
        if (!updatedBooking?.id) return;
        const state = this.tabs[this.activeTab];
        state.bookings = state.bookings.map(b =>
            b.id === updatedBooking.id ? { ...b, ...updatedBooking } : b
        );
    }
    
    removeBookingFromList(bookingId) {
        const state = this.tabs[this.activeTab];
        state.bookings = state.bookings.filter(b => b.id !== bookingId);
        state.totalCount = Math.max(0, state.totalCount - 1);
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
    
            this.moveBookingBetweenTabs(updated, "pending", "confirmed");
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
    
            this.replaceBookingInList(updated); // still pending group, just updated fields
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
    
            this.removeBookingFromList(updated.id); // cancelled has no tab — just gone
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
            await api.post("/consultations", { booking_id: booking.id });
    
            this.moveBookingBetweenTabs({ ...booking, status: "completed" }, "confirmed", "completed");
            this.successMessage = `Consultation completed for ${booking.patient_name}.`;
            this.closeActionForm();
        } catch (error) {
            console.error(error);
            this.errorMessage = error.message || "Failed to complete consultation.";
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
            const res = await api.patch(`/bookings/${booking.id}/status`, { status: "completed" });
            const updated = res.data || res;
    
            this.moveBookingBetweenTabs(updated, "confirmed", "completed");
            this.successMessage = `Marked appointment with ${booking.patient_name} as completed.`;
        } catch (error) {
            console.error("Failed to mark booking completed:", error);
            this.errorMessage = error.message || "Failed to mark appointment as completed.";
        } finally {
            this.actionLoadingId = null;
            this.update();
        }
    }
    async handleMessagePatient(booking) {
        this.messageLoadingId = booking.id;
        this.errorMessage = "";
        this.successMessage = "";
        this.update();

        try {
            const res = await api.post(`/chat/bookings/${booking.id}/initiate`);
            const conversation = res.data || res;

            if (typeof this.onOpenConversation === "function") {
                this.onOpenConversation(conversation);
            } else {
                this.successMessage = `Conversation started with ${booking.patient_name}.`;
            }
        } catch (error) {
            console.error("Failed to start conversation:", error);
            this.errorMessage = error.message || "Failed to open conversation.";
        } finally {
            this.messageLoadingId = null;
            this.update();
        }
    }
    handleStartCall(booking) {
        new VideoCallRoom(booking.id, this.doctor, booking.consultation_type, () => {
            this.update();
        }).mount("#video-call-overlay-root");
    }

    async handleArchive(booking) {
        this.actionLoadingId = booking.id;
        this.errorMessage = "";
        this.successMessage = "";
        this.update();
    
        try {
            await api.patch(`/bookings/${booking.id}/archive`, {});
            this.removeBookingFromList(booking.id); // active tab is "completed" when this fires
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
        const state = this.tabs.completed;
        if (state.bookings.length === 0) return;
    
        this.archivingAll = true;
        this.errorMessage = "";
        this.successMessage = "";
        this.update();
    
        try {
            const res = await api.patch("/bookings/archive-completed", { all: true });
            const result = res.data || res;
    
            const archivedCount = result.archived_count ?? state.bookings.length;
            state.bookings = [];
            state.totalCount = Math.max(0, state.totalCount - archivedCount);
            this.successMessage = `Archived ${archivedCount} completed appointment(s).`;
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
                );
                console.log("Draft response:", res);
                console.log("Draft response.data:", res.data);
                console.log("Draft response.data?.data:", res.data?.data);
                
                
                const draftData = res.data || res;
                
                this.clinicalNotesMap[bookingId] = {
                    raw_notes: draftData.raw_notes || "",
                    outcome_notes: draftData.outcome_notes || "",
                    plan_notes: draftData.plan_notes || "",
                    follow_up_notes: draftData.follow_up_notes || "",
                    follow_up_date: (draftData.follow_up_date || "").slice(0, 10),
                    medications: Array.isArray(draftData.medications) ? draftData.medications : []
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
            follow_up_notes: "",
            follow_up_date: "",
            medications: []
        };
    
        draft[field] = value;
        this.clinicalNotesMap[bookingId] = draft;
    
        this.scheduleDraftSave(bookingId);
    }

    addMedicationRow(bookingId) {
        const draft = this.clinicalNotesMap[bookingId] || {
            raw_notes: "",
            outcome_notes: "",
            plan_notes: "",
            follow_up_notes: "",
            follow_up_date: "",
            medications: []
        };

        draft.medications = [
            ...(draft.medications || []),
            { medication: "", dose: "", frequency: "", duration: "", instructions: "" }
        ];
        this.clinicalNotesMap[bookingId] = draft;
        this.update();
    }

    updateMedicationField(bookingId, index, field, value) {
        const draft = this.clinicalNotesMap[bookingId];
        if (!draft || !draft.medications?.[index]) return;

        draft.medications[index] = { ...draft.medications[index], [field]: value };
        this.clinicalNotesMap[bookingId] = draft;

        this.scheduleDraftSave(bookingId);
    }

    removeMedicationRow(bookingId, index) {
        const draft = this.clinicalNotesMap[bookingId];
        if (!draft) return;

        draft.medications = (draft.medications || []).filter((_, i) => i !== index);
        this.clinicalNotesMap[bookingId] = draft;

        this.scheduleDraftSave(bookingId);
        this.update();
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
        this.update(); // reflect typing in the input immediately
    
        clearTimeout(this._searchDebounceTimer);
        this._searchDebounceTimer = setTimeout(() => {
            // Search only needs to hit the tab currently in view.
            this.loadBookings(this.activeTab, { reset: true });
        }, 350);
    }

    // ---------- Derived data ----------

    getActiveTabBookings() {
        return [...this.tabs[this.activeTab].bookings]
            .sort((a, b) => new Date(a.booking_date) - new Date(b.booking_date));
    }
    
    getTabCount(tab) {
        return this.tabs[tab].totalCount;
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
            } else if (label === "Symptoms") {
                // Split comma-separated symptoms into separate tags without adding a label prefix
                value.split(",").forEach(sym => {
                    const trimmed = sym.trim();
                    if (trimmed) tags.push({ label: null, value: trimmed });
                });
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
            this.tabs[this.activeTab].loading
                ? this.renderSkeleton()
                : this.renderContent()
        );
    }
    
    renderSkeleton() {
        return h(
            "div",
            { "aria-busy": "true", "aria-label": "Loading appointment queue" },
            ...[0, 1, 2].map(() =>
                h(
                    "div",
                    { class: "dashboard-card booking-card" },
                    h(
                        "div",
                        { class: "booking-card__head" },
                        h("div", { class: "skeleton skeleton--circle" }),
                        h(
                            "div",
                            { class: "booking-card__who" },
                            h("div", { class: "skeleton skeleton--line-sm" }),
                            h("div", { class: "skeleton skeleton--line-sm skeleton--short" })
                        )
                    ),
                    h("div", { class: "skeleton skeleton--line" })
                )
            )
        );
    }
    renderHeader() {
        const pending = this.getTabCount("pending");
        const confirmed = this.getTabCount("confirmed");
    
        return h(
            "section",
            { class: "dashboard-header" },
            h("p", { class: "dashboard-greeting" }, "Doctor Queue"),
            h("h1", { class: "dashboard-title" }, "Appointment Queue"),
            h(
                "p",
                { class: "dashboard-subtitle" },
                "Review, confirm, and manage appointments booked by your patients."
            ),
            h(
                "div",
                { class: "dashboard-hero-meta" },
                h("span", { class: `hero-chip ${pending > 0 ? "hero-chip--warning" : ""}` },
                    h("span", { class: "hero-chip__dot" }), `${pending} pending`),
                h("span", { class: `hero-chip ${confirmed > 0 ? "hero-chip--success" : ""}` },
                    h("span", { class: "hero-chip__dot" }), `${confirmed} confirmed`)
            )
        );
    }

    renderAlerts() {
        const alerts = [];
        if (this.errorMessage) {
            alerts.push(
                h("div", { class: "q-alert q-alert--error", role: "alert" },
                    icon(QI.alert, 18),
                    h("span", {}, this.errorMessage))
            );
        }
        if (this.successMessage) {
            alerts.push(
                h("div", { class: "q-alert q-alert--success", role: "status" },
                    icon(QI.check, 18),
                    h("span", {}, this.successMessage))
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
            { class: "queue-controls" },
            h(
                "div",
                { class: "queue-search" },
                icon(QI.search, 18),
                h("input", {
                    type: "text",
                    class: "queue-search__input",
                    placeholder: "Search by patient name...",
                    "aria-label": "Search by patient name",
                    value: this.searchTerm,
                    oninput: e => this.setSearchTerm(e.target.value),
                })
            ),
            this.activeTab === "completed" && this.getTabCount("completed") > 0
                ? h(
                      "button",
                      {
                          type: "button",
                          class: "btn btn-outline queue-archive-all",
                          disabled: this.archivingAll,
                          onclick: () => this.handleArchiveAllCompleted(),
                      },
                      this.archivingAll ? "Archiving..." : "Archive all completed"
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
            { class: "seg-tabs", role: "tablist" },
            tabs.map(tab => {
                const active = this.activeTab === tab.key;
                return h(
                    "button",
                    {
                        type: "button",
                        role: "tab",
                        "aria-selected": String(active),
                        class: `seg-tab${active ? " seg-tab--active" : ""}`,
                        onclick: () => this.setTab(tab.key),
                    },
                    h("span", {}, tab.label),
                    h("span", { class: "seg-tab__count" }, String(this.getTabCount(tab.key)))
                );
            })
        );
    }

    renderList() {
        const filtered = this.getActiveTabBookings();

        if (filtered.length === 0) {
            return h(
                "div",
                { class: "dashboard-card queue-empty" },
                h("span", { class: "queue-empty__icon" }, icon(QI.calendar, 22)),
                h(
                    "p",
                    { class: "queue-empty__title" },
                    this.searchTerm ? "No matches" : `No ${this.activeTab} appointments`
                ),
                h(
                    "p",
                    { class: "queue-empty__text" },
                    this.searchTerm
                        ? `Nothing matches "${this.searchTerm}".`
                        : "New appointments will appear here."
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
        const tone = STATUS_TONES[booking.status] || "info";
        const name = booking.patient_name || "Unknown Patient";
    
        return h(
            "div",
            { class: "dashboard-card service-item-card booking-card" },
            h(
                "div",
                { class: "booking-card__head" },
                h("div", { class: "booking-card__avatar" }, getInitials(name)),
                h(
                    "div",
                    { class: "booking-card__who" },
                    h("h3", { class: "booking-card__name" }, name),
                    h("p", { class: "booking-card__email" }, booking.patient_email || "")
                ),
                h("span", { class: `status-chip status-chip--${tone}` }, statusLabel)
            ),
            h(
                "div",
                { class: "booking-card__details" },
                h(
                    "div",
                    { class: "booking-detail" },
                    h("span", { class: "booking-detail__icon" }, icon(QI.calendar, 16)),
                    h(
                        "div",
                        {},
                        h("span", { class: "booking-detail__label" }, "Requested"),
                        h("span", { class: "booking-detail__value" }, this.formatDateTime(booking.booking_date))
                    )
                ),
                h(
                    "div",
                    { class: "booking-detail" },
                    h("span", { class: "booking-detail__icon" }, icon(QI.service, 16)),
                    h(
                        "div",
                        {},
                        h("span", { class: "booking-detail__label" }, "Consultation"),
                        h(
                            "span",
                            { class: "booking-detail__value" },
                            `${booking.consultation_service_name || "General"} · ${this.formatCurrency(booking.consultation_fee_amount)}`
                        )
                    )
                )
            ),
            this.renderReasonSection(booking),
            this.renderCardActions(booking, isProcessing),
            CONFIRMED_STATUSES.includes(booking.status) && booking.payment_status !== "paid"
                ? h(
                      "p",
                      { class: "booking-card__note" },
                      icon(QI.lock, 14),
                      h("span", {}, "Messaging, clinical notes and call unlock once the patient completes payment.")
                  )
                : null,
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
            { class: "booking-reason" },
            type ? h("span", { class: "booking-reason__type" }, type) : null,
            tags.length > 0
                ? h(
                      "div",
                      { class: "booking-reason__tags" },
                      tags.map(tag =>
                          h("span", { class: "booking-reason__tag" },
                              tag.label ? `${tag.label}: ${tag.value}` : tag.value)
                      )
                  )
                : null,
            notes ? h("p", { class: "booking-reason__notes" }, notes) : null
        );
    }
    renderCardActions(booking, isProcessing) {
        const buttons = [];

        const btnStyle = "";

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
            const isMessaging = this.messageLoadingId === booking.id;
            const isPaid = booking.payment_status === "paid";
            const isCallType = booking.consultation_type === "video_consultation" || booking.consultation_type === "voice_consultation";
            const callLabel = booking.consultation_type === "voice_consultation" ? "Voice Call" : "Video Call";

            buttons.push(
                h(
                    "button",
                    {
                        class: "btn btn-outline",
                        style: btnStyle,
                        disabled: isProcessing || isMessaging || !isPaid,
                        title: isPaid ? undefined : "Available once the patient completes payment",
                        onclick: () => this.handleMessagePatient(booking),
                    },
                    isMessaging ? "Opening..." : "Message"
                ),
                h(
                    "button",
                    {
                        class: "btn btn-outline",
                        style: btnStyle,
                        disabled: isProcessing || !isPaid,
                        title: isPaid ? undefined : "Available once the patient completes payment",
                        onclick: () => this.openActionForm(booking.id, "clinical_notes"),
                    },
                    "Clinical Notes"
                ),
                isCallType
                    ? h(
                          "button",
                          {
                              class: "btn btn-primary",
                              style: btnStyle,
                              disabled: isProcessing || !isPaid,
                              title: isPaid ? undefined : "Available once the patient completes payment",
                              onclick: () => this.handleStartCall(booking),
                          },
                          isPaid ? `Start ${callLabel}` : callLabel
                      )
                    : null
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

        return h("div", { class: "card-actions" }, buttons);
    }
    
    
    renderActionForm(booking, isProcessing) {
        const action = this.expandedAction;
    
        const fieldLabelStyle = "display: block; margin-bottom: 5px; font-size: 0.76rem; font-weight: 600; color: var(--color-text, #1e293b);";
        const fieldInputStyle = "padding: 0.5rem; border: 1.5px solid var(--color-line); border-radius: 6px; width: 100%; font-size: 0.88rem; box-sizing: border-box;";
    
        // 1. Render Clinical Notes view
        if (action === "clinical_notes") {
            const draft = this.clinicalNotesMap[booking.id] || {
                raw_notes: "",
                outcome_notes: "",
                plan_notes: "",
                follow_up_notes: "",
                follow_up_date: ""
            };
    
            const isSaving = !!this.draftSaving[booking.id];
    
            return h(
                "div",
                {
                    style: "margin-top: var(--space-3); padding: 0.85rem; background: rgba(2,132,199,0.04); border-radius: 8px;",
                },
                h("p", {
                    class: "dashboard-muted",
                    style: "font-size: 0.72rem; margin-bottom: 10px; font-style: italic;"
                }, "Outcome, Plan, and Follow-up notes are automatically visible to the patient."),
            
                h("label", { style: fieldLabelStyle }, "Raw Notes"),
                h("p", {
                    style: "font-size: 0.7rem; color: #b45309; margin: -2px 0 6px;"
                }, "Private — only visible to you. Not shared with the patient."),
                h("textarea", {
                    class: "autogrow-textarea",
                    rows: 3,
                    value: draft.raw_notes,
                    style: `${fieldInputStyle} font-family: inherit; resize: none; overflow: hidden;`,
                    oninput: e => {
                        this.setClinicalField(booking.id, "raw_notes", e.target.value);
                        autoGrow(e.target);
                    }
                }),
            
                h("label", { style: fieldLabelStyle }, "Outcome"),
                h("textarea", {
                    class: "autogrow-textarea",
                    rows: 2,
                    value: draft.outcome_notes,
                    style: `${fieldInputStyle} font-family: inherit; resize: none; overflow: hidden;`,
                    oninput: e => {
                        this.setClinicalField(booking.id, "outcome_notes", e.target.value);
                        autoGrow(e.target);
                    }
                }),
            
                h("label", { style: fieldLabelStyle }, "Plan"),
                h("textarea", {
                    class: "autogrow-textarea",
                    rows: 2,
                    value: draft.plan_notes,
                    style: `${fieldInputStyle} font-family: inherit; resize: none; overflow: hidden;`,
                    oninput: e => {
                        this.setClinicalField(booking.id, "plan_notes", e.target.value);
                        autoGrow(e.target);
                    }
                }),

                this.renderPrescriptionSection(booking, draft),
            
                h("label", { style: fieldLabelStyle }, "Follow-up"),
                h("textarea", {
                    class: "autogrow-textarea",
                    rows: 2,
                    value: draft.follow_up_notes,
                    style: `${fieldInputStyle} font-family: inherit; resize: none; overflow: hidden;`,
                    oninput: e => {
                        this.setClinicalField(booking.id, "follow_up_notes", e.target.value);
                        autoGrow(e.target);
                    }
                }),
                
                h("label", { style: fieldLabelStyle }, "Follow-up Date"),
                h("input", {
                    type: "date",
                    value: draft.follow_up_date || "",
                    style: fieldInputStyle,
                    onchange: e => this.setClinicalField(booking.id, "follow_up_date", e.target.value),
                }),
    
                h(
                    "p",
                    { class: "dashboard-muted", style: "margin-top:8px; font-size:0.75rem;" },
                    isSaving ? "Saving draft..." : "Draft saves automatically"
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
    renderPrescriptionSection(booking, draft) {
        const medications = draft.medications || [];
        const rowInputStyle = "padding: 0.4rem 0.5rem; border: 1px solid var(--color-line); border-radius: 5px; width: 100%; font-size: 0.82rem; box-sizing: border-box;";

        return h(
            "div",
            { style: "margin: 4px 0 10px; padding: 0.7rem; background: rgba(2,132,199,0.03); border: 1px dashed var(--color-line); border-radius: 6px;" },
            h(
                "div",
                { style: "display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px;" },
                h("span", { style: "font-size: 0.74rem; font-weight: 600; color: var(--color-text, #1e293b);" }, "Prescription"),
                h(
                    "button",
                    {
                        class: "btn btn-outline",
                        style: "padding: 0.25rem 0.6rem; font-size: 0.72rem; border-radius: 5px;",
                        onclick: () => this.addMedicationRow(booking.id),
                    },
                    "+ Add medication"
                )
            ),
            medications.length === 0
                ? h("p", { class: "dashboard-muted", style: "margin: 0; font-size: 0.76rem;" }, "No medications added.")
                : medications.map((med, index) => this.renderMedicationRow(booking, index, med, rowInputStyle))
        );
    }

    renderMedicationRow(booking, index, med, rowInputStyle) {
        return h(
            "div",
            {
                style: "display: flex; flex-direction: column; gap: 6px; padding: 8px; margin-bottom: 8px; background: #fff; border: 1px solid var(--color-line); border-radius: 6px;",
            },
            h(
                "div",
                { style: "display: flex; gap: 6px; align-items: center;" },
                h("input", {
                    type: "text",
                    placeholder: "Medication name",
                    value: med.medication,
                    style: `${rowInputStyle} flex: 1; font-weight: 600;`,
                    oninput: e => this.updateMedicationField(booking.id, index, "medication", e.target.value),
                }),
                h(
                    "button",
                    {
                        style: "padding: 0.3rem 0.5rem; font-size: 0.7rem; border-radius: 5px; border: none; background: transparent; color: #ef4444; cursor: pointer; flex-shrink: 0;",
                        onclick: () => this.removeMedicationRow(booking.id, index),
                    },
                    "Remove"
                )
            ),
            // Changed grid-template-columns from '1fr 1fr 1fr' to '1fr' to stack items vertically
            h(
                "div",
                { style: "display: grid; grid-template-columns: 1fr; gap: 6px;" },
                h("input", {
                    type: "text",
                    placeholder: "Dose (e.g. 500mg)",
                    value: med.dose,
                    style: rowInputStyle,
                    oninput: e => this.updateMedicationField(booking.id, index, "dose", e.target.value),
                }),
                h("input", {
                    type: "text",
                    placeholder: "Frequency (e.g. 3x/day)",
                    value: med.frequency,
                    style: rowInputStyle,
                    oninput: e => this.updateMedicationField(booking.id, index, "frequency", e.target.value),
                }),
                h("input", {
                    type: "text",
                    placeholder: "Duration (e.g. 5 days)",
                    value: med.duration,
                    style: rowInputStyle,
                    oninput: e => this.updateMedicationField(booking.id, index, "duration", e.target.value),
                })
            ),
            h("input", {
                type: "text",
                placeholder: "Instructions (optional — e.g. take with food)",
                value: med.instructions,
                style: rowInputStyle,
                oninput: e => this.updateMedicationField(booking.id, index, "instructions", e.target.value),
            })
        );
    }

    renderLoadMore() {
        const state = this.tabs[this.activeTab];
        if (!state.hasMore) return null;
        return h("div", { class: "text-center", style: "margin-top: var(--space-2);" },
            h("button", {
                class: "btn btn-outline",
                style: "padding: 0.35rem 0.8rem; font-size: 0.75rem; border-radius: 5px;",
                disabled: state.loadingMore,
                onclick: () => this.loadBookings(this.activeTab, { reset: false }),
            }, state.loadingMore ? "Loading..." : "Load More")
        );
    }

    update() {
        if (!this.el) return;
        const newTree = this.render();
        this.el.replaceChildren(...(Array.isArray(newTree) ? newTree : [newTree]).flat());
        this.el.querySelectorAll(".autogrow-textarea").forEach(autoGrow);
    }
}
