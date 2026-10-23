// js/components/patient/PatientCare.js

import { Component } from "../../core/component.js";
import { h } from "../../utils/dom.js";
import api from "../../services/api.js";
import { reconcilePendingPayment, hasPendingPaymentReference } from "../../services/deepLinkHandler.js";

const icon = (paths, size = 18) => h("svg", { viewBox: "0 0 24 24", fill: "none", width: String(size), height: String(size), "aria-hidden": "true" }, ...paths.map(d => h("path", { d, stroke: "currentColor", "stroke-width": "1.8", "stroke-linecap": "round", "stroke-linejoin": "round" })));


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
    constructor(patient, onOpenConversation, initialTab = "upcoming") {
        super();
        this.patient = patient ?? {};
        this.onOpenConversation = onOpenConversation;

        this.loading = true;
        this.loadingMore = false;
        this.errorMessage = "";

        this.bookings = [];
        this.recordsByBookingId = {};
        this.page = 0;
        this.hasMore = true;
        this.totalCount = 0;

        this.tabCounts = { upcoming: 0, confirmed: 0, completed: 0 };

        this.activeTab = initialTab;
        this.expandedBookingId = null;
        this.messageLoadingId = null;

        this._lastFetchedAt = null;
        this._loadRequestId = 0;
        
        this.refundModalBookingId = null;
        this.refundReason = "";
        this.refundSubmitting = false;
        this.refundError = "";
        this.openMenuBookingId = null;
    }

    async afterMount() {
        // If the app was cold-started from a payment deeplink and the user
        // was already logged in (or just logged in), reconcile the pending
        // reference BEFORE loading the list — otherwise we'd show stale data.
        if (hasPendingPaymentReference()) {
            await reconcilePendingPayment().catch(() => {});
        }
    
        await Promise.all([
            this.loadTabCounts(),
            this.loadBookingsForTab(this.activeTab, { reset: true }),
        ]);
    }
    // ---------- Data loading ----------

    async loadData({ silent = false } = {}) {
        await Promise.all([
            this.loadTabCounts(),
            this.loadBookingsForTab(this.activeTab, { reset: true, silent }),
        ]);
    }

    async loadTabCounts() {
        try {
            const res = await api.get("/bookings/counts");
            this.tabCounts = res.data || res;
            this.update();
        } catch (error) {
            console.error("Failed to load booking counts:", error);
            // Non-critical — tab labels just won't show counts. List still works.
        }
    }

    getBackendStatusKey(tab) {
        // Maps this component's tab names to the backend's STATUS_GROUPS keys
        if (tab === "upcoming") return "pending";
        if (tab === "confirmed") return "confirmed";
        if (tab === "completed") return "completed";
        return "pending";
    }

    async loadBookingsForTab(tab, { reset = false } = {}) {
        const requestId = ++this._loadRequestId;
    
        if (reset) {
            this.loading = true;
            this.page = 0;
            this.bookings = [];
            this.hasMore = true;
            this.errorMessage = "";
        } else {
            this.loadingMore = true;
        }
        this.update();
    
        try {
            const statusKey = this.getBackendStatusKey(tab);
            const nextPage = this.page + 1;
            const params = new URLSearchParams({
                status: statusKey, // "pending", "confirmed", or "completed" — matches STATUS_GROUPS key
                page: String(nextPage),
                limit: "20",
            });
    
            const res = await api.get(`/bookings?${params.toString()}`);
    
            if (requestId !== this._loadRequestId) return;
    
            const payload = res.data || res;
            const rows = payload.items || payload.rows || payload.data || [];
            const pagination = payload.pagination || {};
    
            this.bookings = reset ? rows : [...this.bookings, ...rows];
            this.totalCount = pagination.totalItems ?? rows.length;
            this.page = pagination.currentPage ?? nextPage;
            this.hasMore = pagination.hasNextPage ?? (this.bookings.length < this.totalCount);
    
            if (tab === "completed" && rows.length > 0) {
                await this.loadRecordsForBookings(rows.map(b => b.id));
            }
    
            this._lastFetchedAt = Date.now();
        } catch (error) {
            if (requestId !== this._loadRequestId) return;
            console.error("Failed to load bookings:", error);
            this.errorMessage = error.message || "Failed to load your appointments.";
        } finally {
            if (requestId === this._loadRequestId) {
                this.loading = false;
                this.loadingMore = false;
                this.update();
            }
        }
    }
    async loadRecordsForBookings(bookingIds) {
        try {
            const params = new URLSearchParams({ booking_ids: bookingIds.join(",") });
            const res = await api.get(`/consultations/my-records?${params.toString()}`);
            const payload = res.data || res;
            const records = Array.isArray(payload) ? payload : payload.rows || payload.data || [];

            records.forEach(record => {
                this.recordsByBookingId[record.booking_id] = record;
            });
        } catch (error) {
            console.error("Failed to load consultation records:", error);
            // Non-critical for now — notes just show "not loaded" state per card
        }
    }

    isStale(ttlMs = 60_000) {
        return !this._lastFetchedAt || Date.now() - this._lastFetchedAt > ttlMs;
    }

    // ---------- Interaction ----------

    setTab(tab) {
        if (this.activeTab === tab) return;
        this.activeTab = tab;
        this.expandedBookingId = null;
        this.loadBookingsForTab(tab, { reset: true });
    }

    loadMore() {
        this.loadBookingsForTab(this.activeTab, { reset: false });
    }

    toggleBooking(bookingId) {
        this.expandedBookingId = this.expandedBookingId === bookingId ? null : bookingId;
        this.update();
    }
    async handleMessageDoctor(booking) {
        this.messageLoadingId = booking.id;
        this.errorMessage = "";
        this.update();

        try {
            const res = await api.post(`/chat/bookings/${booking.id}/initiate`);
            const conversation = res.data || res;

            if (typeof this.onOpenConversation === "function") {
                this.onOpenConversation(conversation);
            }
        } catch (error) {
            console.error("Failed to start conversation:", error);
            this.errorMessage = error.message || "Failed to open conversation.";
        } finally {
            this.messageLoadingId = null;
            this.update();
        }
    }
    async acceptSuggestedTimeAndPay(booking) {
        this.payingBookingId = booking.id;
        this.errorMessage = "";
        this.update();
    
        try {
            const res = await api.patch(`/bookings/${booking.id}/accept-suggested-time`);
            const updatedBooking = res.data || res;
    
            await this.handlePayNow(updatedBooking);
        } catch (error) {
            console.error("Failed to accept suggested time:", error);
            this.errorMessage = error.message || "Failed to accept the suggested time. Please try again.";
            this.payingBookingId = null;
            this.update();
        }
    }
    
    async handlePayNow(booking) {
        this.payingBookingId = booking.id;
        this.errorMessage = "";
        this.update();
    
        try {
            const isNative = window.Capacitor?.isNativePlatform?.();
    
            const res = await api.post("/payments", {
                booking_id: booking.id,
                return_path: isNative ? "native" : "/#/patient/dashboard",
            });
            const payment = res.data || res;
    
            if (!payment.checkout_url) {
                throw new Error("No checkout URL was returned for this payment.");
            }
    
            const isMock = payment.gateway_response?.mock === true;
    
            if (isNative && isMock) {
                // Mock mode: no real checkout page to browse to — verify immediately.
                await this.confirmPayment(payment.transaction_id);
                return;
            }
    
            if (isNative) {
                await this.openCheckoutNative(payment.checkout_url, payment.transaction_id);
            } else {
                window.location.href = payment.checkout_url;
            }
        } catch (error) {
            console.error("Failed to start payment:", error);
            this.errorMessage = error.message || "Failed to start payment. Please try again.";
            this.payingBookingId = null;
            this.update();
        }
    }
    
    async openCheckoutNative(checkoutUrl, reference) {
        const { Browser, App } = window.Capacitor.Plugins;
    
        const urlListener = await App.addListener("appUrlOpen", async (event) => {
            if (!event.url.startsWith("yeroscare://payment-callback")) return;
            urlListener.remove();
            finishListener.remove();
            await Browser.close();
            await this.confirmPayment(reference);
        });
    
        const finishListener = await Browser.addListener("browserFinished", async () => {
            urlListener.remove();
            finishListener.remove();
    
            if (!this.payingBookingId) return;
    
            this.payingBookingId = null;
            this.update();
    
            // Give the deep link a moment to win the race, then verify anyway.
            await new Promise((r) => setTimeout(r, 1500));
            await this.confirmPayment(reference);
        });
    
        await Browser.open({ url: checkoutUrl, presentationStyle: "popover" });
    }
    
    async confirmPayment(reference) {
        try {
            await api.get(`/payments/verify/${reference}`);
        } catch (error) {
            console.error("Failed to verify payment:", error);
            this.errorMessage = error.message || "Payment may have succeeded, but verification failed. Pull to refresh.";
        } finally {
            this.payingBookingId = null;
            await this.loadData({ silent: true });
            this.update();
        }
    }

    toggleCardMenu(bookingId) {
        this.openMenuBookingId = this.openMenuBookingId === bookingId ? null : bookingId;
        this.update();
    }
    
    closeCardMenu() {
        if (this.openMenuBookingId) {
            this.openMenuBookingId = null;
            this.update();
        }
    }
    
    renderCardMenu(booking) {
        const isOpen = this.openMenuBookingId === booking.id;
    
        return h(
            "div",
            { class: "pc-card-menu" },
            h(
                "button",
                {
                    type: "button",
                    class: "pc-card-menu-trigger",
                    "aria-label": "More actions",
                    "aria-expanded": isOpen ? "true" : "false",
                    onclick: (e) => {
                        e.stopPropagation();
                        this.toggleCardMenu(booking.id);
                    },
                },
                h("span", { "aria-hidden": "true" }, "⋯")
            ),
            isOpen
                ? h("div", {
                      class: "pc-card-menu-backdrop",
                      onclick: (e) => {
                          e.stopPropagation();
                          this.closeCardMenu();
                      },
                  })
                : null,
            isOpen
                ? h(
                      "div",
                      { class: "pc-card-menu-dropdown" },
                      h(
                          "button",
                          {
                              type: "button",
                              class: "pc-card-menu-item",
                              onclick: (e) => {
                                  e.stopPropagation();
                                  this.closeCardMenu();
                                  this.openRefundModal(booking.id);
                              },
                          },
                          "Request cancellation"
                      )
                  )
                : null
        );
    }

    openRefundModal(bookingId) {
        this.refundModalBookingId = bookingId;
        this.refundReason = "";
        this.refundError = "";
        this.refundSubmitting = false;
        this.update();
    
        // Focus the textarea once the modal is in the DOM. The 50ms delay
        // is needed because update() replaces children synchronously and
        // browsers don't apply focus to elements inserted in the same tick.
        setTimeout(() => {
            this.el?.querySelector("#refund-reason")?.focus();
        }, 50);
    }
    
    closeRefundModal() {
        if (this.refundSubmitting) return; // don't let a slow network trap the button
        this.refundModalBookingId = null;
        this.refundReason = "";
        this.refundError = "";
        this.update();
    }
    
    async submitRefundRequest() {
        const reason = this.refundReason.trim();
        if (reason.length < 10) {
            this.refundError = "Please tell us why (at least 10 characters).";
            this.update();
            return;
        }
    
        this.refundSubmitting = true;
        this.refundError = "";
        this.update();
    
        try {
            await api.post(`/bookings/${this.refundModalBookingId}/refund-request`, { reason });
            this.refundModalBookingId = null;
            this.refundReason = "";
            this.refundSubmitting = false;
            // Don't call update() — loadData() will trigger it, and this way
            // the modal stays visible ("Submitting…") until the refresh begins.
            await this.loadData();
        } catch (err) {
            this.refundError = err.message || "Failed to submit request. Please try again.";
            this.refundSubmitting = false;
            this.update();
        }
    }
    
    async withdrawRefundRequest(bookingId) {
        if (this.refundSubmitting) return;
        if (!window.confirm("Withdraw your cancellation request? Your appointment will continue as scheduled.")) {
            return;
        }
        try {
            await api.post(`/bookings/${bookingId}/refund-request/withdraw`);
            await this.loadData();
        } catch (err) {
            this.errorMessage = err.message || "Failed to withdraw request.";
            this.update();
        }
    }
    
    async downloadPrescription(booking) {
        try {
            const blob = await api.getBlob(`/consultations/booking/${booking.id}/prescription-pdf`);
            const url = URL.createObjectURL(blob);

            const link = document.createElement("a");
            link.href = url;
            link.download = `prescription-${booking.id}.pdf`;
            document.body.appendChild(link);
            link.click();
            link.remove();

            URL.revokeObjectURL(url);
        } catch (error) {
            console.error("Failed to download prescription:", error);
            this.errorMessage = error.message || "Failed to download prescription.";
            this.update();
        }
    }

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
    formatShortDate(dateString) {
        if (!dateString) return "N/A";
        return new Date(dateString).toLocaleDateString(undefined, {
            year: "numeric",
            month: "short",
            day: "numeric",
        });
    }

    // ---------- Render ----------

    render() {
        const isFirstRender = !this._hasRenderedOnce;
        this._hasRenderedOnce = true;
    
        return h(
            "div",
            { class: "patient-care" },
            this.renderHeader(),
            h(
                "div",
                { class: `pc-body${isFirstRender ? " pc-body--enter" : ""}` },
                h("p", { class: "pc-intro" },
                    "Track your appointments and view your consultation notes."
                ),
                this.renderAlerts(),
                this.loading ? this.renderSkeleton() : this.renderContent()
            ),
            this.renderRefundModal()
        );
    }

    renderHeader() {
        return h(
            "section",
            { class: "dashboard-header patient-home" },
            h(
                "div",
                { class: "ph-hero" },
                h(
                    "div",
                    { class: "ph-hero__text" },
                    h("p", { class: "dashboard-greeting" }, "My Care"),
                    h("h1", { class: "dashboard-title" }, "Appointments & Records")
                )
            )
        );
    }

    renderSkeleton() {
        return h(
            "div",
            { class: "pc-skel-stack", "aria-busy": "true", "aria-label": "Loading your appointments" },
            ...[0, 1, 2].map(() =>
                h(
                    "div",
                    { class: "pc-card pc-card--skeleton" },
                    h(
                        "div",
                        { class: "pc-skel-head" },
                        h(
                            "div",
                            { class: "pc-skel-head-text" },
                            h("div", { class: "pc-skel pc-skel--line pc-skel--short" }),
                            h("div", { class: "pc-skel pc-skel--line pc-skel--tiny" })
                        ),
                        h("div", { class: "pc-skel pc-skel--chip" })
                    )
                )
            )
        );
    }
    renderSpinner() {
        return h("span", { class: "pc-spinner" });
    }

    renderAlerts() {
        if (!this.errorMessage) return null;
        return h(
            "div",
            { class: "pc-alert", role: "alert" },
            h(
                "div",
                { class: "pc-alert-icon" },
                icon(["M12 9v4", "M12 17h.01", "M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"], 18)
            ),
            h("p", { class: "pc-alert-text" }, this.errorMessage)
        );
    }
    renderContent() {
        return h(
            "div",
            { class: "pc-stack" },
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
            { class: "pc-tabs", role: "tablist" },
            tabs.map(tab =>
                h(
                    "button",
                    {
                        class: `pc-tab${this.activeTab === tab.key ? " pc-tab--active" : ""}`,
                        type: "button",
                        role: "tab",
                        "aria-selected": this.activeTab === tab.key ? "true" : "false",
                        onclick: () => this.setTab(tab.key),
                    },
                    h("span", { class: "pc-tab-label" }, tab.label),
                    h(
                        "span",
                        { class: "pc-tab-count" },
                        String(this.tabCounts[tab.key] ?? 0)
                    )
                )
            )
        );
    }

    renderList() {
        if (this.bookings.length === 0) {
            return h(
                "div",
                { class: "pc-empty" },
                h(
                    "div",
                    { class: "pc-empty-icon" },
                    icon(
                        [
                            "M8 2v4",
                            "M16 2v4",
                            "M3 10h18",
                            "M5 4h14a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2",
                        ],
                        22
                    )
                ),
                h(
                    "p",
                    { class: "pc-empty-title" },
                    `No ${this.activeTab} appointments`
                ),
                h(
                    "p",
                    { class: "pc-empty-text" },
                    this.activeTab === "completed"
                        ? "Your past consultations will appear here."
                        : "New appointments will appear here as they’re booked."
                )
            );
        }

        return h(
            "div",
            { class: "pc-list" },
            this.bookings.map(booking => this.renderBookingCard(booking)),
            this.renderLoadMore()
        );
    }

    renderLoadMore() {
        if (!this.hasMore || this.loading) return null;

        return h(
            "div",
            { class: "pc-load-more-wrap" },
            h(
                "button",
                {
                    class: "pc-load-more",
                    type: "button",
                    disabled: this.loadingMore,
                    onclick: () => this.loadMore(),
                },
                this.loadingMore ? h("span", { class: "pc-spinner pc-spinner--dark" }) : null,
                h("span", null, this.loadingMore ? "Loading…" : "Load more")
            )
        );
    }

    renderBookingCard(booking) {
        const isExpanded = this.expandedBookingId === booking.id;
        const isCompleted = COMPLETED_STATUSES.includes(booking.status);
        const isRescheduleRequested = booking.status === "reschedule_requested";
        const statusLabel = STATUS_LABELS[booking.status] || booking.status;

        const chipTone =
            booking.status === "confirmed" ? "success"
            : booking.status === "completed" ? "muted"
            : booking.status === "reschedule_requested" ? "violet"
            : booking.status === "pending_confirmation" ? "warning"
            : "info";

        return h(
            "article",
            {
                class: `pc-card${isCompleted ? " pc-card--tappable" : ""}${isExpanded ? " pc-card--expanded" : ""}`,
                onclick: isCompleted ? () => this.toggleBooking(booking.id) : null,
            },
            h(
                "div",
                { class: "pc-card-head" },
                h(
                    "div",
                    { class: "pc-card-identity" },
                    h(
                        "h3",
                        { class: "pc-card-name" },
                        booking.doctor_name || "Unknown Doctor"
                    ),
                    h(
                        "p",
                        { class: "pc-card-meta" },
                        `${booking.consultation_service_name || "General"} · ${this.formatDateTime(booking.booking_date)}`
                    )
                ),
                h(
                    "div",
                    { class: "pc-card-head-actions" },
                    h("span", { class: `pc-chip pc-chip--${chipTone}` }, statusLabel),
                    CONFIRMED_STATUSES.includes(booking.status) &&
                    booking.payment_status === "paid" &&
                    booking.refund_request_status !== "requested"
                        ? this.renderCardMenu(booking)
                        : null
                )
            ),

            isRescheduleRequested ? this.renderRescheduleComparison(booking) : null,
            CONFIRMED_STATUSES.includes(booking.status) ? this.renderConfirmedActions(booking) : null,

            isCompleted
                ? h(
                      "div",
                      { class: "pc-expand-hint" },
                      h(
                          "span",
                          null,
                          isExpanded ? "Hide notes" : "View notes"
                      ),
                      h(
                          "span",
                          { class: `pc-expand-chevron${isExpanded ? " pc-expand-chevron--open" : ""}` },
                          icon(["M6 9l6 6 6-6"], 16)
                      )
                  )
                : null,

            isCompleted && isExpanded ? this.renderConsultationNotes(booking) : null
        );
    }

    renderRefundPendingState(booking) {
        const submittedAt = booking.refund_requested_at
            ? new Date(booking.refund_requested_at).toLocaleDateString(undefined, {
                  day: "numeric",
                  month: "short",
              })
            : null;
    
        return h("div", { class: "pc-refund-pending" },
            h("div", { class: "pc-refund-pending__head" },
                h("span", { class: "pc-refund-pending__icon" },
                    icon(
                        ["M12 8v4", "M12 16h.01", "M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20"],
                        16
                    )
                ),
                h("div", { class: "pc-refund-pending__text" },
                    h("p", { class: "pc-refund-pending__title" }, "Cancellation under review"),
                    h("p", { class: "pc-refund-pending__meta" },
                        submittedAt ? `Submitted ${submittedAt} · ` : "",
                        "We'll respond within 48 hours."
                    )
                )
            ),
            h("button", {
                type: "button",
                class: "pc-refund-withdraw",
                onclick: (e) => {
                    e.stopPropagation();
                    this.withdrawRefundRequest(booking.id);
                }
            }, "Withdraw request")
        );
    }
    
    renderRefundModal() {
        if (!this.refundModalBookingId) return null;
    
        const closeOnBackdrop = (e) => {
            if (e.target === e.currentTarget && !this.refundSubmitting) {
                this.closeRefundModal();
            }
        };
    
        return h("div", { class: "pc-modal-backdrop", onclick: closeOnBackdrop },
            h("div", { class: "pc-modal", role: "dialog", "aria-modal": "true" },
                h("h3", { class: "pc-modal__title" }, "Cancel this appointment?"),
                h("p", { class: "pc-modal__body" },
                    "Your doctor has reserved this time for you. If approved, you'll be refunded to your original payment method and the appointment will be cancelled."
                ),
                h("p", { class: "pc-modal__body pc-modal__body--muted" },
                    "We'll respond within 48 hours."
                ),
                h("label", { class: "pc-modal__label", for: "refund-reason" },
                    "Tell us why (required)"
                ),
                h("textarea", {
                    id: "refund-reason",
                    class: "pc-modal__textarea",
                    rows: "4",
                    placeholder: "e.g. I found a doctor closer to my home",
                    value: this.refundReason,
                    disabled: this.refundSubmitting,
                    oninput: (e) => { this.refundReason = e.target.value; }
                }),
                this.refundError
                    ? h("p", { class: "pc-modal__error" }, this.refundError)
                    : null,
                h("div", { class: "pc-modal__actions" },
                    h("button", {
                        type: "button",
                        class: "pc-modal__btn pc-modal__btn--ghost",
                        disabled: this.refundSubmitting,
                        onclick: () => this.closeRefundModal()
                    }, "Keep appointment"),
                    h("button", {
                        type: "button",
                        class: "pc-modal__btn pc-modal__btn--primary",
                        disabled: this.refundSubmitting,
                        onclick: () => this.submitRefundRequest()
                    }, this.refundSubmitting ? "Submitting…" : "Submit request")
                )
            )
        );
    }

    renderConfirmedActions(booking) {
        const isPaid = booking.payment_status === "paid";
        const isMessaging = this.messageLoadingId === booking.id;
        const isPaying = this.payingBookingId === booking.id;
        
        if (booking.payment_status === "paid" && booking.refund_request_status === "requested") {
            return this.renderRefundPendingState(booking);
        }

        if (!isPaid) {
            return h(
                "div",
                { class: "pc-pay-box" },
                h(
                    "p",
                    { class: "pc-pay-text" },
                    "Your doctor has confirmed this appointment time. Complete payment to unlock messaging and start your consultation."
                ),
                h(
                    "button",
                    {
                        class: "pc-pay-btn",
                        type: "button",
                        disabled: isPaying,
                        onclick: () => this.handlePayNow(booking),
                    },
                    isPaying ? this.renderSpinner() : null,
                    h(
                        "span",
                        null,
                        isPaying
                            ? "Redirecting…"
                            : `Pay Now${booking.consultation_fee_amount ? ` · ₦${Number(booking.consultation_fee_amount).toLocaleString()}` : ""}`
                    )
                )
            );
        }

        const isVideoConsultation = booking.consultation_type === "video_consultation";
        const isVoiceConsultation = booking.consultation_type === "voice_consultation";
        const isCallConsultation = isVideoConsultation || isVoiceConsultation;

        return h(
            "div",
            { class: "pc-actions" },
            isCallConsultation
                ? h(
                      "p",
                      { class: "pc-action-note" },
                      `Your doctor will start the ${isVoiceConsultation ? "voice" : "video"} call at your scheduled time (${this.formatDateTime(booking.booking_date)}). You can message them beforehand with any questions.`
                  )
                : null,
            h(
                "div",
                { class: "pc-action-row" },
                h(
                    "button",
                    {
                        class: "pc-secondary-btn",
                        type: "button",
                        disabled: isMessaging,
                        onclick: () => this.handleMessageDoctor(booking),
                    },
                    icon(["M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"], 16),
                    h("span", null, isMessaging ? "Opening…" : "Message")
                )
            ) 
        );
    }
    renderRescheduleComparison(booking) {
        const isPaying = this.payingBookingId === booking.id;
        return h(
            "div",
            { class: "pc-reschedule" },
            h(
                "div",
                { class: "pc-reschedule-head" },
                h(
                    "div",
                    { class: "pc-reschedule-icon" },
                    icon(
                        [
                            "M12 8v4l3 2",
                            "M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20",
                        ],
                        16
                    )
                ),
                h("p", { class: "pc-reschedule-eyebrow" }, "New time suggested")
            ),

            booking.patient_requested_time
                ? h(
                      "p",
                      { class: "pc-reschedule-line" },
                      h("span", { class: "pc-reschedule-label" }, "You requested"),
                      h(
                          "span",
                          { class: "pc-reschedule-struck" },
                          this.formatDateTime(booking.patient_requested_time)
                      )
                  )
                : null,

            booking.doctor_suggested_time
                ? h(
                      "p",
                      { class: "pc-reschedule-line" },
                      h("span", { class: "pc-reschedule-label" }, "Doctor suggested"),
                      h(
                          "span",
                          { class: "pc-reschedule-strong" },
                          this.formatDateTime(booking.doctor_suggested_time)
                      )
                  )
                : null,

            booking.confirmation_note
                ? h("p", { class: "pc-reschedule-quote" }, `"${booking.confirmation_note}"`)
                : null,

            h(
                "button",
                {
                    class: "pc-accept-btn",
                    type: "button",
                    disabled: isPaying,
                    onclick: (e) => {
                        e.stopPropagation();
                        this.acceptSuggestedTimeAndPay(booking);
                    },
                },
                isPaying ? this.renderSpinner() : null,
                h("span", null, isPaying ? "Redirecting…" : "Accept time & Pay")
            )
        );
    }
    renderConsultationNotes(booking) {
        const record = this.recordsByBookingId[booking.id];

        if (!record) {
            return h(
                "div",
                {
                    class: "pc-notes",
                    onclick: e => e.stopPropagation(),
                },
                h(
                    "p",
                    { class: "pc-notes-empty" },
                    "No notes have been recorded for this consultation yet."
                )
            );
        }

        const sections = this.parseDoctorNotes(record.doctor_notes);
        const medications = Array.isArray(record.medications) ? record.medications : [];

        return h(
            "div",
            {
                class: "pc-notes",
                onclick: e => e.stopPropagation(),
            },

            record.follow_up_date
                ? h(
                      "div",
                      { class: "pc-followup" },
                      h(
                          "span",
                          { class: "pc-followup-icon" },
                          icon(
                              [
                                  "M8 2v4",
                                  "M16 2v4",
                                  "M3 10h18",
                                  "M5 4h14a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2",
                              ],
                              16
                          )
                      ),
                      h(
                          "span",
                          null,
                          `Follow-up recommended: ${this.formatShortDate(record.follow_up_date)}`
                      )
                  )
                : null,

            sections.map(section =>
                h(
                    "section",
                    { class: "pc-notes-section" },
                    h("h4", { class: "pc-notes-title" }, section.title),
                    this.splitParagraphs(section.body).map(paragraph =>
                        h("p", { class: "pc-notes-body" }, paragraph)
                    ),
                    section.title === "Plan" && medications.length > 0
                        ? this.renderMedicationsList(medications, booking)
                        : null
                )
            )
        );
    }

    renderMedicationsList(medications, booking) {
        return h(
            "div",
            { class: "pc-meds" },
            h(
                "div",
                { class: "pc-meds-head" },
                h("span", { class: "pc-meds-eyebrow" }, "Prescription"),
                h(
                    "button",
                    {
                        class: "pc-meds-download",
                        type: "button",
                        onclick: e => {
                            e.stopPropagation();
                            this.downloadPrescription(booking);
                        },
                    },
                    icon(
                        [
                            "M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4",
                            "M7 10l5 5 5-5",
                            "M12 15V3",
                        ],
                        14
                    ),
                    h("span", null, "Download")
                )
            ),
            medications.map(med => this.renderMedicationCard(med))
        );
    }

    renderMedicationCard(med) {
        const details = [med.dose, med.frequency, med.duration].filter(Boolean).join(" · ");

        return h(
            "div",
            { class: "pc-med" },
            h(
                "div",
                { class: "pc-med-head" },
                h("p", { class: "pc-med-name" }, med.medication || "Unnamed medication"),
                details ? h("p", { class: "pc-med-details" }, details) : null
            ),
            med.instructions
                ? h("p", { class: "pc-med-notes" }, med.instructions)
                : null
        );
    }

    update() {
        if (!this.el) return;
        const newTree = this.render();
        this.el.replaceChildren(...(Array.isArray(newTree) ? newTree : [newTree]).flat());
    }
}
