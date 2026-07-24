import { Component } from "../../../core/component.js";
import { h } from "../../../utils/dom.js";
import doctorSubscriptionService from "../../../services/doctorSubscriptionService.js";

const BILLING_CYCLE_OPTIONS = [
    { value: "monthly", label: "Monthly" },
    { value: "quarterly", label: "Quarterly" },
    { value: "semi_annually", label: "Semi-Annually" },
    { value: "annually", label: "Annually" }
];

export default class DoctorSubscriptionPage extends Component {
    constructor(doctor = {}, onBack = () => {}) {
        super();
        this.doctor = doctor;
        this.onBack = onBack;

        this.loading = true;
        this.saving = false;
        this.subscriptions = [];
        this.error = null;
        this.successMsg = null;

        this.isModalOpen = false;
        this.editingPlanId = null;
        this.formData = this.getInitialFormData();
    }

    getInitialFormData() {
        return {
            plan_name: "Standard Monthly Plan",
            description: "",
            price_naira: 10000,
            billing_cycle: "monthly",
            duration_months: 1,
            is_enabled: true,
            features_summary: ""
        };
    }

    afterMount() {
        this.fetchSubscriptions();
    }

    async fetchSubscriptions() {
        this.loading = true;
        this.error = null;
        this.update();

        try {
            const res = await doctorSubscriptionService.getSubscriptionPlans();
            this.subscriptions = Array.isArray(res) ? res : [];
        } catch (err) {
            console.error("Failed to load subscription plans:", err);
            this.error = err.message || "Failed to load subscription plans.";
        } finally {
            this.loading = false;
            this.update();
        }
    }

    handleOpenModal(plan = null) {
        if (plan) {
            this.editingPlanId = plan.id || plan.plan_id;
            this.formData = {
                plan_name: plan.plan_name || "",
                description: plan.description || "",
                price_naira: plan.price_naira || 10000,
                billing_cycle: plan.billing_cycle || "monthly",
                duration_months: plan.duration_months || 1,
                is_enabled: plan.is_enabled ?? true,
                features_summary: plan.features_summary || ""
            };
        } else {
            this.editingPlanId = null;
            this.formData = this.getInitialFormData();
        }
        this.isModalOpen = true;
        this.saving = false;
        this.error = null;
        this.successMsg = null;
        this.update();
    }

    handleCloseModal() {
        this.isModalOpen = false;
        this.editingPlanId = null;
        this.saving = false;
        this.formData = this.getInitialFormData();
        this.update();
    }

    async handleSubmit(e) {
        e.preventDefault();
        this.saving = true;
        this.error = null;
        this.successMsg = null;
        this.update();

        try {
            const price = Number(this.formData.price_naira);
            const payload = {
                ...this.formData,
                price_naira: price,
                duration_months: Number(this.formData.duration_months)
            };

            if (this.editingPlanId) {
                await doctorSubscriptionService.updateSubscriptionPlan(this.editingPlanId, payload);
                this.successMsg = "Subscription plan updated successfully.";
            } else {
                await doctorSubscriptionService.createSubscriptionPlan(payload);
                this.successMsg = "Subscription plan created successfully.";
            }

            this.handleCloseModal();
            await this.fetchSubscriptions();
        } catch (err) {
            console.error("Failed to save subscription plan:", err);
            this.error = err.message || "Failed to save subscription plan.";
        } finally {
            this.saving = false;
            this.update();
        }
    }

    async handleToggleStatus(plan) {
        const planId = plan.id || plan.plan_id;
        const newStatus = !plan.is_enabled;
        const actionText = newStatus ? "enable" : "disable";

        if (!confirm(`Are you sure you want to ${actionText} this subscription plan?`)) return;

        try {
            if (newStatus) {
                await doctorSubscriptionService.updateSubscriptionPlan(planId, { ...plan, is_enabled: true });
                this.successMsg = "Subscription plan enabled successfully.";
            } else {
                await doctorSubscriptionService.deleteSubscriptionPlan(planId);
                this.successMsg = "Subscription plan disabled successfully.";
            }
            await this.fetchSubscriptions();
        } catch (err) {
            console.error(`Failed to ${actionText} subscription plan:`, err);
            this.error = err.message || `Failed to ${actionText} subscription plan.`;
            this.update();
        }
    }

