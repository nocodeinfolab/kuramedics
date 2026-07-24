// js/services/doctorSubscriptionService.js

import api from "./api.js";

class DoctorSubscriptionApiService {
    /**
     * Fetch all subscription plans for the authenticated doctor
     * @returns {Promise<Array>} List of subscription plans
     */
    async getSubscriptionPlans() {
        const res = await api.get("/doctor/subscriptions");
        // Check if response is { success: true, data: [...] } or direct array
        if (Array.isArray(res)) return res;
        if (Array.isArray(res?.data)) return res.data;
        return [];
    }

    /**
     * Get public subscription plans for a specific doctor
     * @param {string} doctorId 
     * @returns {Promise<Array>} List of enabled subscription plans
     */
    async getPublicSubscriptionPlans(doctorId) {
        const res = await api.get(`/doctor/subscriptions/public/${doctorId}`);
        if (Array.isArray(res)) return res;
        if (Array.isArray(res?.data)) return res.data;
        return [];
    }

    /**
     * Create or upsert a new subscription plan
     */
    async createSubscriptionPlan(planData) {
        const res = await api.post("/doctor/subscriptions", planData);
        return res?.data || res;
    }

    /**
     * Update an existing subscription plan by ID
     */
    async updateSubscriptionPlan(planId, planData) {
        const res = await api.patch(`/doctor/subscriptions/${planId}`, planData);
        return res?.data || res;
    }

    /**
     * Soft-delete / disable a subscription plan
     */
    async deleteSubscriptionPlan(planId) {
        const res = await api.delete(`/doctor/subscriptions/${planId}`);
        return res?.data || res;
    }
}

export default new DoctorSubscriptionApiService();
