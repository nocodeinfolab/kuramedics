import { Component } from "../../core/component.js";
import { h } from "../../utils/dom.js";
import api from "../../services/api.js";

const STATUS_LABELS = {
    requested: "Pending",
    approved: "Approved",
    declined: "Declined",
    withdrawn: "Withdrawn",
};

const STATUS_COLORS = {
    requested: { bg: "#fef3c7", fg: "#92400e" },
    approved:  { bg: "#d1fae5", fg: "#065f46" },
    declined:  { bg: "#fee2e2", fg: "#991b1b" },
    withdrawn: { bg: "#e5e7eb", fg: "#4b5563" },
};

export default class AdminRefundRequests extends Component {
    constructor(onPendingCountChanged) {
        super();
        this.onPendingCountChanged =
            typeof onPendingCountChanged === "function" ? onPendingCountChanged : () => {};

        this.loading = true;
        this.errorMessage = "";
        this.statusFilter = "requested";
        this.items = [];
        this.actionLoadingId = null;
        this._notes = {}; // { [requestId]: text } — admin note field values
    }

    async afterMount() {
        await this.load();
    }

    async load() {
        this.loading = true;
        this.errorMessage = "";
        this.update();

        try {
            const res = await api.get(`/admin/refund-requests?status=${this.statusFilter}`);
            const payload = res.data || res;
            this.items = payload.items || [];

            // Only reflect count when looking at the pending queue
            if (this.statusFilter === "requested") {
                this.onPendingCountChanged(this.items.length);
            }
        } catch (err) {
            console.error("Failed to load refund requests:", err);
            this.errorMessage = err.message || "Failed to load refund requests.";
        } finally {
            this.loading = false;
            this.update();
        }
    }

    setStatusFilter(status) {
        if (this.statusFilter === status) return;
        this.statusFilter = status;
        this.load();
    }

    async resolve(item, decision) {
        const note = (this._notes[item.id] || "").trim();

        if (decision === "decline" && !note) {
            this.errorMessage = "Please enter a reason before declining — the patient will see it.";
            this.update();
            return;
        }

        this.actionLoadingId = item.id;
        this.errorMessage = "";
        this.update();

        try {
            // Resolve endpoint is keyed on booking_id, not request id.
            await api.post(`/bookings/${item.booking_id}/refund-request/resolve`, {
                decision,
                admin_note: note || undefined,
            });
            delete this._notes[item.id];
            await this.load();
        } catch (err) {
            console.error("Failed to resolve refund request:", err);
            this.errorMessage = err.message || "Failed to resolve request.";
        } finally {
            this.actionLoadingId = null;
            this.update();
        }
    }

    // ---------- Render ----------

    render() {
        return h(
            "div",
            { class: "admin-section" },
            h("header", { class: "admin-header" },
                h("h1", { class: "admin-header__title" }, "Refund Requests"),
                h("p", { class: "admin-muted" },
                    "Review patient cancellation requests. Approving cancels the booking and marks it refunded — complete the Paystack refund before clicking Approve.")
            ),
            this.renderTabs(),
            this.renderError(),
            this.loading ? h("p", { class: "admin-muted" }, "Loading…") : this.renderList()
        );
    }

    renderTabs() {
        const tabs = [
            { id: "requested", label: "Pending" },
            { id: "approved",  label: "Approved" },
            { id: "declined",  label: "Declined" },
            { id: "all",       label: "All" },
        ];
        return h("div", { style: "display: flex; gap: 8px; margin-bottom: 16px; flex-wrap: wrap;" },
            tabs.map(tab =>
                h("button", {
                    type: "button",
                    class: this.statusFilter === tab.id ? "btn btn-primary" : "btn btn-secondary",
                    onclick: () => this.setStatusFilter(tab.id),
                }, tab.label)
            )
        );
    }

    renderError() {
        if (!this.errorMessage) return null;
        return h("div", {
            style: "padding: 12px 14px; margin-bottom: 16px; border-radius: 8px; background: #fef2f2; border: 1px solid #fecaca; color: #991b1b; font-size: 0.85rem;",
        }, this.errorMessage);
    }

    renderList() {
        if (this.items.length === 0) {
            const label = STATUS_LABELS[this.statusFilter] || this.statusFilter;
            return h("p", { class: "admin-muted" }, `No ${label.toLowerCase()} requests.`);
        }

        return h("div", { style: "display: flex; flex-direction: column; gap: 12px;" },
            this.items.map(item => this.renderCard(item))
        );
    }

