import { Component } from "../../../core/component.js";
import { h } from "../../../utils/dom.js";
import api from "../../../services/api.js";

export default class DoctorFinancePage extends Component {
    constructor(doctor, onBack) {
        super();
        this.doctor = doctor ?? {};
        this.onBack = typeof onBack === "function" ? onBack : () => {};

        this.loading = true;
        this.summary = null;
        this.banks = [];
        this.errorMessage = "";
        this.successMessage = "";

        this.bankForm = { bank_code: "", bank_name: "", account_number: "", account_name: "" };
        this.savingBank = false;
        
        this.bankPickerOpen = false;
        this.bankSearchQuery = "";
    }

    async afterMount() {
        await Promise.all([this.loadSummary(), this.loadBanks()]);
    }

    async loadSummary() {
        this.loading = true;
        this.errorMessage = "";
        this.update();

        try {
            const res = await api.get("/finance/summary");
            this.summary = res.data || res;

            this.bankForm = {
                bank_code: this.summary.payoutAccount?.bank_code || this.bankForm.bank_code,
                bank_name: this.summary.payoutAccount?.bank_name || "",
                account_number: this.summary.payoutAccount?.account_number || "",
                account_name: this.summary.payoutAccount?.account_name || "",
            };
        } catch (error) {
            console.error("Failed to load finance summary:", error);
            this.errorMessage = error.message || "Failed to load finance details.";
        } finally {
            this.loading = false;
            this.update();
        }
    }

    async loadBanks() {
        try {
            const res = await api.get("/finance/banks");
            this.banks = res.data || res;

            if (this.summary?.payoutAccount?.bank_name) {
                const match = this.banks.find(b => b.name === this.summary.payoutAccount.bank_name);
                if (match) this.bankForm.bank_code = match.code;
            }
            this.update();
        } catch (error) {
            console.error("Failed to load bank list:", error);
        }
    }

    setBankField(field, value) {
        this.bankForm = { ...this.bankForm, [field]: value };
    }
    
    openBankPicker() {
        this.bankPickerOpen = true;
        this.bankSearchQuery = "";
        this.update();
    
        // Focus the search input after DOM is updated (works in Capacitor because
        // the tap that opened the picker still counts as the user gesture).
        setTimeout(() => {
            const input = this.el?.querySelector('[data-bank-search]');
            if (input) input.focus();
        }, 50);
    }
    
    closeBankPicker() {
        if (!this.bankPickerOpen) return;
        this.bankPickerOpen = false;
        this.bankSearchQuery = "";
        this.update();
    }
    
    handleBankSearchInput(value) {
        this.bankSearchQuery = value;
        // Do NOT call this.update() — it would destroy the input and close the
        // keyboard on iOS. Instead, refresh only the list container.
        this.refreshBankList();
    }
    
    getFilteredBanks() {
        const q = this.bankSearchQuery.trim().toLowerCase();
        if (!q) return this.banks;
        return this.banks.filter(b => b.name.toLowerCase().includes(q));
    }
    
    refreshBankList() {
        const listEl = this.el?.querySelector('[data-bank-list]');
        if (!listEl) return;
        const filtered = this.getFilteredBanks();
        listEl.replaceChildren(...this.renderBankListItems(filtered));
    }
    
    selectBank(bank) {
        this.bankForm = {
            ...this.bankForm,
            bank_code: bank.code,
            bank_name: bank.name,
        };
        this.bankPickerOpen = false;
        this.bankSearchQuery = "";
        this.update();
    }

    async handleSaveBankDetails(e) {
        e.preventDefault();
    
        if (!this.bankForm.bank_code) {
            this.errorMessage = "Please select a bank.";
            this.successMessage = "";
            this.update();
            return;
        }
    
        this.savingBank = true;
        this.errorMessage = "";
        this.successMessage = "";
        this.update();

        try {
            const res = await api.put("/finance/bank-details", this.bankForm);
            const data = res.data || res;
            this.successMessage = "Bank details saved successfully.";
            if (data.payoutAccount) {
                this.summary = { ...this.summary, payoutAccount: data.payoutAccount };
            }
        } catch (error) {
            console.error("Failed to save bank details:", error);
            this.errorMessage = error.message || "Failed to save bank details.";
        } finally {
            this.savingBank = false;
            this.update();
        }
    }

    formatCurrency(amount) {
        return new Intl.NumberFormat("en-NG", { style: "currency", currency: "NGN", maximumFractionDigits: 0 }).format(amount || 0);
    }

