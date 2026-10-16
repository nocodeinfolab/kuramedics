// js/components/doctor/settings/DoctorSubscriptionPage.js

import { Component } from "../../../core/component.js";
import { h } from "../../../utils/dom.js";
import api from "../../../services/api.js";

const PLAN_ORDER = ["starter", "professional", "premium"];

// ── Store product mapping ──────────────────────────────────
// One product per tier. Monthly vs yearly is a base plan
// *inside* the product, expressed by the offer ID suffix
// (@monthly / @yearly). Same pattern as the vendor app.
const BILLING_PRODUCTS = {
    starter:      { google: "doctor_starter_monthly",      apple: "doctor.starter.monthly" },
    professional: { google: "doctor_professional_monthly", apple: "doctor.professional.monthly" },
    premium:      { google: "doctor_premium_monthly",      apple: "doctor.premium.monthly" }
};

const PLAN_RANK = { starter: 1, professional: 2, premium: 3 };

// ── Module-level store handler bridge ──────────────────────
// CdvPurchase.store handlers are global. If this component is
// unmounted and a new instance mounts, we must NOT stack a
// second set of handlers — route through a single "active"
// reference instead.
let storeHandlersAttached = false;
let activeSubscriptionPage = null;

function getPlatform() {
    if (!window.Capacitor || typeof window.Capacitor.getPlatform !== "function") {
        return "google";
    }
    return window.Capacitor.getPlatform() === "ios" ? "apple" : "google";
}

function productIdFor(planCode, platform = getPlatform()) {
    const entry = BILLING_PRODUCTS[planCode];
    return entry ? (platform === "apple" ? entry.apple : entry.google) : null;
}

function planForProductId(productId) {
    for (const [code, ids] of Object.entries(BILLING_PRODUCTS)) {
        if (ids.google === productId || ids.apple === productId) return code;
    }
    return null;
}

export default class DoctorSubscriptionPage extends Component {
    constructor(doctor, onBack) {
        super();
        this.doctor = doctor ?? {};
        this.onBack = typeof onBack === "function" ? onBack : () => {};

        this.loading = true;
        this.saving = false;
        this.errorMessage = "";
        this.successMessage = "";
        this.summary = null;

        // ── IAP state ──
        this.processingPlanCode = null;
        this.interval = "monthly";
        this.billingReady = false;
        this.restoreInProgress = false;
        this.restoreHandled = false;
        this.billingStatus = "";
        this.billingStatusKind = ""; // "info" | "success" | "error"
    }

    async afterMount() {
        activeSubscriptionPage = this;
        await Promise.all([
            this.loadSubscriptionSummary(),
            this.initializeStore()
        ]);
    }

    // ════════════════════════════════════════════════════════
    //  DATA LOADING
    // ════════════════════════════════════════════════════════
    async loadSubscriptionSummary() {
        this.loading = true;
        this.errorMessage = "";
        this.update();

        try {
            const res = await api.get("/subscription/me");
            this.summary = res.data || res;

            // If the server says we're on a free/starter tier with no
            // store-side subscription on file, quietly ask the server
            // to re-check the stores. If it actually restored something,
            // re-fetch so the UI reflects the recovered plan.
            const isPaid = ["professional", "premium"].includes(this.summary?.plan_code)
                && !this.summary?.trial_active;
            if (!isPaid) {
                this.silentRestoreOnLaunch().then(restored => {
                    if (restored) this.loadSubscriptionSummary();
                });
            }
        } catch (error) {
            console.error("Failed to load subscription details:", error);
            this.errorMessage = error.message || "Failed to load subscription details.";
        } finally {
            this.loading = false;
            this.update();
        }
    }

    async silentRestoreOnLaunch() {
        try {
            const res = await api.post("/subscription/restore", {});
            const data = res.data || res;
            return !!data.restored;
        } catch (err) {
            
            console.warn("Silent restore failed:", err);
            return false;
        }
    }