    renderCard(item) {
        const isActioning = this.actionLoadingId === item.id;
        const isPending = item.status === "requested";
        const colors = STATUS_COLORS[item.status] || STATUS_COLORS.withdrawn;
        const statusLabel = STATUS_LABELS[item.status] || item.status;

        return h(
            "article",
            {
                class: "admin-card",
                style: "padding: 16px; border: 1px solid var(--color-line, #e5e7eb); border-radius: 10px; background: #fff;",
            },
            // Header
            h("div", { style: "display: flex; justify-content: space-between; align-items: flex-start; gap: 12px;" },
                h("div", null,
                    h("p", { style: "margin: 0; font-weight: 600; font-size: 0.95rem;" },
                        item.patient_name || "Patient"),
                    h("p", { class: "admin-muted", style: "margin: 4px 0 0; font-size: 0.82rem;" },
                        `with ${item.doctor_name || "Doctor"} · ${this.formatDate(item.booking_date)}`)
                ),
                h("span", {
                    style: `display: inline-block; padding: 3px 10px; border-radius: 12px; font-size: 0.72rem; font-weight: 600; white-space: nowrap; background: ${colors.bg}; color: ${colors.fg};`,
                }, statusLabel)
            ),

            // Body
            h("div", { style: "margin-top: 12px; display: flex; flex-direction: column; gap: 6px;" },
                h("p", { style: "margin: 0; font-size: 1.1rem; font-weight: 700;" },
                    this.formatCurrency(item.amount, item.currency)),
                h("p", { style: "margin: 0; font-size: 0.86rem; color: var(--color-ink); line-height: 1.4;" },
                    `"${item.reason}"`),
                h("p", { class: "admin-muted", style: "margin: 0; font-size: 0.75rem;" },
                    `Ref: ${item.provider_reference}`)
            ),

            // Actions (pending) or note (resolved)
            isPending
                ? this.renderActions(item, isActioning)
                : item.admin_note
                    ? h("p", { class: "admin-muted", style: "margin: 12px 0 0; font-size: 0.8rem; padding-top: 12px; border-top: 1px solid var(--color-line, #e5e7eb);" },
                        `Admin note: ${item.admin_note}`)
                    : null
        );
    }

    renderActions(item, isActioning) {
        return h("div", { style: "margin-top: 14px; padding-top: 14px; border-top: 1px solid var(--color-line, #e5e7eb);" },
            h("textarea", {
                placeholder: "Add a note — optional for approve, required for decline (patient will see it).",
                rows: "2",
                disabled: isActioning,
                value: this._notes[item.id] || "",
                oninput: (e) => { this._notes[item.id] = e.target.value; },
                style: "width: 100%; box-sizing: border-box; padding: 8px 10px; border: 1px solid var(--color-line, #e5e7eb); border-radius: 6px; font-size: 0.85rem; font-family: inherit; resize: vertical; min-height: 60px;",
            }),
            h("div", { style: "display: flex; gap: 8px; margin-top: 10px; justify-content: flex-end;" },
                h("button", {
                    type: "button",
                    class: "btn btn-secondary",
                    disabled: isActioning,
                    onclick: () => this.resolve(item, "decline"),
                }, isActioning ? "Working…" : "Decline"),
                h("button", {
                    type: "button",
                    class: "btn btn-primary",
                    disabled: isActioning,
                    onclick: () => this.resolve(item, "approve"),
                }, isActioning ? "Working…" : "Approve & mark refunded")
            )
        );
    }

    // ---------- Helpers ----------

    formatCurrency(amount, currency = "NGN") {
        return new Intl.NumberFormat("en-NG", {
            style: "currency",
            currency,
            maximumFractionDigits: 0,
        }).format(Number(amount || 0));
    }

    formatDate(dateString) {
        if (!dateString) return "—";
        return new Date(dateString).toLocaleString(undefined, {
            day: "numeric", month: "short", year: "numeric",
            hour: "2-digit", minute: "2-digit",
        });
    }

    update() {
        if (!this.el) return;
        const newTree = this.render();
        this.el.replaceChildren(...(Array.isArray(newTree) ? newTree : [newTree]).flat());
    }
}
