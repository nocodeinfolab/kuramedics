// js/components/doctor/settings/DoctorSubscriptionPage.js

import { Component } from "../../../core/component.js";
import { h } from "../../../utils/dom.js";
import api from "../../../services/api.js";

export default class DoctorSubscriptionPage extends Component {
    constructor(doctor, onBack) {
        super();
        this.doctor = doctor ?? {};
        this.onBack = typeof onBack === "function" ? onBack : () => {};

        this.loading = true;
        this.saving = false;
        this.renewingPlanCode = null;
        this.errorMessage = "";
        this.successMessage = "";

        this.summary = null;
    }

    async afterMount() {
        await this.loadSubscriptionSummary();
    }

    async loadSubscriptionSummary() {
        this.loading = true;
        this.errorMessage = "";
        this.updatePage();

        try {
            const res = await api.get("/subscription/me");
            this.summary = res.data || res;
        } catch (error) {
            console.error("Failed to load subscription details:", error);
            this.errorMessage = error.message || "Failed to load subscription details.";
        } finally {
            this.loading = false;
            this.updatePage();
        }
    }

    async toggleAutoRenew(enabled) {
        this.saving = true;
        this.errorMessage = "";
        this.successMessage = "";
        this.updatePage();

        try {
            const res = await api.patch("/subscription/preferences", {
                auto_renew_enabled: enabled
            });
            this.summary = res.data || res;
            this.successMessage = `Auto-renew ${enabled ? "enabled" : "disabled"} successfully.`;
        } catch (error) {
            console.error("Failed to update billing preferences:", error);
            this.errorMessage = error.message || "Failed to update preferences.";
        } finally {
            this.saving = false;
            this.updatePage();
        }
    }

    async handleRenew(planCode) {
        this.renewingPlanCode = planCode;
        this.errorMessage = "";
        this.successMessage = "";
        this.updatePage();

        try {
            const res = await api.post("/subscription/renew", {
                plan_code: planCode,
                plan_interval: "monthly"
            });

            const data = res.data || res;

            if (data.checkout_url) {
                // Redirect to Paystack or Gateway payment checkout
                window.location.href = data.checkout_url;
            } else {
                this.successMessage = "Renewal request initialized successfully.";
                await this.loadSubscriptionSummary();
            }
        } catch (error) {
            console.error("Subscription renewal failed:", error);
            this.errorMessage = error.message || "Failed to initialize subscription renewal.";
        } finally {
            this.renewingPlanCode = null;
            this.updatePage();
        }
    }

    formatCurrency(amount) {
        return new Intl.NumberFormat("en-NG", {
            style: "currency",
            currency: "NGN",
            maximumFractionDigits: 0
        }).format(amount || 0);
    }

    formatDate(dateString) {
        if (!dateString) return "N/A";
        return new Date(dateString).toLocaleDateString(undefined, {
            year: "numeric",
            month: "short",
            day: "numeric"
        });
    }

    render() {
        return h(
            "div",
            { class: "doctor-settings-subpage" },
            
            // Header
            h(
                "div",
                { style: "display: flex; align-items: center; gap: var(--space-3); margin-bottom: var(--space-4);" },
                h(
                    "button",
                    {
                        class: "btn btn-outline",
                        style: "padding: var(--space-1) var(--space-3);",
                        onclick: () => this.onBack()
                    },
                    "← Back"
                ),
                h("h2", { style: "margin: 0;" }, "Subscription & Billing")
            ),

            // Main Content Area
            h(
                "div",
                { id: "subscription-container" },
                this.loading
                    ? h("p", { class: "dashboard-muted" }, "Loading subscription details...")
                    : this.renderContent()
            )
        );
    }

    renderContent() {
        return h(
            "div",
            { style: "display: flex; flex-direction: column; gap: var(--space-4);" },

            // Banners for Feedback
            this.errorMessage
                ? h("div", { class: "alert alert-error", style: "color: red; padding: 8px 12px; background: #fee2e2; border-radius: 6px;" }, this.errorMessage)
                : null,
            this.successMessage
                ? h("div", { class: "alert alert-success", style: "color: green; padding: 8px 12px; background: #dcfce7; border-radius: 6px;" }, this.successMessage)
                : null,

            // Active Plan Status Overview
            this.renderCurrentPlanCard(),

            // Preferences Card (Auto-Renew Toggle)
            this.renderPreferencesCard(),

            // Plan Selector & Comparison
            this.renderAvailablePlansCard(),

            // Billing / Renewal History Table
            this.renderRenewalHistoryCard()
        );
    }

    renderCurrentPlanCard() {
        const sub = this.summary || {};
        const isTrial = sub.trial_active;
        const statusLabel = (sub.status || "active").toUpperCase();

        return h(
            "div",
            { class: "dashboard-card", style: "border-left: 4px solid var(--color-primary, #0284c7);" },
            h("h3", { style: "margin-top: 0;" }, "Current Subscription"),
            h(
                "div",
                { style: "display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: var(--space-3);" },
                h(
                    "div",
                    {},
                    h("span", { class: "dashboard-muted" }, "Plan Tier"),
                    h("p", { style: "font-weight: 600; font-size: 1.2rem; margin: 4px 0 0;" }, sub.plan_name || "Starter")
                ),
                h(
                    "div",
                    {},
                    h("span", { class: "dashboard-muted" }, "Price & Commission"),
                    h("p", { style: "font-weight: 600; font-size: 1.2rem; margin: 4px 0 0;" }, `${this.formatCurrency(sub.monthly_fee)} / mo (${sub.commission_label || "5%"} fee)`)
                ),
                h(
                    "div",
                    {},
                    h("span", { class: "dashboard-muted" }, "Status"),
                    h("p", { style: "font-weight: 600; margin: 4px 0 0;" }, isTrial ? "Free Trial" : statusLabel)
                ),
                h(
                    "div",
                    {},
                    h("span", { class: "dashboard-muted" }, sub.trial_active ? "Trial Ends On" : "Next Billing Date"),
                    h("p", { style: "font-weight: 600; margin: 4px 0 0;" }, this.formatDate(sub.trial_active ? sub.trial_ends_at : sub.next_billing_date))
                )
            ),
            sub.restriction_message
                ? h("p", { class: "dashboard-muted", style: "margin-top: 12px; font-size: 0.9rem; color: #d97706;" }, sub.restriction_message)
                : null
        );
    }

