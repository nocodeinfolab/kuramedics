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

        formData.append(
            "avatar",
            file
        );

        return api.request(
            "/doctor-profile/me/avatar",
            {
                method: "POST",
                body: formData
            }
        ).then(async response => {

            const result = await response.json();

            if (!response.ok) {

                throw new Error(
                    result.message ||
                    "Avatar upload failed."
                );

            }

            return result;

        });

    }

    async regenerateBookingLink() {

        return api.post(
            "/doctor-profile/me/booking-link/regenerate",
            {}
        );

    }

}

export default new DoctorProfileService();