    // ════════════════════════════════════════════════════════
    //  STORE LIFECYCLE
    // ════════════════════════════════════════════════════════
    async initializeStore() {
        if (!window.CdvPurchase) {
            console.warn("CdvPurchase not available — IAP disabled");
            this.billingReady = false;
            this.update();
            return;
        }

        const { store, ProductType, Platform } = window.CdvPurchase;
        const platform = getPlatform();
        const targetPlatform = platform === "apple"
            ? Platform.APPLE_APPSTORE
            : Platform.GOOGLE_PLAY;

        // Register one product per tier
        const registrations = PLAN_ORDER.map(code => ({
            id: productIdFor(code, platform),
            type: ProductType.PAID_SUBSCRIPTION,
            platform: targetPlatform
        }));

        store.register(registrations);

        // Attach global handlers once, routed to whichever page is active
        if (!storeHandlersAttached) {
            storeHandlersAttached = true;

            store.when().approved(tx => {
                if (activeSubscriptionPage) {
                    activeSubscriptionPage.handleApprovedTransaction(tx);
                }
            });

            store.error(err => {
                if (activeSubscriptionPage) {
                    activeSubscriptionPage.handleStoreError(err);
                }
            });
        }

        try {
            await store.initialize([targetPlatform]);
            this.billingReady = true;
        } catch (err) {
            console.error("Store initialization failed:", err);
            this.billingReady = false;
        }
        this.update();
    }

    handleStoreError(error) {
        if (error.code === window.CdvPurchase.ErrorCode.PAYMENT_CANCELLED) {
            this.processingPlanCode = null;
            this.update();
            return;
        }
        console.error("Store error:", error);
        this.setBillingStatus(error.message || "Purchase failed.", "error");
        this.processingPlanCode = null;
        this.update();
    }

    // ════════════════════════════════════════════════════════
    //  VERIFY → SERVER
    // ════════════════════════════════════════════════════════
    async handleApprovedTransaction(transaction) {
        try {
            this.setBillingStatus("Confirming your purchase…", "info");
            this.update();

            const productId = this.extractProductId(transaction);
            if (!productId) return this.failBilling("Could not read product ID.");

            const planCode = planForProductId(productId);
            if (!planCode) return this.failBilling("Unknown product: " + productId);

            const token = this.extractPurchaseToken(transaction);
            if (!token) return this.failBilling("Could not read purchase token.");

            const platform = getPlatform();
            const payload = {
                platform,
                product_id: productId
            };
            if (platform === "apple") {
                payload.original_transaction_id = token;
            } else {
                payload.purchase_token = token;
            }

            await api.post("/subscription/verify-purchase", payload);

            // Finish (acknowledge) ONLY after the server accepted it.
            // If verify fails, the store will re-fire .approved() on
            // next launch — nothing is lost.
            try {
                if (typeof transaction.finish === "function") await transaction.finish();
            } catch (e) {
                console.warn("Finish failed:", e);
            }

            this.restoreHandled = true;
            this.setBillingStatus("✓ You're now subscribed. Enjoy!", "success");
            this.processingPlanCode = null;
            await this.loadSubscriptionSummary();

            setTimeout(() => {
                this.setBillingStatus("", "");
                this.update();
            }, 2000);

        } catch (err) {
            console.error("handleApprovedTransaction error:", err);
            this.failBilling(err.message || "Verification failed. Please try again.");
        }
    }

    failBilling(message) {
        this.setBillingStatus(message, "error");
        this.processingPlanCode = null;
        this.update();
    }

    extractProductId(tx) {
        if (Array.isArray(tx.products) && tx.products.length) {
            const p = tx.products[0];
            return typeof p === "string" ? p : p?.id;
        }
        if (tx.nativePurchase?.productIds?.length) return tx.nativePurchase.productIds[0];
        if (tx.nativePurchase?.products?.length) return tx.nativePurchase.products[0]?.productId;
        return null;
    }

    extractPurchaseToken(tx) {
        return (
            tx.purchaseToken ||
            tx.nativePurchase?.purchaseToken ||
            (Array.isArray(tx.nativePurchase?.purchaseTokens) && tx.nativePurchase.purchaseTokens[0]) ||
            null
        );
    }

    findOldPurchaseToken(productId) {
        const { store } = window.CdvPurchase;
        for (const receipt of (store.localReceipts || [])) {
            for (const tx of (receipt.transactions || [])) {
                const pid = tx.products?.[0]?.id;
                if (pid !== productId) continue;

                const expiry = tx.nativePurchase?.expirationDate;
                if (expiry) {
                    const expiryMs = typeof expiry === "number" ? expiry : Number(expiry);
                    if (expiryMs > 0 && expiryMs <= Date.now()) continue;
                }

                const token = tx.nativePurchase?.purchaseToken
                    || receipt.purchaseToken
                    || tx.purchaseToken;
                if (token) return token;
            }
        }
        return null;
    }

