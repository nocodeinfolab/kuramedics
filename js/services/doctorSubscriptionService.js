// js/services/doctorSubscriptionService.js

import api from "./api.js";

class DoctorSubscriptionService {
    /**
     * Get the logged-in doctor's subscription details
     */
    async getMySubscription() {
        return api.get("/subscription/me");
    }

    /**
     * Update billing preferences
     * Example:
     * {
     *   auto_renew_enabled: true
     * }
     */
    async updateBillingPreferences(data) {
        return api.patch("/subscription/preferences", data);
    }

    /**
     * Initialize subscription renewal
     * Example:
     * {
     *   plan_code: "professional",
     *   plan_interval: "monthly"
     * }
     */
    async initializeRenewal(data) {
        return api.post("/subscription/renew", data);
    }

    /**
     * Verify payment after Paystack redirect
     */
    async verifyRenewal(reference) {
        return api.get(`/subscription/verify/${reference}`);
    }
}

export default new DoctorSubscriptionService();