    formatDate(dateString) {
        if (!dateString) return "N/A";
        return new Date(dateString).toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" });
    }

    render() {
        return h(
            "div",
            { class: "dashboard-page" },
            this.renderHeader(),
            this.renderAlerts(),
            this.loading
                ? h("div", { class: "dashboard-card text-center py-4" }, h("p", { class: "dashboard-muted" }, "Loading finance details..."))
                : this.renderContent(),
            this.bankPickerOpen ? this.renderBankPicker() : null
        );
    }
    
    renderBankPicker() {
        return h(
            "div",
            {
                "data-bank-picker": "true",
                onpointerdown: (e) => {
                    if (e.target === e.currentTarget) this.closeBankPicker();
                },
                style: "position: fixed; inset: 0; z-index: 1000; background: rgba(0,0,0,0.4); display: flex; align-items: flex-end;",
            },
            h(
                "div",
                {
                    style: "background: #fff; width: 100%; max-height: 85vh; border-radius: 16px 16px 0 0; display: flex; flex-direction: column; padding-bottom: env(safe-area-inset-bottom, 0);",
                },
                // Header
                h(
                    "div",
                    { style: "padding: 16px 16px 8px; display: flex; justify-content: space-between; align-items: center;" },
                    h("h3", { style: "margin: 0; font-size: 1.05rem;" }, "Select Bank"),
                    h(
                        "button",
                        {
                            type: "button",
                            onpointerdown: (e) => { e.preventDefault(); this.closeBankPicker(); },
                            style: "background: none; border: none; font-size: 0.9rem; color: var(--color-ink-faint); padding: 6px 10px; cursor: pointer;",
                        },
                        "Close"
                    )
                ),
                // Search input
                h(
                    "div",
                    { style: "padding: 8px 16px;" },
                    h("input", {
                        "data-bank-search": "true",
                        type: "text",
                        placeholder: "Search banks...",
                        inputmode: "search",
                        autocomplete: "off",
                        value: "",
                        oninput: (e) => this.handleBankSearchInput(e.target.value),
                        style: "width: 100%; padding: 0.7rem 0.8rem; border: 1px solid var(--color-line); border-radius: 10px; font-size: 0.95rem; box-sizing: border-box;",
                    })
                ),
                // List
                h(
                    "div",
                    {
                        "data-bank-list": "true",
                        style: "flex: 1; overflow-y: auto; padding: 4px 0 8px; -webkit-overflow-scrolling: touch; overscroll-behavior: contain;",
                    },
                    ...this.renderBankListItems(this.getFilteredBanks())
                )
            )
        );
    }
    
    renderBankListItems(filtered) {
        if (filtered.length === 0) {
            return [
                h("p", { style: "padding: 24px 16px; text-align: center; color: var(--color-ink-faint); font-size: 0.9rem;" },
                    "No banks match your search")
            ];
        }
    
        return filtered.map(bank =>
            h(
                "div",
                {
                    onpointerdown: (e) => { e.preventDefault(); this.selectBank(bank); },
                    style: `padding: 14px 16px; border-bottom: 1px solid var(--color-line); cursor: pointer; font-size: 0.95rem; user-select: none; -webkit-tap-highlight-color: transparent; touch-action: manipulation;${
                        this.bankForm.bank_code === bank.code
                            ? " background: var(--color-bg-muted, #f0f4f8); font-weight: 600;"
                            : ""
                    }`,
                },
                bank.name
            )
        );
    }

    renderHeader() {
        return h(
            "section",
            { class: "dashboard-header page-hero" },
    
            h(
                "button",
                {
                    type: "button",
                    class: "page-hero__back",
                    onclick: () => this.onBack()
                },
                this.renderChevronIcon(),
                h("span", {}, "Settings")
            ),
    
            h(
                "h1",
                { class: "page-hero__title" },
                "Finance"
            ),
    
            h(
                "p",
                { class: "page-hero__subtitle" },
                "Track your earnings, manage your payout account, and review past transactions."
            )
        );
    }
    renderChevronDownIcon() {
        const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
        svg.setAttribute("width", "14");
        svg.setAttribute("height", "14");
        svg.setAttribute("viewBox", "0 0 24 24");
        svg.setAttribute("fill", "none");
        svg.setAttribute("stroke", "currentColor");
        svg.setAttribute("stroke-width", "2");
        svg.setAttribute("stroke-linecap", "round");
        svg.setAttribute("stroke-linejoin", "round");
        const path = document.createElementNS("http://www.w3.org/2000/svg", "path");
        path.setAttribute("d", "M6 9l6 6 6-6");
        svg.appendChild(path);
        return svg;
    }
    renderChevronIcon() {
        const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
        svg.setAttribute("width", "14");
        svg.setAttribute("height", "14");
        svg.setAttribute("viewBox", "0 0 24 24");
        svg.setAttribute("fill", "none");
        svg.setAttribute("stroke", "currentColor");
        svg.setAttribute("stroke-width", "2.5");
        svg.setAttribute("stroke-linecap", "round");
        svg.setAttribute("stroke-linejoin", "round");
    
        const path = document.createElementNS("http://www.w3.org/2000/svg", "path");
        path.setAttribute("d", "M15 18l-6-6 6-6");
        svg.appendChild(path);
        return svg;
    }

