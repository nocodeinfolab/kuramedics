// js/services/api.js

const API_BASE_URL =
    "https://doctors-consultation-backend.onrender.com/api/v1";

const REQUEST_TIMEOUT_MS = 20000; // any single request gives up after 20s

class ApiService {

    constructor() {

        this.refreshPromise = null;
        this.csrfToken = null;

    }

    getBaseOrigin() {
        return new URL(API_BASE_URL).origin;
    }

    resolveUrl(path) {
        if (!path) return null;
        if (/^https?:\/\//i.test(path)) return path;
        const origin = this.getBaseOrigin();
        return `${origin}${path.startsWith("/") ? "" : "/"}${path}`;
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

        window.location.hash = "/";

    }

    // Wraps fetch with a hard timeout via AbortController. Without this, a
    // stalled connection (flaky mobile network, a stuck upstream service,
    // etc.) leaves the calling await unresolved forever — which is exactly
    // what makes a UI spinner get stuck open with no way to recover short
    // of a page refresh. This guarantees every fetch either resolves or
    // rejects within REQUEST_TIMEOUT_MS.
    async fetchWithTimeout(url, options = {}) {
        const controller = new AbortController();
        const timeoutId = setTimeout(
            () => controller.abort(),
            REQUEST_TIMEOUT_MS
        );

        try {
            return await fetch(url, {
                ...options,
                signal: controller.signal
            });
        } catch (err) {
            if (err.name === "AbortError") {
                throw new Error(
                    "The request timed out. Please check your connection and try again."
                );
            }
            throw err;
        } finally {
            clearTimeout(timeoutId);
        }
    }

    async getCsrfToken() {
        console.log("getCsrfToken() called at", Date.now());
    
        console.log("----------------------------------------");
        console.log("Fetching CSRF token...");
    
        const response = await this.fetchWithTimeout(
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

            const response = await this.fetchWithTimeout(
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

        const response = await this.fetchWithTimeout(
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
        async getBlob(endpoint) {

        const response = await this.request(endpoint);

        if (!response.ok) {

            let message = "Request failed.";
            try {
                const result = await response.json();
                message = result.message || message;
            } catch {
                
            }

            throw new Error(message);

        }

        return response.blob();

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
    async uploadFile(endpoint, formData, { onProgress } = {}, retry = true) {
        const token = this.getAccessToken();
        const csrfToken = await this.getCsrfToken();

        return new Promise((resolve, reject) => {
            const xhr = new XMLHttpRequest();
            xhr.open("POST", `${API_BASE_URL}${endpoint}`);
            xhr.withCredentials = true;

            if (token) {
                xhr.setRequestHeader("Authorization", `Bearer ${token}`);
            }
            if (csrfToken) {
                xhr.setRequestHeader("X-CSRF-Token", csrfToken);
            }

            xhr.upload.onprogress = (e) => {
                if (e.lengthComputable && typeof onProgress === "function") {
                    onProgress(Math.round((e.loaded / e.total) * 100));
                }
            };

            xhr.onload = async () => {
                if (xhr.status === 401 && retry) {
                    // Token expired — refresh and retry once. FormData is
                    // reusable across XHR.send() calls per the spec, so we
                    // can resend the same object without rebuilding it.
                    try {
                        await this.refreshAccessToken();
                        const result = await this.uploadFile(endpoint, formData, { onProgress }, false);
                        resolve(result);
                    } catch (err) {
                        reject(err);
                    }
                    return;
                }

                let parsed = null;
                try { parsed = JSON.parse(xhr.responseText); } catch { /* non-JSON response */ }

                if (xhr.status >= 200 && xhr.status < 300) {
                    resolve(parsed?.data ?? parsed);
                } else {
                    reject(new Error(parsed?.message || `Upload failed (${xhr.status})`));
                }
            };

            xhr.onerror = () => reject(new Error("Network error during upload"));
            xhr.ontimeout = () => reject(new Error("Upload timed out"));
            xhr.timeout = 120000; // uploads get a longer budget than normal requests

            xhr.send(formData);
        });
    }

}

export default new ApiService();
