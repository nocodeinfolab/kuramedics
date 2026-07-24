// js/components/auth/GoogleAuth.js

const API_BASE_URL =
    "https://doctors-consultation-backend.onrender.com/api/v1";

class GoogleAuth {

    constructor() {

        this.clientId =
            "249309356521-ajkp64pp89gru2pb1qqti3gahbe2ffcc.apps.googleusercontent.com";

    }

    renderButton(elementId, role, onSuccess, onError) {

        console.log("----------------------------------------");
        console.log("GoogleAuth: Initializing Google Sign-In");

        if (!window.google?.accounts?.id) {

            console.error("Google Identity Services SDK not loaded.");

            onError?.(
                new Error(
                    "Google Sign-In is unavailable. Please refresh the page."
                )
            );

            return;

        }

        google.accounts.id.initialize({

            client_id: this.clientId,

            callback: async ({ credential }) => {

                console.log("----------------------------------------");
                console.log("Google returned ID token.");

                try {

                    console.log("Sending Google credential to backend...");

                    const response = await fetch(
                        `${API_BASE_URL}/auth/google`,
                        {
                            method: "POST",
                            credentials: "include",
                            headers: {
                                "Content-Type": "application/json"
                            },
                            body: JSON.stringify({
                                credential,
                                role
                            })
                        }
                    );

                    console.log("HTTP Status:", response.status);

                    const result = await response.json();

                    console.log("Backend Response:", result);

                    if (!response.ok) {

                        throw new Error(
                            result.message || "Google sign-in failed."
                        );

                    }

                    console.log("Saving access token...");

                    localStorage.setItem(
                        "accessToken",
                        result.data.accessToken
                    );

                    console.log("Caching user profile...");

                    localStorage.setItem(
                        "user",
                        JSON.stringify(result.data.user)
                    );

                    console.log("Google login successful.");
                    console.log("Refresh token stored securely in HttpOnly cookie.");
                    console.log("----------------------------------------");

                    onSuccess?.(result.data);

                } catch (error) {

                    console.error("----------------------------------------");
                    console.error("Google authentication failed.");
                    console.error(error);
                    console.error("----------------------------------------");

                    onError?.(error);

                }

            }

        });

        google.accounts.id.renderButton(
            document.getElementById(elementId),
            {
                theme: "outline",
                size: "large",
                shape: "pill",
                width: 320,
                text: "continue_with",
                logo_alignment: "left"
            }
        );

        console.log("Google Sign-In button rendered.");
        console.log("----------------------------------------");

    }

    logout() {

        console.log("Logging out...");

        localStorage.removeItem("accessToken");
        localStorage.removeItem("user");

        if (window.google?.accounts?.id) {
            google.accounts.id.disableAutoSelect();
        }

        console.log("Local session cleared.");

    }

    getUser() {

        const user = localStorage.getItem("user");

        return user
            ? JSON.parse(user)
            : null;

    }

    isAuthenticated() {

        return !!localStorage.getItem("accessToken");

    }

    getAccessToken() {

        return localStorage.getItem("accessToken");

    }

    setAccessToken(token) {

        if (token) {

            localStorage.setItem("accessToken", token);

        } else {

            localStorage.removeItem("accessToken");

        }

    }

}

export default new GoogleAuth();