    render() {
        return h(
            "div",
            { class: "dashboard-page subscription-plans-page" },
            this.renderHeader(),
            this.renderAlerts(),
            this.loading
                ? h("div", { class: "dashboard-card text-center py-4" },
                    h("p", { class: "dashboard-muted" }, "Loading subscription plans...")
                  )
                : this.renderSubscriptionList(),
            this.isModalOpen ? this.renderModal() : null
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
            h("h1", { class: "dashboard-title" }, "Subscription Plans"),
            h(
                "p",
                { class: "dashboard-subtitle" },
                "Configure recurring membership packages, billing cycles, and subscriber perks."
            ),
            h(
                "div",
                { class: "dashboard-hero-meta" },
                h(
                    "button",
                    {
                        class: "btn btn-primary",
                        style: "background: var(--color-white); color: var(--color-primary);",
                        onclick: () => this.handleOpenModal()
                    },
                    "+ Add New Plan"
                )
            )
        );
    }

    renderAlerts() {
        const alerts = [];
        if (this.error) {
            alerts.push(
                h("div", { class: "dashboard-card", style: "border-left: 4px solid #ef4444;" },
                    h("p", { style: "color: #ef4444; margin: 0;" }, this.error)
                )
            );
        }
        if (this.successMsg) {
            alerts.push(
                h("div", { class: "dashboard-card", style: "border-left: 4px solid #10b981;" },
                    h("p", { style: "color: #10b981; margin: 0;" }, this.successMsg)
                )
            );
        }
        return alerts;
    }

    renderSubscriptionList() {
        if (!this.subscriptions || this.subscriptions.length === 0) {
            return h(
                "div",
                { class: "dashboard-card", style: "text-align: center;" },
                h("p", { class: "dashboard-muted" }, "No subscription plans configured yet."),
                h(
                    "button",
                    {
                        class: "btn btn-outline",
                        style: "margin-top: var(--space-3);",
                        onclick: () => this.handleOpenModal()
                    },
                    "Create your first plan"
                )
            );
        }

        return h(
            "div",
            { class: "services-list" },
            this.subscriptions.map(plan => this.renderSubscriptionCard(plan))
        );
    }

    renderSubscriptionCard(plan) {
        const isActive = plan.is_enabled;

        return h(
            "div",
            { class: "dashboard-card service-item-card" },
            h(
                "div",
                { style: "display: flex; justify-content: space-between; align-items: flex-start; gap: var(--space-3);" },
                h(
                    "div",
                    {},
                    h("h3", { style: "margin: 0 0 var(--space-2);" }, plan.plan_name),
                    h(
                        "span",
                        {
                            class: "dashboard-badge",
                            style: isActive ? "background: #10b981;" : "background: var(--color-ink-faint);"
                        },
                        isActive ? "Active" : "Disabled"
                    )
                ),
                h(
                    "div",
                    { style: "display: flex; gap: var(--space-2); align-items: center;" },
                    h(
                        "button",
                        {
                            class: "btn btn-outline",
                            style: "padding: 0.4rem 0.8rem; font-size: var(--step-small);",
                            onclick: () => this.handleOpenModal(plan)
                        },
                        "Edit"
                    ),
                    h(
                        "button",
                        {
                            class: "btn btn-outline",
                            title: isActive ? "Click to Disable Plan" : "Click to Enable Plan",
                            ariaLabel: isActive ? "Disable Plan" : "Enable Plan",
                            style: `padding: 0.4rem 0.6rem; font-size: 1.1rem; display: inline-flex; align-items: center; justify-content: center; ${
                                isActive
                                    ? "color: #10b981; border-color: rgba(16, 185, 129, 0.4); background: rgba(16, 185, 129, 0.05);"
                                    : "color: #ef4444; border-color: rgba(239, 68, 68, 0.3); background: rgba(239, 68, 68, 0.05);"
                            }`,
                            onclick: () => this.handleToggleStatus(plan)
                        },
                        isActive ? "🟢" : "🔴"
                    )
                )
            ),
            h("p", { class: "dashboard-muted", style: "margin-top: var(--space-3);" }, plan.description || "No description provided."),
            h(
                "div",
                {
                    class: "input-group",
                    style: "margin-top: var(--space-4); padding-top: var(--space-3); border-top: 1px solid var(--color-line);"
                },
                h("div", {}, h("strong", {}, "Price: "), `₦${(plan.price_naira || 0).toLocaleString()}`),
                h("div", {}, h("strong", {}, "Billing Cycle: "), plan.billing_cycle ? plan.billing_cycle.replace("_", " ") : "N/A"),
                h("div", {}, h("strong", {}, "Duration: "), plan.duration_months ? `${plan.duration_months} month(s)` : "N/A")
            ),
            plan.features_summary
                ? h("p", { class: "dashboard-muted", style: "margin-top: var(--space-2); font-size: var(--step-small);" }, h("em", {}, `Perks: ${plan.features_summary}`))
                : null
        );
    }