    renderAlerts() {
        const alerts = [];
        if (this.errorMessage) alerts.push(h("div", { class: "dashboard-card", style: "border-left: 4px solid #ef4444;" }, h("p", { style: "color: #ef4444; margin: 0;" }, this.errorMessage)));
        if (this.successMessage) alerts.push(h("div", { class: "dashboard-card", style: "border-left: 4px solid #10b981;" }, h("p", { style: "color: #10b981; margin: 0;" }, this.successMessage)));
        return alerts;
    }

    renderContent() {
        return h(
            "div",
            { class: "services-list" },
            this.renderEarningsSummary(),
            this.renderPayoutAccount(),
            this.renderBankForm(),
            this.renderTransactions()
        );
    }

    renderEarningsSummary() {
        const earnings = this.summary?.earnings || {};
        const plan = this.summary?.plan || {};
        const growthPositive = earnings.monthGrowthPercent >= 0;

        return h(
            "div",
            { class: "dashboard-card" },
            h("h3", { style: "margin: 0 0 var(--space-3);" }, "Earnings"),
            h(
                "div",
                { class: "input-group" },
                h(
                    "div",
                    {},
                    h("span", { class: "dashboard-muted" }, "This Month"),
                    h("p", { style: "font-weight: 600; font-size: 1.3rem; margin: 4px 0 0;" }, this.formatCurrency(earnings.monthNetEarnings)),
                    h(
                        "p",
                        { style: `margin: 2px 0 0; font-size: 0.78rem; font-weight: 600; color: ${growthPositive ? "#10b981" : "#ef4444"};` },
                        `${growthPositive ? "▲" : "▼"} ${Math.abs(earnings.monthGrowthPercent || 0)}% vs last month`
                    )
                ),
                h(
                    "div",
                    {},
                    h("span", { class: "dashboard-muted" }, "Total Earnings"),
                    h("p", { style: "font-weight: 600; font-size: 1.3rem; margin: 4px 0 0;" }, this.formatCurrency(earnings.totalNetEarnings))
                )
            ),
            h(
                "p",
                { class: "dashboard-muted", style: "margin-top: var(--space-3); padding-top: var(--space-3); border-top: 1px solid var(--color-line); font-size: 0.82rem;" },
                `You're on the ${plan.name} plan — ${plan.commissionLabel || `${(plan.commissionRate * 100).toFixed(1)}%`} platform commission on each paid consultation.`
            )
        );
    }

    renderPayoutAccount() {
        const payout = this.summary?.payoutAccount || {};
        const statusMeta = {
            active: { label: "Payouts Active", color: "#10b981" },
            pending_verification: { label: "Awaiting Verification", color: "#f59e0b" },
            not_set_up: { label: "Not Set Up", color: "var(--color-ink-faint)" },
        }[payout.status] || { label: "Not Set Up", color: "var(--color-ink-faint)" };

        return h(
            "div",
            { class: "dashboard-card" },
            h(
                "div",
                { style: "display: flex; justify-content: space-between; align-items: center; gap: var(--space-3);" },
                h("h3", { style: "margin: 0;" }, "Payout Account"),
                h("span", { class: "dashboard-badge", style: `background: ${statusMeta.color};` }, statusMeta.label)
            ),
            payout.has_bank_details
                ? h(
                      "div",
                      { style: "margin-top: var(--space-3);" },
                      h("p", { style: "margin: 0; font-weight: 600;" }, payout.bank_name),
                      h("p", { class: "dashboard-muted", style: "margin: 4px 0 0;" }, `${payout.account_name} · ${payout.account_number}`)
                  )
                : h("p", { class: "dashboard-muted", style: "margin-top: var(--space-3);" }, "Add your bank details below so we can pay you directly for consultations."),
            payout.status === "pending_verification"
                ? h("p", { class: "dashboard-muted", style: "margin-top: var(--space-2); font-size: 0.8rem;" }, "Your payout account activates automatically once your profile verification is approved.")
                : null
        );
    }