    // ════════════════════════════════════════════════════════
    //  USER-TRIGGERED PURCHASE
    // ════════════════════════════════════════════════════════
    async selectPlan(planCode) {
        if (!this.billingReady || !window.CdvPurchase) {
            this.setBillingStatus(
                "In-app purchases are unavailable in this build. Update the app to continue.",
                "error"
            );
            this.update();
            return;
        }

        const currentCode = this.summary?.plan_code || "starter";
        const status = this.summary?.status || "active";
        const renewalDue = ["past_due", "suspended"].includes(status);

        if (planCode === currentCode && !renewalDue && !this.summary?.trial_active) {
            this.setBillingStatus("You are already on this plan.", "info");
            this.update();
            return;
        }

        this.processingPlanCode = planCode;
        this.setBillingStatus("", "");
        this.update();

        await this.launchBilling(planCode);
    }

    async launchBilling(planCode) {
        try {
            const platform = getPlatform();
            const productId = productIdFor(planCode, platform);
            const { store, GooglePlay } = window.CdvPurchase;

            const product = store.get(productId);
            if (!product) return this.failBilling("Product not available. Try again later.");

            const offers = product.offers || [];
            const wantedSuffix = "@" + this.interval;
            let offer = offers.find(o => o.id && o.id.endsWith(wantedSuffix));
            if (!offer) offer = offers[0];
            if (!offer) return this.failBilling("This billing option is unavailable right now.");

            // ── Is there an active paid subscription we're replacing? ──
            const currentCode = this.summary?.plan_code;
            const currentCycle = this.summary?.plan_interval;
            const status = this.summary?.status || "";
            const hasActivePaid = !!currentCode
                && !this.summary?.trial_active
                && ["active", "past_due"].includes(status)
                && currentCode !== "starter";

            const oldProductId = hasActivePaid ? productIdFor(currentCode, platform) : null;
            const oldPurchaseToken = oldProductId ? this.findOldPurchaseToken(oldProductId) : null;
            const isSameProduct = oldProductId && oldProductId === productId;

            // Guard: if the server says we're on a paid tier but the
            // device has no matching receipt, refuse rather than risk
            // stacking a second parallel subscription.
            if (hasActivePaid && !oldPurchaseToken) {
                return this.failBilling('Tap "Restore purchases" first, then try again.');
            }

            // ── Place the order ──
            if (platform === "apple") {
                // Apple auto-compares current vs new subscription and
                // applies proration — one call handles every case.
                await store.order(offer);
            } else if (isSameProduct) {
                // Same product, different base plan (monthly ↔ yearly).
                // Do NOT pass oldPurchaseToken or replacementMode —
                // Google handles the switch internally.
                await store.order(offer);
            } else if (oldPurchaseToken) {
                // Cross-tier change
                const RM = GooglePlay.ReplacementMode;
                let mode;
                if (PLAN_RANK[planCode] < PLAN_RANK[currentCode]) {
                    mode = RM.DEFERRED;                         // downgrade
                } else if (PLAN_RANK[planCode] > PLAN_RANK[currentCode]
                           && this.interval === currentCycle) {
                    mode = RM.CHARGE_PRORATED_PRICE;            // upgrade, same cycle
                } else {
                    mode = RM.WITH_TIME_PRORATION;              // upgrade + cycle change
                }

                await store.order(offer, {
                    googlePlay: {
                        oldPurchaseToken,
                        oldProductId,
                        replacementMode: mode
                    }
                });
            } else {
                // First-time purchase
                await store.order(offer);
            }

        } catch (err) {
            console.error("Billing order error:", err);
            this.failBilling("Could not start purchase. Try again.");
        }
    }

    // ════════════════════════════════════════════════════════
    //  RESTORE
    // ════════════════════════════════════════════════════════
    async restorePurchases() {
        if (!this.billingReady || !window.CdvPurchase) {
            this.setBillingStatus("In-app purchases are unavailable in this build.", "error");
            this.update();
            return;
        }

        this.restoreInProgress = true;
        this.restoreHandled = false;
        this.setBillingStatus("Checking the store for your subscriptions…", "info");
        this.update();

        try {
            await window.CdvPurchase.store.restorePurchases();

            // The .approved() handler fires for each restored transaction.
            // If nothing fired within 5s, tell the user.
            setTimeout(() => {
                if (!this.restoreHandled) {
                    this.setBillingStatus("No active subscription found for this account.", "info");
                    this.restoreInProgress = false;
                    this.update();
                }
            }, 5000);
        } catch (err) {
            console.error("Restore failed:", err);
            this.setBillingStatus("Could not restore purchases. Try again.", "error");
            this.restoreInProgress = false;
            this.update();
        }
    }

