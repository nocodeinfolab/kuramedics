// js/components/auth/GoogleAuth.js

const API_BASE_URL = "/api/v1";

class GoogleAuth {
    constructor() {
        this.clientId =
            "249309356521-ajkp64pp89gru2pb1qqti3gahbe2ffcc.apps.googleusercontent.com";
    }

    async signIn(role) {

        console.log("1. signIn() called");
        console.log("Role:", role);

        if (!window.google?.accounts?.id) {
            console.error("2. Google SDK NOT loaded.");
            throw new Error(
                "Google Sign-In is not available. Please refresh the page and try again."
            );
        }

        console.log("2. Google SDK loaded.");

        return new Promise((resolve, reject) => {

            console.log("3. Initializing Google Identity Services...");

            google.accounts.id.initialize({
                client_id: this.clientId,
                auto_select: false,
                cancel_on_tap_outside: true,

                callback: async ({ credential }) => {

                    console.log("4. Google callback received.");
                    console.log("Credential:", credential);

                    try {

                        console.log("5. Sending credential to backend...");

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

                        console.log("6. Backend responded.");
                        console.log("Status:", response.status);

                        const result = await response.json();

                        console.log("7. Backend JSON:");
                        console.log(result);

                        if (!response.ok) {
                            throw new Error(
                                result.message || "Google sign-in failed."
                            );
                        }

                        console.log("8. Saving tokens...");

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

                        console.log("9. Login successful.");

                        resolve(result.data);

                    } catch (error) {

                        console.error("Backend request failed:");
                        console.error(error);

                        reject(error);
                    }
                }
            });

            console.log("10. Calling google.accounts.id.prompt()...");

            google.accounts.id.prompt((notification) => {

                console.log("11. Prompt notification:");
                console.log(notification);

                if (notification.isNotDisplayed()) {
                    console.warn("Prompt was NOT displayed.");
                    reject(
                        new Error(
                            "Google Sign-In could not be displayed."
                        )
                    );
                    return;
                }

                if (notification.isSkippedMoment()) {
                    console.warn("Prompt was skipped.");
                    reject(
                        new Error(
                            "Google Sign-In was skipped."
                        )
                    );
                    return;
                }

                if (notification.isDismissedMoment()) {
                    console.warn("Prompt was dismissed.");
                    reject(
                        new Error(
                            "Google Sign-In was cancelled."
                        )
                    );
                    return;
                }

                console.log("12. Prompt displayed successfully.");
            });

            console.log("13. prompt() returned.");
        });
    }

    logout() {

        console.log("Logging out...");

        localStorage.removeItem("accessToken");
        localStorage.removeItem("refreshToken");
        localStorage.removeItem("user");

        if (window.google?.accounts?.id) {
            google.accounts.id.disableAutoSelect();
            google.accounts.id.cancel();
        }

        console.log("Logout complete.");
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
