import { Component } from "../../core/component.js";
import { h } from "../../utils/dom.js";
import api from "../../services/api.js";

const PLAN_CODES = ["starter", "professional", "premium"];

export default class AdminSubscriptionSettings extends Component {
    constructor() {
        super();
        this.settings = null;
        this.loading = true;
        this.saving = false;
        this.errorMessage = "";
        this.successMessage = "";
        this.draft = {};
    }

    async afterMount() {
        await this.loadSettings();
    }

    async loadSettings() {
        this.loading = true;
        this.errorMessage = "";
        this.update();

        try {
            const res = await api.get("/admin/stats");
            const payload = res.data || res;
            this.settings = payload.subscription?.settings || null;
            this.draft = this.buildDraftFromSettings(this.settings);
        } catch (error) {
            console.error("Failed to load subscription settings:", error);
            this.errorMessage = error.message || "Failed to load subscription settings.";
        } finally {
            this.loading = false;
            this.update();
        }
    }

    buildDraftFromSettings(settings) {
        const draft = {
            freeTrialDays: settings?.freeTrialDays ?? 30,
            gracePeriodDays: settings?.gracePeriodDays ?? 7,
            plans: {},
        };
        PLAN_CODES.forEach(code => {
            draft.plans[code] = {
                monthlyFee: settings?.plans?.[code]?.monthlyFee ?? 0,
                commissionRate: settings?.plans?.[code]?.commissionRate ?? 0,
            };
        });
        return draft;
    }

    setField(path, value) {
        const keys = path.split(".");
        let target = this.draft;
        for (let i = 0; i < keys.length - 1; i++) target = target[keys[i]];
        target[keys[keys.length - 1]] = value;
    }

    async handleSave(e) {
        e.preventDefault();
        this.saving = true;
        this.errorMessage = "";
        this.successMessage = "";
        this.update();

        try {
            const payload = {
                freeTrialDays: Number(this.draft.freeTrialDays),
                gracePeriodDays: Number(this.draft.gracePeriodDays),
                plans: {},
            };
            PLAN_CODES.forEach(code => {
                payload.plans[code] = {
                    monthlyFee: Number(this.draft.plans[code].monthlyFee),
                    commissionRate: Number(this.draft.plans[code].commissionRate),
                };
            });

            await api.patch("/admin/subscription-settings", payload);
            this.successMessage = "Subscription settings updated successfully.";
            await this.loadSettings();
        } catch (error) {
            console.error("Failed to save subscription settings:", error);
            this.errorMessage = error.message || "Failed to save settings.";
        } finally {
            this.saving = false;
            this.update();
        }
    }

    render() {
        return h(
            "div",
            {},
            this.renderHeader(),
            this.renderAlerts(),
            this.loading
                ? h("div", { class: "admin-card admin-empty-state" }, "Loading settings...")
                : this.renderForm()
        );
    }

    renderHeader() {
        return h(
            "div",
            { class: "admin-header" },
            h(
                "div",
                {},
                h("p", { class: "admin-header__eyebrow" }, "Billing"),
                h("h1", { class: "admin-header__title" }, "Subscription Settings"),
                h("p", { class: "admin-header__subtitle" }, "Control plan pricing, commission rates, trial, and grace periods.")
            )
        );
    }

    renderAlerts() {
        const alerts = [];
        if (this.errorMessage) alerts.push(h("div", { class: "admin-alert admin-alert--error" }, this.errorMessage));
        if (this.successMessage) alerts.push(h("div", { class: "admin-alert admin-alert--success" }, this.successMessage));
        return alerts;
    }

    renderForm() {
        return h(
            "form",
            { onsubmit: (e) => this.handleSave(e) },
            h(
                "div",
                { class: "admin-card" },
                h("div", { class: "admin-card__header" }, h("h3", { class: "admin-card__title" }, "Trial & Grace Period")),
                h(
                    "div",
                    { class: "admin-form-grid" },
                    this.numberField("Free Trial Days", "freeTrialDays", this.draft.freeTrialDays),
                    this.numberField("Grace Period Days", "gracePeriodDays", this.draft.gracePeriodDays)
                )
            ),
            PLAN_CODES.map(code => this.renderPlanCard(code)),
            h(
                "button",
                { type: "submit", class: "btn btn-primary", disabled: this.saving },
                this.saving ? "Saving..." : "Save Settings"
            )
        );
    }

    renderPlanCard(code) {
        return h(
            "div",
            { class: "admin-card" },
            h("div", { class: "admin-card__header" }, h("h3", { class: "admin-card__title" }, code.charAt(0).toUpperCase() + code.slice(1))),
            h(
                "div",
                { class: "admin-form-grid" },
                this.numberField("Monthly Fee (₦)", `plans.${code}.monthlyFee`, this.draft.plans[code].monthlyFee),
                this.numberField("Commission Rate (0–1)", `plans.${code}.commissionRate`, this.draft.plans[code].commissionRate, "0.01")
            )
        );
    }

    numberField(label, path, value, step = "1") {
        return h(
            "div",
            { class: "admin-form-group" },
            h("label", { class: "admin-form-label" }, label),
            h("input", {
                type: "number",
                step,
                class: "admin-form-input",
                value: String(value),
                oninput: (e) => this.setField(path, e.target.value),
            })
        );
    }

    update() {
        if (!this.el) return;
        const newTree = this.render();
        this.el.replaceChildren(...(Array.isArray(newTree) ? newTree : [newTree]).flat());
    }
}