    openStoreSubscriptions() {
        const platform = getPlatform();
        const url = platform === "apple"
            ? "https://apps.apple.com/account/subscriptions"
            : "https://play.google.com/store/account/subscriptions";

        const Browser = window.Capacitor?.Plugins?.Browser;
        if (Browser?.open) {
            Browser.open({ url }).catch(() => window.open(url, "_blank"));
        } else {
            window.open(url, "_blank");
        }
    }

    // ════════════════════════════════════════════════════════
    //  HELPERS
    // ════════════════════════════════════════════════════════
    setBillingStatus(message, kind) {
        this.billingStatus = message || "";
        this.billingStatusKind = kind || "";
    }

    formatCurrency(amount) {
        return new Intl.NumberFormat("en-NG", {
            style: "currency", currency: "NGN", maximumFractionDigits: 0
        }).format(amount || 0);
    }

    formatDate(dateString) {
        if (!dateString) return "N/A";
        return new Date(dateString).toLocaleDateString(undefined, {
            year: "numeric", month: "short", day: "numeric"
        });
    }

    // ════════════════════════════════════════════════════════
    //  RENDER
    // ════════════════════════════════════════════════════════
    render() {
        return h(
            "div",
            { class: "dashboard-page subscription-page" },
            this.renderHeader(),
            this.renderAlerts(),
            this.renderBillingStatus(),
            this.loading
                ? h("div", { class: "dashboard-card text-center py-4" },
                    h("p", { class: "dashboard-muted" }, "Loading subscription details..."))
                : this.renderContent()
        );
    }

    renderHeader() {
        return h(
            "section",
            { class: "dashboard-header page-hero" },
            h("button",
                { type: "button", class: "page-hero__back", onclick: () => this.onBack() },
                this.renderChevronIcon(),
                h("span", {}, "Settings")),
            h("h1", { class: "page-hero__title" }, "Subscription & Billing"),
            h("p", { class: "page-hero__subtitle" },
                "Manage your plan and payment history. Purchases are handled by the App Store / Google Play.")
        );
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
        if (this.errorMessage) {
            alerts.push(h("div",
                { class: "dashboard-card", style: "border-left: 4px solid #ef4444;" },
                h("p", { style: "color: #ef4444; margin: 0;" }, this.errorMessage)));
        }
        if (this.successMessage) {
            alerts.push(h("div",
                { class: "dashboard-card", style: "border-left: 4px solid #10b981;" },
                h("p", { style: "color: #10b981; margin: 0;" }, this.successMessage)));
        }
        return alerts;
    }

    renderBillingStatus() {
        if (!this.billingStatus) return null;
        const color = this.billingStatusKind === "error" ? "#ef4444"
            : this.billingStatusKind === "success" ? "#10b981"
            : "var(--color-primary, #0284c7)";
        return h("div",
            { class: "dashboard-card", style: `border-left: 4px solid ${color};` },
            h("p", { style: `color: ${color}; margin: 0;` }, this.billingStatus));
    }

    renderContent() {
        return h(
            "div",
            { class: "services-list" },
            this.renderCurrentPlanCard(),
            this.renderManageCard(),
            this.renderAvailablePlansCard(),
            this.renderRenewalHistoryCard(),
            this.renderRestoreCard()
        );
    }

