// js/services/doctorConsultationService.js

import api from "./api.js";

class DoctorConsultationApiService {
    /**
     * Fetch all consultation services for the authenticated doctor
     * @returns {Promise<Array>} List of consultation services
     */
    async getServices() {
        const response = await api.get("/doctor/services");
        
        // Handle nested payload: response.data.data OR response.data OR response
        if (Array.isArray(response)) return response;
        if (Array.isArray(response?.data)) return response.data;
        if (Array.isArray(response?.data?.data)) return response.data.data;
        
        return [];
    }

    /**
     * Get public consultation services for a specific doctor
     * @param {string} doctorId 
     * @returns {Promise<Array>} List of enabled consultation services
     */
    async getPublicServices(doctorId) {
        const response = await api.get(`/doctor/services/public/${doctorId}`);
        
        if (Array.isArray(response)) return response;
        if (Array.isArray(response?.data)) return response.data;
        if (Array.isArray(response?.data?.data)) return response.data.data;

        return [];
    }

    /**
     * Create or upsert a new consultation service
     */
    async createService(serviceData) {
        const response = await api.post("/doctor/services", serviceData);
        return response?.data || response;
    }

    /**
     * Update an existing consultation service by ID
     */
    async updateService(serviceId, serviceData) {
        const response = await api.patch(`/doctor/services/${serviceId}`, serviceData);
        return response?.data || response;
    }

    /**
     * Soft-delete / disable a consultation service
     */
    async deleteService(serviceId) {
        const response = await api.delete(`/doctor/services/${serviceId}`);
        return response?.data || response;
    }
}

export default new DoctorConsultationApiService();
