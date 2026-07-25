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
        this.update();

        try {
            const res = await api.get("/subscription/me");
            this.summary = res.data || res;
        } catch (error) {
            console.error("Failed to load subscription details:", error);
            this.errorMessage = error.message || "Failed to load subscription details.";
        } finally {
            this.loading = false;
            this.update();
        }
    }

    async toggleAutoRenew(enabled) {
        this.saving = true;
        this.errorMessage = "";
        this.successMessage = "";
        this.update();

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
            this.update();
        }
    }

    async handleRenew(planCode) {
        this.renewingPlanCode = planCode;
        this.errorMessage = "";
        this.successMessage = "";
        this.update();

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
            this.update();
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
            { class: "dashboard-page subscription-page" },
            this.renderHeader(),
            this.renderAlerts(),
            this.loading
                ? h("div", { class: "dashboard-card text-center py-4" },
                    h("p", { class: "dashboard-muted" }, "Loading subscription details...")
                  )
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
            h("h1", { class: "dashboard-title" }, "Subscription & Billing"),
            h(
                "p",
                { class: "dashboard-subtitle" },
                "Manage your plan, billing preferences, and payment history."
            )
        );
    }

    renderAlerts() {
        const alerts = [];
        if (this.errorMessage) {
            alerts.push(
                h("div", { class: "dashboard-card", style: "border-left: 4px solid #ef4444;" },
                    h("p", { style: "color: #ef4444; margin: 0;" }, this.errorMessage)
                )
            );
        }
        if (this.successMessage) {
            alerts.push(
                h("div", { class: "dashboard-card", style: "border-left: 4px solid #10b981;" },
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
            this.renderCurrentPlanCard(),
            this.renderPreferencesCard(),
            this.renderAvailablePlansCard(),
            this.renderRenewalHistoryCard()
        );
    }

    renderCurrentPlanCard() {
        const sub = this.summary || {};
        const isTrial = sub.trial_active;
        const statusLabel = (sub.status || "active").toUpperCase();

        return h(
            "div",
            { class: "dashboard-card service-item-card", style: "border-left: 4px solid var(--color-primary, #0284c7);" },
            h("h3", { style: "margin: 0 0 var(--space-3);" }, "Current Subscription"),
            h(
                "div",
                { class: "input-group" },
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
                )
            ),
            h(
                "div",
                { class: "input-group", style: "margin-top: var(--space-3); padding-top: var(--space-3); border-top: 1px solid var(--color-line);" },
                h(
                    "div",
                    {},
                    h("span", { class: "dashboard-muted" }, "Status"),
                    h(
                        "p",
                        { style: "margin: 6px 0 0;" },
                        h(
                            "span",
                            {
                                class: "dashboard-badge",
                                style: isTrial ? "background: #f59e0b;" : "background: #10b981;"
                            },
                            isTrial ? "Free Trial" : statusLabel
                        )
                    )
                ),
                h(
                    "div",
                    {},
                    h("span", { class: "dashboard-muted" }, sub.trial_active ? "Trial Ends On" : "Next Billing Date"),
                    h("p", { style: "font-weight: 600; margin: 4px 0 0;" }, this.formatDate(sub.trial_active ? sub.trial_ends_at : sub.next_billing_date))
                )
            ),
            sub.restriction_message
                ? h("p", { class: "dashboard-muted", style: "margin-top: var(--space-3); font-size: var(--step-small); color: #d97706;" }, sub.restriction_message)
                : null
        );
    }

    renderPreferencesCard() {
        const autoRenew = Boolean(this.summary?.auto_renew_enabled);

        return h(
            "div",
            { class: "dashboard-card service-item-card" },
            h("h3", { style: "margin: 0 0 var(--space-3);" }, "Billing Preferences"),
            h(
                "div",
                { style: "display: flex; justify-content: space-between; align-items: flex-start; gap: var(--space-3);" },
                h(
                    "div",
                    {},
                    h("h4", { style: "margin: 0 0 4px;" }, "Automatic Plan Renewal"),
                    h(
                        "p",
                        { class: "dashboard-muted", style: "margin: 0; font-size: var(--step-small);" },
                        "Automatically renew your subscription using your saved authorization code when due."
                    )
                ),
                h(
                    "button",
                    {
                        class: `btn ${autoRenew ? "btn-outline" : "btn-primary"}`,
                        style: "padding: 0.4rem 0.8rem; font-size: var(--step-small);",
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
            h("h3", { style: "margin: 0 0 var(--space-3);" }, "Available Plans & s"),
            plans.length === 0
                ? h("p", { class: "dashboard-muted" }, "No plans available at this time.")
                : h(
                      "div",
                      { class: "services-list" },
                      plans.map(plan => {
                          const isCurrent = plan.code === currentPlanCode;
                          const isProcessing = this.renewingPlanCode === plan.code;

                          return h(
                              "div",
                              {
                                  class: "dashboard-card service-item-card",
                                  style: isCurrent
                                      ? "border-left: 4px solid var(--color-primary, #0284c7); background: rgba(2, 132, 199, 0.03);"
                                      : ""
                              },
                              h(
                                  "div",
                                  { style: "display: flex; justify-content: space-between; align-items: flex-start; gap: var(--space-3);" },
                                  h(
                                      "div",
                                      {},
                                      h("h3", { style: "margin: 0 0 var(--space-2);" }, plan.label),
                                      isCurrent
                                          ? h("span", { class: "dashboard-badge", style: "background: var(--color-primary, #0284c7);" }, "Current Plan")
                                          : null
                                  ),
                                  h(
                                      "button",
                                      {
                                          class: `btn ${isCurrent ? "btn-outline" : "btn-primary"}`,
                                          style: "padding: 0.4rem 0.8rem; font-size: var(--step-small);",
                                          disabled: isProcessing,
                                          onclick: () => this.handleRenew(plan.code)
                                      },
                                      isProcessing ? "Initializing..." : isCurrent ? "Renew Current Plan" : `Upgrade`
                                  )
                              ),
                              h("p", { class: "dashboard-muted", style: "margin-top: var(--space-3);" }, plan.description || "No description provided."),
                              h(
                                  "div",
                                  {
                                      class: "input-group",
                                      style: "margin-top: var(--space-4); padding-top: var(--space-3); border-top: 1px solid var(--color-line);"
                                  },
                                  h("div", {}, h("strong", {}, "Monthly Fee: "), this.formatCurrency(plan.monthlyFee)),
                                  h("div", {}, h("strong", {}, "Platform Commission: "), plan.commissionLabel)
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
            h("h3", { style: "margin: 0 0 var(--space-3);" }, "Payment History"),
            renewals.length === 0
                ? h("p", { class: "dashboard-muted" }, "No subscription payment transactions found.")
                : h(
                      "table",
                      { style: "width: 100%; border-collapse: collapse; text-align: left; font-size: var(--step-small);" },
                      h(
                          "thead",
                          {},
                          h(
                              "tr",
                              { style: "border-bottom: 2px solid var(--color-line); color: var(--color-ink-faint);" },
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
                                  { style: "border-bottom: 1px solid var(--color-line);" },
                                  h("td", { style: "padding: 8px; font-family: monospace;" }, item.reference),
                                  h("td", { style: "padding: 8px;" }, (item.plan_code || "starter").toUpperCase()),
                                  h("td", { style: "padding: 8px;" }, `${this.formatCurrency(item.amount)}`),
                                  h(
                                      "td",
                                      { style: "padding: 8px;" },
                                      h(
                                          "span",
                                          {
                                              class: "dashboard-badge",
                                              style: item.status === "success"
                                                  ? "background: #10b981;"
                                                  : item.status === "failed"
                                                  ? "background: #ef4444;"
                                                  : "background: var(--color-ink-faint);"
                                          },
                                          item.status
                                      )
                                  ),
                                  h("td", { style: "padding: 8px;" }, this.formatDate(item.created_at))
                              )
                          )
                      )
                  )
        );
    }

    update() {
        if (!this.el) return;

        const newTree = h(
            "div",
            { class: "dashboard-page subscription-page" },
            this.renderHeader(),
            this.renderAlerts(),
            this.loading
                ? h("div", { class: "dashboard-card text-center py-4" },
                    h("p", { class: "dashboard-muted" }, "Loading subscription details...")
                  )
                : this.renderContent()
        );

        this.el.replaceChildren(...(Array.isArray(newTree) ? newTree : [newTree]).flat());
    }
}