    renderCurrentPlanCard() {
        const sub = this.summary || {};
        const isTrial = sub.trial_active;
        const statusLabel = (sub.status || "active").toUpperCase();

        return h("div",
            { class: "dashboard-card service-item-card",
              style: "border-left: 4px solid var(--color-primary, #0284c7);" },
            h("h3", { style: "margin: 0 0 var(--space-3);" }, "Current Subscription"),
            h("div", { class: "input-group" },
                h("div", {},
                    h("span", { class: "dashboard-muted" }, "Plan Tier"),
                    h("p", { style: "font-weight: 600; font-size: 1.2rem; margin: 4px 0 0;" },
                        sub.plan_name || "Starter")),
                h("div", {},
                    h("span", { class: "dashboard-muted" }, "Price & Commission"),
                    h("p", { style: "font-weight: 600; font-size: 1.2rem; margin: 4px 0 0;" },
                        `${this.formatCurrency(sub.monthly_fee)} / mo (${sub.commission_label || "5%"} fee)`))),
            h("div",
                { class: "input-group",
                  style: "margin-top: var(--space-3); padding-top: var(--space-3); border-top: 1px solid var(--color-line);" },
                h("div", {},
                    h("span", { class: "dashboard-muted" }, "Status"),
                    h("p", { style: "margin: 6px 0 0;" },
                        h("span",
                            { class: "dashboard-badge",
                              style: isTrial ? "background: #f59e0b;" : "background: #10b981;" },
                            isTrial ? "Free Trial" : statusLabel))),
                h("div", {},
                    h("span", { class: "dashboard-muted" },
                        sub.trial_active ? "Trial Ends On" : "Next Billing Date"),
                    h("p", { style: "font-weight: 600; margin: 4px 0 0;" },
                        this.formatDate(sub.trial_active ? sub.trial_ends_at : sub.next_billing_date)))),
            sub.restriction_message
                ? h("p",
                    { class: "dashboard-muted",
                      style: "margin-top: var(--space-3); font-size: var(--step-small); color: #d97706;" },
                    sub.restriction_message)
                : null
        );
    }

    // Replaces the old "Auto-Renew" toggle. Auto-renew is owned by the
    // store, so the only legitimate action is a deep-link into it.
    renderManageCard() {
        const isPaid = ["professional", "premium"].includes(this.summary?.plan_code)
            && !this.summary?.trial_active;

        return h("div",
            { class: "dashboard-card service-item-card" },
            h("h3", { style: "margin: 0 0 var(--space-3);" }, "Billing Preferences"),
            h("div",
                { style: "display: flex; justify-content: space-between; align-items: flex-start; gap: var(--space-3);" },
                h("div", {},
                    h("h4", { style: "margin: 0 0 4px;" }, "Auto-Renewal & Payment Method"),
                    h("p",
                        { class: "dashboard-muted",
                          style: "margin: 0; font-size: var(--step-small);" },
                        isPaid
                            ? "Manage auto-renew, payment method, and cancellation in the store."
                            : "Your subscription will auto-renew through the store once you subscribe.")),
                h("button",
                    {
                        class: "btn btn-outline",
                        style: "padding: 0.4rem 0.8rem; font-size: var(--step-small);",
                        onclick: () => this.openStoreSubscriptions()
                    },
                    "Manage subscription"))
        );
    }

    renderAvailablePlansCard() {
        const plans = this.summary?.available_plans || [];
        const currentPlanCode = this.summary?.plan_code || "starter";
        const subscriptionStatus = this.summary?.status || "active";
        const isRenewalDue = ["past_due", "suspended"].includes(subscriptionStatus);
        const isTrial = !!this.summary?.trial_active;
        const currentPlanIndex = PLAN_ORDER.indexOf(currentPlanCode);

        return h("div",
            { class: "dashboard-card" },
            h("h3", { style: "margin: 0 0 var(--space-3);" }, "Available Plans & Pricing"),
            plans.length === 0
                ? h("p", { class: "dashboard-muted" }, "No plans available at this time.")
                : h("div",
                    { class: "services-list" },
                    plans.map(plan => {
                        const isCurrent = plan.code === currentPlanCode;
                        const isProcessing = this.processingPlanCode === plan.code;
                        const planIndex = PLAN_ORDER.indexOf(plan.code);
                        const isLowerTier = planIndex < currentPlanIndex;
                        const isDisabled = isProcessing
                            || (!window.CdvPurchase)
                            || (isCurrent && !isRenewalDue && !isTrial);

                        let buttonLabel;
                        if (isProcessing) buttonLabel = "Initializing…";
                        else if (isCurrent && !isTrial && !isRenewalDue) buttonLabel = "Active";
                        else if (isCurrent && isTrial) buttonLabel = "Subscribe";
                        else if (isCurrent && isRenewalDue) buttonLabel = "Restore / Re-subscribe";
                        else if (isLowerTier) buttonLabel = "Downgrade";
                        else buttonLabel = "Upgrade";

                        return h("div",
                            { class: "dashboard-card service-item-card",
                              style: isCurrent
                                  ? "border-left: 4px solid var(--color-primary, #0284c7); background: rgba(2, 132, 199, 0.03);"
                                  : "" },
                            h("div",
                                { style: "display: flex; justify-content: space-between; align-items: flex-start; gap: var(--space-3);" },
                                h("div", {},
                                    h("h3", { style: "margin: 0 0 var(--space-2);" }, plan.label),
                                    isCurrent
                                        ? h("span",
                                            { class: "dashboard-badge",
                                              style: "background: var(--color-primary, #0284c7);" },
                                            "Current Plan")
                                        : null),
                                h("button",
                                    {
                                        class: `btn ${isCurrent || isLowerTier ? "btn-outline" : "btn-primary"}`,
                                        style: "padding: 0.4rem 0.8rem; font-size: var(--step-small);",
                                        disabled: isDisabled,
                                        onclick: () => this.selectPlan(plan.code)
                                    },
                                    buttonLabel)),
                            h("p",
                                { class: "dashboard-muted", style: "margin-top: var(--space-3);" },
                                plan.description || "No description provided."),
                            h("div",
                                { class: "input-group",
                                  style: "margin-top: var(--space-4); padding-top: var(--space-3); border-top: 1px solid var(--color-line);" },
                                h("div", {}, h("strong", {}, "Monthly Fee: "), this.formatCurrency(plan.monthlyFee)),
                                h("div", {}, h("strong", {}, "Platform Commission: "), plan.commissionLabel)));
                    }))
        );
    }

