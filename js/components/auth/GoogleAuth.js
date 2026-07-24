// js/components/auth/GoogleAuth.js

const API_BASE_URL = "/api/v1";

class GoogleAuth {
    constructor() {
        this.clientId =
            "249309356521-ajkp64pp89gru2pb1qqti3gahbe2ffcc.apps.googleusercontent.com";
    }

    renderButton(elementId, role, onSuccess, onError) {

        console.log("1. Rendering Google Sign-In button...");

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

                console.log("2. Google returned an ID token.");

                try {

                    console.log("3. Sending ID token to backend...");

                    const response = await fetch(
                        `${API_BASE_URL}/auth/google`,
                        {
                            method: "POST",
                            headers: {
                                "Content-Type": "application/json"
                            },
                            body: JSON.stringify({
                                credential,
                                role
                            })
                        }
                    );

                    const result = await response.json();

                    console.log("4. Backend response:", result);

                    if (!response.ok) {
                        throw new Error(
                            result.message || "Google sign-in failed."
                        );
                    }

                    localStorage.setItem(
                        "accessToken",
                        result.data.accessToken
                    );

                    localStorage.setItem(
                        "refreshToken",
                        result.data.refreshToken
                    );

                    localStorage.setItem(
                        "user",
                        JSON.stringify(result.data.user)
                    );

                    console.log("5. Login successful.");

                    onSuccess?.(result.data);

                } catch (error) {

                    console.error("Google authentication failed:", error);

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

        console.log("6. Google Sign-In button rendered.");
    }

    logout() {

        localStorage.removeItem("accessToken");
        localStorage.removeItem("refreshToken");
        localStorage.removeItem("user");

        if (window.google?.accounts?.id) {
            google.accounts.id.disableAutoSelect();
        }
    }

    getUser() {
        const user = localStorage.getItem("user");
        return user ? JSON.parse(user) : null;
    }

    isAuthenticated() {
        return !!localStorage.getItem("accessToken");
    }

    getAccessToken() {
        return localStorage.getItem("accessToken");
    }
}

export default new GoogleAuth();