    renderPreferencesCard() {
        const autoRenew = Boolean(this.summary?.auto_renew_enabled);

        return h(
            "div",
            { class: "dashboard-card" },
            h("h3", { style: "margin-top: 0;" }, "Billing Preferences"),
            h(
                "div",
                { style: "display: flex; align-items: center; justify-content: space-between; gap: var(--space-3);" },
                h(
                    "div",
                    {},
                    h("h4", { style: "margin: 0 0 4px;" }, "Automatic Plan Renewal"),
                    h(
                        "p",
                        { class: "dashboard-muted", style: "margin: 0; font-size: 0.875rem;" },
                        "Automatically renew your subscription using your saved authorization code when due."
                    )
                ),
                h(
                    "button",
                    {
                        class: `btn ${autoRenew ? "btn-outline" : "btn-primary"}`,
                        disabled: this.saving,
                        onclick: () => this.toggleAutoRenew(!autoRenew)
                    },
                    this.saving ? "Updating..." : autoRenew ? "Disable Auto-Renew" : "Enable Auto-Renew"
                )
            )
        );
    }

    renderAvailablePlansCard() {
        const plans = this.summary?.available_plans || [];
        const currentPlanCode = this.summary?.plan_code || "starter";

        return h(
            "div",
            { class: "dashboard-card" },
            h("h3", { style: "margin-top: 0;" }, "Available Plans & Upgrades"),
            h(
                "div",
                { style: "display: grid; grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); gap: var(--space-3); margin-top: 16px;" },
                plans.map(plan => {
                    const isCurrent = plan.code === currentPlanCode;
                    const isProcessing = this.renewingPlanCode === plan.code;

                    return h(
                        "div",
                        {
                            style: `
                                border: 1px solid ${isCurrent ? "var(--color-primary, #0284c7)" : "#e2e8f0"};
                                border-radius: 8px;
                                padding: 16px;
                                background: ${isCurrent ? "rgba(2, 132, 199, 0.03)" : "#ffffff"};
                                display: flex;
                                flex-direction: column;
                                justify-content: space-between;
                            `
                        },
                        h(
                            "div",
                            {},
                            h("h4", { style: "margin: 0 0 8px; font-size: 1.1rem;" }, plan.label),
                            h("p", { style: "font-size: 1.25rem; font-weight: 700; margin: 0 0 4px;" }, `${this.formatCurrency(plan.monthlyFee)}/mo`),
                            h("p", { class: "dashboard-muted", style: "margin: 0 0 12px; font-size: 0.85rem;" }, `Platform Commission: ${plan.commissionLabel}`),
                            h("p", { style: "font-size: 0.9rem; color: #475569; margin-bottom: 16px;" }, plan.description)
                        ),
                        h(
                            "button",
                            {
                                class: `btn ${isCurrent ? "btn-outline" : "btn-primary"}`,
                                disabled: isProcessing,
                                onclick: () => this.handleRenew(plan.code)
                            },
                            isProcessing ? "Initializing..." : isCurrent ? "Renew Current Plan" : `Upgrade to ${plan.label}`
                        )
                    );
                })
            )
        );
    }

    renderRenewalHistoryCard() {
        const renewals = this.summary?.renewals || [];

        return h(
            "div",
            { class: "dashboard-card" },
            h("h3", { style: "margin-top: 0;" }, "Payment History"),
            renewals.length === 0
                ? h("p", { class: "dashboard-muted" }, "No subscription payment transactions found.")
                : h(
                      "table",
                      { style: "width: 100%; border-collapse: collapse; text-align: left; font-size: 0.9rem;" },
                      h(
                          "thead",
                          {},
                          h(
                              "tr",
                              { style: "border-bottom: 2px solid #e2e8f0; color: #64748b;" },
                              h("th", { style: "padding: 8px;" }, "Reference"),
                              h("th", { style: "padding: 8px;" }, "Plan"),
                              h("th", { style: "padding: 8px;" }, "Amount"),
                              h("th", { style: "padding: 8px;" }, "Status"),
                              h("th", { style: "padding: 8px;" }, "Date")
                          )
                      ),
                      h(
                          "tbody",
                          {},
                          renewals.map(item =>
                              h(
                                  "tr",
                                  { style: "border-bottom: 1px solid #f1f5f9;" },
                                  h("td", { style: "padding: 8px; font-family: monospace;" }, item.reference),
                                  h("td", { style: "padding: 8px;" }, (item.plan_code || "starter").toUpperCase()),
                                  h("td", { style: "padding: 8px;" }, `${this.formatCurrency(item.amount)}`),
                                  h("td", { style: "padding: 8px; text-transform: capitalize;" }, item.status),
                                  h("td", { style: "padding: 8px;" }, this.formatDate(item.created_at))
                              )
                          )
                      )
                  )
        );
    }

    updatePage() {
        if (!this.el) return;
        const container = this.el.querySelector("#subscription-container");
        if (!container) return;

        container.replaceChildren(
            this.loading ? h("p", { class: "dashboard-muted" }, "Loading subscription details...") : this.renderContent()
        );
    }
}
