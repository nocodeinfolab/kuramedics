// js/services/api.js

const API_BASE_URL =
    "https://doctors-consultation-backend.onrender.com/api/v1";

class ApiService {

    constructor() {
        this.refreshPromise = null;
    }

    getAccessToken() {
        return localStorage.getItem("accessToken");
    }

    setAccessToken(token) {
        if (token) {
            localStorage.setItem("accessToken", token);
        }
    }

    clearSession() {

        localStorage.removeItem("accessToken");
        localStorage.removeItem("user");

        window.location.hash = "/doctor/login";

    }

    async refreshAccessToken() {

        if (this.refreshPromise) {
            return this.refreshPromise;
        }

        console.log("----------------------------------------");
        console.log("Refreshing access token...");

        this.refreshPromise = fetch(
            `${API_BASE_URL}/auth/refresh`,
            {
                method: "POST",
                credentials: "include"
            }
        )
            .then(async response => {

                const result = await response.json();

                console.log("Refresh response:", result);

                if (!response.ok) {
                    throw new Error(
                        result.message || "Unable to refresh session."
                    );
                }

                this.setAccessToken(
                    result.data.accessToken
                );

                console.log("Access token refreshed.");

                return result.data.accessToken;

            })
            .catch(error => {

                console.error(
                    "Token refresh failed:",
                    error
                );

                this.clearSession();

                throw error;

            })
            .finally(() => {

                this.refreshPromise = null;

            });

        return this.refreshPromise;

    }

    async request(
        endpoint,
        options = {},
        retry = true
    ) {

        const token = this.getAccessToken();

        const headers = {
            ...(options.headers || {})
        };

        if (token) {
            headers.Authorization = `Bearer ${token}`;
        }

        const response = await fetch(
            `${API_BASE_URL}${endpoint}`,
            {
                ...options,
                headers,
                credentials: "include"
            }
        );

        if (response.status !== 401) {
            return response;
        }

        console.warn(
            "Access token expired. Attempting refresh..."
        );

        if (!retry) {

            console.error(
                "Request still unauthorized after refresh."
            );

            this.clearSession();

            return response;

        }

        await this.refreshAccessToken();

        return this.request(
            endpoint,
            options,
            false
        );

    }

    async get(endpoint) {

        const response = await this.request(endpoint);

        const result = await response.json();

        if (!response.ok) {
            throw new Error(
                result.message || "Request failed."
            );
        }

        return result;

    }

    async post(endpoint, body) {

        const response = await this.request(
            endpoint,
            {
                method: "POST",
                headers: {
                    "Content-Type": "application/json"
                },
                body: JSON.stringify(body)
            }
        );

        const result = await response.json();

        if (!response.ok) {
            throw new Error(
                result.message || "Request failed."
            );
        }

        return result;

    }

    async put(endpoint, body) {

        const response = await this.request(
            endpoint,
            {
                method: "PUT",
                headers: {
                    "Content-Type": "application/json"
                },
                body: JSON.stringify(body)
            }
        );

        const result = await response.json();

        if (!response.ok) {
            throw new Error(
                result.message || "Request failed."
            );
        }

        return result;

    }

    async delete(endpoint) {

        const response = await this.request(
            endpoint,
            {
                method: "DELETE"
            }
        );

        const result = await response.json();

        if (!response.ok) {
            throw new Error(
                result.message || "Request failed."
            );
        }

        return result;

    }

}

export default new ApiService();
