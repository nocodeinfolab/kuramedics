// js/components/auth/GoogleAuth.js

const API_BASE_URL = "/api/v1";

class GoogleAuth {
    constructor() {
        this.clientId =
            "249309356521-ajkp64pp89gru2pb1qqti3gahbe2ffcc.apps.googleusercontent.com";
    }

    async signIn(role) {
        if (!window.google?.accounts?.id) {
            throw new Error(
                "Google Sign-In is not available. Please refresh the page and try again."
            );
        }

        return new Promise((resolve, reject) => {
            google.accounts.id.initialize({
                client_id: this.clientId,
                auto_select: false,
                cancel_on_tap_outside: true,

                callback: async ({ credential }) => {
                    try {
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

                        resolve(result.data);

                    } catch (error) {
                        reject(error);
                    }
                }
            });

            // Show Google's account chooser
            google.accounts.id.prompt((notification) => {

                if (notification.isNotDisplayed()) {
                    reject(
                        new Error(
                            "Google Sign-In could not be displayed."
                        )
                    );
                    return;
                }

                if (notification.isSkippedMoment()) {
                    reject(
                        new Error(
                            "Google Sign-In was skipped."
                        )
                    );
                    return;
                }

                if (notification.isDismissedMoment()) {
                    reject(
                        new Error(
                            "Google Sign-In was cancelled."
                        )
                    );
                }

            });
        });
    }

    logout() {
        localStorage.removeItem("accessToken");
        localStorage.removeItem("refreshToken");
        localStorage.removeItem("user");

        if (window.google?.accounts?.id) {
            google.accounts.id.disableAutoSelect();
            google.accounts.id.cancel();
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
