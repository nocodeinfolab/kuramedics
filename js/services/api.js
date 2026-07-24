// js/services/api.js

const API_BASE_URL =
    "https://doctors-consultation-backend.onrender.com/api/v1";

class ApiService {

    constructor() {

        this.refreshPromise = null;
        this.csrfToken = null;

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

        console.warn("Clearing user session...");

        localStorage.removeItem("accessToken");
        localStorage.removeItem("refreshToken");
        localStorage.removeItem("user");

        this.csrfToken = null;

        window.location.hash = "/doctor/login";

    }

    async getCsrfToken() {
        console.log("getCsrfToken() called at", Date.now());
    
        console.log("----------------------------------------");
        console.log("Fetching CSRF token...");
    
        const response = await fetch(
            `${API_BASE_URL}/csrf-token`,
            {
                credentials: "include"
            }
        );
    
        const result = await response.json();
    
        console.log("CSRF response:", result);
    
        if (!response.ok) {
            throw new Error(
                result.message || "Unable to obtain CSRF token."
            );
        }
    
        this.csrfToken = result.csrfToken;
    
        console.log("CSRF token obtained:", this.csrfToken);
    
        return this.csrfToken;
    }
    async refreshAccessToken() {

        if (this.refreshPromise) {

            console.log("Refresh already in progress.");

            return this.refreshPromise;

        }

        console.log("----------------------------------------");
        console.log("Refreshing access token...");

        this.refreshPromise = (async () => {

            const csrfToken = await this.getCsrfToken();

            const response = await fetch(
                `${API_BASE_URL}/auth/refresh`,
                {
                    method: "POST",
                    credentials: "include",
                    headers: {
                        "X-CSRF-Token": csrfToken
                    }
                }
            );

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

            console.log("Access token refreshed successfully.");

            return result.data.accessToken;

        })()
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

        const method = (
            options.method || "GET"
        ).toUpperCase();

        const headers = {
            ...(options.headers || {})
        };

        if (!["GET", "HEAD", "OPTIONS"].includes(method)) {

            headers["X-CSRF-Token"] =
                await this.getCsrfToken();

        }

        if (token) {

            headers.Authorization =
                `Bearer ${token}`;

        }

        console.log("----------------------------------------");
        console.log(`${method} ${endpoint}`);
        console.log("Authorization:", !!token);
        console.log(
            "CSRF:",
            !!headers["X-CSRF-Token"]
        );

        const response = await fetch(
            `${API_BASE_URL}${endpoint}`,
            {
                ...options,
                headers,
                credentials: "include"
            }
        );

        console.log(
            "HTTP Status:",
            response.status
        );

        if (response.status !== 401) {

            return response;

        }

        console.warn(
            "Access token expired. Attempting automatic refresh..."
        );

        if (!retry) {

            console.error(
                "Request still unauthorized after refresh."
            );

            this.clearSession();

            return response;

        }

        await this.refreshAccessToken();

        console.log(
            "Retrying original request..."
        );

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
    async patch(endpoint, body) {
        const response = await this.request(
            endpoint,
            {
                method: "PATCH",
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