    renderModal() {
        return h(
            "div",
            {
                style: "position: fixed; inset: 0; background: rgba(0, 0, 0, 0.4); backdrop-filter: blur(4px); display: flex; align-items: center; justify-content: center; z-index: 100; padding: var(--space-4);"
            },
            h(
                "div",
                { class: "settings-card", style: "max-width: 600px; width: 100%; max-height: 90vh; overflow-y: auto;" },
                h(
                    "div",
                    { style: "display: flex; justify-content: space-between; align-items: center; margin-bottom: var(--space-4);" },
                    h("h2", { style: "margin: 0;" }, this.editingPlanId ? "Edit Subscription Plan" : "Add Subscription Plan"),
                    h(
                        "button",
                        {
                            class: "btn btn-outline",
                            style: "padding: 0.2rem 0.6rem; font-size: 1.2rem; border: none;",
                            onclick: () => this.handleCloseModal()
                        },
                        "×"
                    )
                ),
                h(
                    "form",
                    { onsubmit: e => this.handleSubmit(e) },

                    h(
                        "div",
                        { class: "input-group" },
                        h(
                            "div",
                            { class: "form-group" },
                            h("label", { class: "form-label" }, "Plan Name"),
                            h("input", {
                                type: "text",
                                class: "form-input",
                                required: true,
                                value: this.formData.plan_name,
                                oninput: e => (this.formData.plan_name = e.target.value)
                            })
                        ),
                        h(
                            "div",
                            { class: "form-group" },
                            h("label", { class: "form-label" }, "Billing Cycle"),
                            h(
                                "select",
                                {
                                    class: "form-input",
                                    onchange: e => (this.formData.billing_cycle = e.target.value)
                                },
                                BILLING_CYCLE_OPTIONS.map(opt =>
                                    h(
                                        "option",
                                        {
                                            value: opt.value,
                                            selected: this.formData.billing_cycle === opt.value
                                        },
                                        opt.label
                                    )
                                )
                            )
                        )
                    ),

                    h(
                        "div",
                        { class: "input-group" },
                        h(
                            "div",
                            { class: "form-group" },
                            h("label", { class: "form-label" }, "Price (₦)"),
                            h("input", {
                                type: "number",
                                class: "form-input",
                                required: this.formData.is_enabled,
                                min: this.formData.is_enabled ? 1 : 0,
                                value: this.formData.price_naira,
                                oninput: e => (this.formData.price_naira = e.target.value)
                            })
                        ),
                        h(
                            "div",
                            { class: "form-group" },
                            h("label", { class: "form-label" }, "Duration (Months)"),
                            h("input", {
                                type: "number",
                                class: "form-input",
                                min: 1,
                                value: this.formData.duration_months,
                                oninput: e => (this.formData.duration_months = e.target.value)
                            })
                        )
                    ),

                    h(
                        "div",
                        { class: "form-group" },
                        h("label", { class: "form-label" }, "Description"),
                        h("textarea", {
                            class: "form-textarea",
                            rows: 3,
                            value: this.formData.description,
                            oninput: e => (this.formData.description = e.target.value)
                        })
                    ),

                    h(
                        "div",
                        { class: "form-group" },
                        h("label", { class: "form-label" }, "Features Summary / Perks"),
                        h("input", {
                            type: "text",
                            class: "form-input",
                            placeholder: "e.g., 2 free monthly consults, Priority chat support",
                            value: this.formData.features_summary,
                            oninput: e => (this.formData.features_summary = e.target.value)
                        })
                    ),

                    h(
                        "div",
                        { class: "input-group", style: "margin-bottom: var(--space-5);" },
                        h(
                            "div",
                            { class: "form-checkbox" },
                            h("input", {
                                type: "checkbox",
                                id: "chk_plan_enabled",
                                checked: this.formData.is_enabled,
                                onchange: e => (this.formData.is_enabled = e.target.checked)
                            }),
                            h("label", { htmlFor: "chk_plan_enabled" }, "Plan Enabled")
                        )
                    ),

                    h(
                        "div",
                        { style: "display: flex; justify-content: flex-end; gap: var(--space-3);" },
                        h(
                            "button",
                            {
                                type: "button",
                                class: "btn btn-outline",
                                onclick: () => this.handleCloseModal()
                            },
                            "Cancel"
                        ),
                        h(
                            "button",
                            {
                                type: "submit",
                                class: "btn btn-primary",
                                disabled: this.saving
                            },
                            this.saving ? h("span", { class: "btn-spinner" }) : null,
                            this.saving ? "Saving..." : "Save Plan"
                        )
                    )
                )
            )
        );
    }
}
