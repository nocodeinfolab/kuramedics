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
                bank_code: this.bankForm.bank_code,
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

        if (field === "bank_code") {
            const match = this.banks.find(b => b.code === value);
            this.bankForm.bank_name = match?.name || "";
        }
    }

    async handleSaveBankDetails(e) {
        e.preventDefault();
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
                : this.renderContent()
        );
    }

    renderHeader() {
        return h(
            "section",
            { class: "dashboard-header" },
            h(
                "button",
                {
                    class: "btn btn-outline",
                    style: "margin-bottom: var(--space-3); color: var(--color-white); border-color: rgba(255,255,255,0.4);",
                    onclick: () => this.onBack()
                },
                "← Back to Settings"
            ),
            h("h1", { class: "dashboard-title" }, "Finance"),
            h(
                "p",
                { class: "dashboard-subtitle" },
                "Track your earnings, manage your payout account, and review past transactions."
            )
        );
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
                        "select",
                        {
                            value: this.bankForm.bank_code,
                            required: true,
                            onchange: (e) => this.setBankField("bank_code", e.target.value),
                            style: "padding: 0.6rem 0.7rem; border: 1px solid var(--color-line); border-radius: 6px; width: 100%; font-size: 0.9rem;",
                        },
                        h("option", { value: "" }, "Select your bank..."),
                        this.banks.map(bank => h("option", { value: bank.code }, bank.name))
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
