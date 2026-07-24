// js/services/doctorConsultationService.js

import api from "./api.js";

class DoctorConsultationApiService {
    /**
     * Fetch all consultation services for the authenticated doctor
     * @returns {Promise<Array>} List of consultation services
     */
    async getServices() {
        const res = await api.get("/doctor/services");
        // Check if response is { success: true, data: [...] } or direct array
        if (Array.isArray(res)) return res;
        if (Array.isArray(res?.data)) return res.data;
        return [];
    }

    /**
     * Get public consultation services for a specific doctor
     * @param {string} doctorId 
     * @returns {Promise<Array>} List of enabled consultation services
     */
    async getPublicServices(doctorId) {
        const res = await api.get(`/doctor/services/public/${doctorId}`);
        if (Array.isArray(res)) return res;
        if (Array.isArray(res?.data)) return res.data;
        return [];
    }

    /**
     * Create or upsert a new consultation service
     */
    async createService(serviceData) {
        const res = await api.post("/doctor/services", serviceData);
        return res?.data || res;
    }

    /**
     * Update an existing consultation service by ID
     */
    async updateService(serviceId, serviceData) {
        const res = await api.patch(`/doctor/services/${serviceId}`, serviceData);
        return res?.data || res;
    }

    /**
     * Soft-delete / disable a consultation service
     */
    async deleteService(serviceId) {
        const res = await api.delete(`/doctor/services/${serviceId}`);
        return res?.data || res;
    }
}

export default new DoctorConsultationApiService();
