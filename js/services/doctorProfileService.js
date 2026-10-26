// js/services/doctorProfileService.js

import api from "./api.js";

class DoctorProfileService {

    async getProfile() {

        return api.get("/doctor-profile/me");

    }

    async saveProfile(profile) {

        return api.put(
            "/doctor-profile/me",
            profile
        );

    }

    async uploadAvatar(file) {
        const formData = new FormData();
        formData.append("avatar", file);
        return api.uploadFile("/doctor-profile/me/avatar", formData);
    }
    async regenerateBookingLink() {

        return api.post(
            "/doctor-profile/me/booking-link/regenerate",
            {}
        );

    }

}

export default new DoctorProfileService();