    renderRenewalHistoryCard() {
        const renewals = this.summary?.renewals || [];
        return h("div",
            { class: "dashboard-card" },
            h("h3", { style: "margin: 0 0 var(--space-3);" }, "Payment History"),
            renewals.length === 0
                ? h("p", { class: "dashboard-muted" }, "No subscription payment transactions found.")
                : h("div",
                    { style: "display: flex; flex-direction: column; gap: 10px;" },
                    renewals.map(item => this.renderRenewalRow(item)))
        );
    }

    renderRenewalRow(item) {
        const statusColor = item.status === "paid" ? "#10b981"
            : item.status === "failed" ? "#ef4444"
            : "var(--color-ink-faint)";

        return h("div",
            { style: "padding: 0.75rem 0.85rem; background: var(--color-bg-muted, #f8fafc); border-radius: 8px; display: flex; flex-direction: column; gap: 6px;" },
            h("div",
                { style: "display: flex; justify-content: space-between; align-items: flex-start; gap: 10px;" },
                h("div", { style: "min-width: 0;" },
                    h("p", { style: "margin: 0; font-weight: 600; font-size: 0.9rem;" },
                        `${(item.plan_code || "starter").toUpperCase()} · ${this.formatCurrency(item.amount)}`),
                    h("p",
                        { class: "dashboard-muted",
                          style: "margin: 2px 0 0; font-size: 0.75rem; font-family: monospace; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;" },
                        item.reference)),
                h("span",
                    { class: "dashboard-badge",
                      style: `background: ${statusColor}; font-size: 0.68rem; padding: 3px 8px; border-radius: 5px; white-space: nowrap; color: #fff; flex-shrink: 0;` },
                    item.status)),
            h("p",
                { class: "dashboard-muted", style: "margin: 0; font-size: 0.78rem;" },
                this.formatDate(item.created_at)));
    }

    renderRestoreCard() {
        return h("div",
            { class: "dashboard-card" },
            h("h3", { style: "margin: 0 0 var(--space-3);" }, "Already subscribed?"),
            h("p",
                { class: "dashboard-muted", style: "margin: 0 0 var(--space-3);" },
                "If you reinstalled the app or switched devices, tap below to restore an active subscription."),
            h("button",
                {
                    class: "btn btn-outline",
                    disabled: this.restoreInProgress || !this.billingReady,
                    onclick: () => this.restorePurchases()
                },
                this.restoreInProgress ? "Checking…" : "Restore purchases"));
    }

    update() {
        if (!this.el) return;

        const newTree = h(
            "div",
            { class: "dashboard-page subscription-page" },
            this.renderHeader(),
            this.renderAlerts(),
            this.renderBillingStatus(),
            this.loading
                ? h("div", { class: "dashboard-card text-center py-4" },
                    h("p", { class: "dashboard-muted" }, "Loading subscription details..."))
                : this.renderContent()
        );

        this.el.replaceChildren(...(Array.isArray(newTree) ? newTree : [newTree]).flat());
    }
}