    renderBankForm() {
        return h(
            "div",
            { class: "dashboard-card" },
            h("h3", { style: "margin: 0 0 var(--space-3);" }, "Update Bank Details"),
            h(
                "form",
                { onsubmit: (e) => this.handleSaveBankDetails(e), style: "display: flex; flex-direction: column; gap: 12px;" },
                h(
                    "div",
                    {},
                    h("label", { style: "display: block; margin-bottom: 5px; font-size: 0.82rem; font-weight: 600;" }, "Bank"),
                    h(
                        "button",
                        {
                            type: "button",
                            onclick: () => this.openBankPicker(),
                            style: `width: 100%; text-align: left; padding: 0.6rem 0.7rem; border: 1px solid var(--color-line); border-radius: 6px; font-size: 0.9rem; background: #fff; cursor: pointer; color: ${this.bankForm.bank_name ? "inherit" : "var(--color-ink-faint)"}; display: flex; justify-content: space-between; align-items: center; gap: 8px;`,
                        },
                        h("span", { style: "overflow: hidden; text-overflow: ellipsis; white-space: nowrap;" },
                            this.bankForm.bank_name || "Select your bank..."),
                        this.renderChevronDownIcon()
                    )
                ),
                h(
                    "div",
                    {},
                    h("label", { style: "display: block; margin-bottom: 5px; font-size: 0.82rem; font-weight: 600;" }, "Account Number"),
                    h("input", {
                        type: "text",
                        required: true,
                        maxlength: "10",
                        value: this.bankForm.account_number,
                        oninput: (e) => this.setBankField("account_number", e.target.value),
                        style: "padding: 0.6rem 0.7rem; border: 1px solid var(--color-line); border-radius: 6px; width: 100%; font-size: 0.9rem;",
                    })
                ),
                h(
                    "div",
                    {},
                    h("label", { style: "display: block; margin-bottom: 5px; font-size: 0.82rem; font-weight: 600;" }, "Account Name"),
                    h("input", {
                        type: "text",
                        required: true,
                        value: this.bankForm.account_name,
                        oninput: (e) => this.setBankField("account_name", e.target.value),
                        style: "padding: 0.6rem 0.7rem; border: 1px solid var(--color-line); border-radius: 6px; width: 100%; font-size: 0.9rem;",
                    })
                ),
                h(
                    "button",
                    {
                        type: "submit",
                        class: "btn btn-primary",
                        style: "padding: 0.65rem 1rem; font-size: 0.9rem; border-radius: 8px; margin-top: 4px;",
                        disabled: this.savingBank,
                    },
                    this.savingBank ? "Saving..." : "Save Bank Details"
                )
            )
        );
    }

    renderTransactions() {
        const transactions = this.summary?.transactions || [];

        return h(
            "div",
            { class: "dashboard-card" },
            h("h3", { style: "margin: 0 0 var(--space-3);" }, "Recent Transactions"),
            transactions.length === 0
                ? h("p", { class: "dashboard-muted" }, "No paid consultations yet.")
                : h(
                      "div",
                      { style: "display: flex; flex-direction: column; gap: 10px;" },
                      transactions.map(tx => this.renderTransactionRow(tx))
                  )
        );
    }

    renderTransactionRow(tx) {
        return h(
            "div",
            { style: "padding: 0.75rem 0.85rem; background: var(--color-bg-muted, #f8fafc); border-radius: 8px; display: flex; flex-direction: column; gap: 4px;" },
            h(
                "div",
                { style: "display: flex; justify-content: space-between; align-items: center; gap: 10px;" },
                h("p", { style: "margin: 0; font-weight: 600; font-size: 0.88rem;" }, tx.patient_name || "Patient"),
                h("p", { style: "margin: 0; font-weight: 600; font-size: 0.9rem; color: #10b981;" }, `+${this.formatCurrency(tx.net_amount)}`)
            ),
            h(
                "p",
                { class: "dashboard-muted", style: "margin: 0; font-size: 0.75rem;" },
                `${this.formatDate(tx.paid_at)} · Gross ${this.formatCurrency(tx.amount)} · Commission ${this.formatCurrency(tx.commission)}`
            )
        );
    }

    update() {
        if (!this.el) return;
        const newTree = this.render();
        this.el.replaceChildren(...(Array.isArray(newTree) ? newTree : [newTree]).flat());
    }
}
