// js/components/auth/GoogleAuth.js

import { Capacitor } from "@capacitor/core";
import { GoogleAuth as NativeGoogleAuth } from "@capacitor/google-auth";

const API_BASE_URL =
    "https://doctors-consultation-backend.onrender.com/api/v1";

// Same client ID Google Identity Services (web) already uses. The native
// plugin needs this as its "server client ID" so the idToken it returns is
// verifiable by the same backend endpoint that already validates GIS tokens.
const WEB_CLIENT_ID =
    "249309356521-ajkp64pp89gru2pb1qqti3gahbe2ffcc.apps.googleusercontent.com";

class GoogleAuth {

    constructor() {

        this.clientId = WEB_CLIENT_ID;
        this.nativeInitialized = false;

    }

    renderButton(elementId, role, onSuccess, onError) {

        console.log("----------------------------------------");
        console.log("GoogleAuth: Initializing Google Sign-In");

        if (Capacitor.isNativePlatform()) {

            this.renderNativeButton(elementId, role, onSuccess, onError);
            return;

        }

        this.renderWebButton(elementId, role, onSuccess, onError);

    }

    // ---------- Web (unchanged behavior) ----------

    renderWebButton(elementId, role, onSuccess, onError) {

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

                await this.handleCredential(credential, role, onSuccess, onError);

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

    // ---------- Native (Capacitor) ----------

    async ensureNativeInitialized() {

        if (this.nativeInitialized) return;

        await NativeGoogleAuth.initialize({
            clientId: WEB_CLIENT_ID,
            scopes: ["profile", "email"],
            grantOfflineAccess: false
        });

        this.nativeInitialized = true;

    }

    renderNativeButton(elementId, role, onSuccess, onError) {

        // The Google Identity Services web widget can't be embedded here —
        // Google blocks GIS/OAuth inside app WebViews. Render a plain button
        // that triggers the native OS-level Google Sign-In sheet instead.
        const container = document.getElementById(elementId);

        if (!container) {

            console.error(`GoogleAuth: element #${elementId} not found.`);
            onError?.(new Error("Sign-in button could not be rendered."));
            return;

        }

        container.innerHTML = "";

        const button = document.createElement("button");
        button.type = "button";
        button.className = "google-auth-button google-auth-button--native";
        button.textContent = "Continue with Google";

        button.addEventListener("click", () => {
            this.nativeSignIn(role, onSuccess, onError);
        });

        container.appendChild(button);

        console.log("Native Google Sign-In button rendered.");
        console.log("----------------------------------------");

    }

    async nativeSignIn(role, onSuccess, onError) {

        try {

            await this.ensureNativeInitialized();

            console.log("Opening native Google Sign-In...");

            const user = await NativeGoogleAuth.signIn();
            const idToken = user?.authentication?.idToken;

            if (!idToken) {
                throw new Error("Google did not return an ID token.");
            }

            console.log("Native Google Sign-In returned an ID token.");

            await this.handleCredential(idToken, role, onSuccess, onError);

        } catch (error) {

            console.error("----------------------------------------");
            console.error("Native Google authentication failed.");
            console.error(error);
            console.error("----------------------------------------");

            onError?.(error);

        }

    }

    // ---------- Shared: send credential to backend ----------
    // Both the web (GIS) flow and the native flow end up with a Google ID
    // token — this is the one place that talks to the backend, so the
    // request/response handling only needs to exist once.

    async handleCredential(credential, role, onSuccess, onError) {

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

    logout() {

        console.log("Logging out...");

        localStorage.removeItem("accessToken");
        localStorage.removeItem("user");

        if (Capacitor.isNativePlatform() && this.nativeInitialized) {
            NativeGoogleAuth.signOut().catch(() => {});
        } else if (window.google?.accounts?.id) {
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
