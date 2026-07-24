// js/services/doctorConsultationService.js

import api from "./api.js";

class DoctorConsultationApiService {
    /**
     * Fetch all consultation services for the authenticated doctor
     * @returns {Promise<Array>} List of consultation services
     */
    async getServices() {
        const response = await api.get("/doctor-consultation-services");
        return response.data || response;
    }

    /**
     * Get public consultation services for a specific doctor (e.g., for patient booking view)
     * @param {string} doctorId 
     * @returns {Promise<Array>} List of enabled consultation services
     */
    async getPublicServices(doctorId) {
        const response = await api.get(`/doctor-consultation-services/public/${doctorId}`);
        return response.data || response;
    }

    /**
     * Create or upsert a new consultation service
     * @param {Object} serviceData 
     * @returns {Promise<Object>} Created service record
     */
    async createService(serviceData) {
        const response = await api.post("/doctor-consultation-services", serviceData);
        return response.data || response;
    }

    /**
     * Update an existing consultation service by ID
     * @param {string|number} serviceId 
     * @param {Object} serviceData 
     * @returns {Promise<Object>} Updated service record
     */
    async updateService(serviceId, serviceData) {
        const response = await api.patch(`/doctor-consultation-services/${serviceId}`, serviceData);
        return response.data || response;
    }

    /**
     * Soft-delete / disable a consultation service
     * @param {string|number} serviceId 
     * @returns {Promise<Object>} Disabled service record
     */
    async deleteService(serviceId) {
        const response = await api.delete(`/doctor-consultation-services/${serviceId}`);
        return response.data || response;
    }
}

export default new DoctorConsultationApiService();
