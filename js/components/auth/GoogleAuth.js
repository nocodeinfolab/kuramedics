// js/components/auth/GoogleAuth.js

const API_BASE_URL =
    "https://doctors-consultation-backend.onrender.com/api/v1";

// Same client ID Google Identity Services (web) already uses. The native
// plugin requires this exact WEB client ID on every platform (including
// Android/iOS) as its "server client ID" — this is documented plugin
// behavior, not a mistake — so the idToken it returns is verifiable by the
// same backend endpoint that already validates GIS tokens.
const WEB_CLIENT_ID =
    "249309356521-ajkp64pp89gru2pb1qqti3gahbe2ffcc.apps.googleusercontent.com";

function isNativePlatform() {
    return window.Capacitor?.isNativePlatform?.() ?? false;
}

function getNativeGoogleSignInPlugin() {
    return window.Capacitor?.Plugins?.GoogleSignIn ?? null;
}

class GoogleAuth {

    constructor() {

        this.clientId = WEB_CLIENT_ID;
        this.nativeInitialized = false;

    }

    renderButton(elementId, role, onSuccess, onError) {

        console.log("----------------------------------------");
        console.log("GoogleAuth: Initializing Google Sign-In");

        if (isNativePlatform()) {

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

        const plugin = getNativeGoogleSignInPlugin();

        if (!plugin) {
            throw new Error("Native Google Sign-In plugin is not available.");
        }

        // Must be the WEB client ID here, even on Android/iOS — this is
        // required by the plugin, not a bug. See comment near the top.
        await plugin.initialize({
            clientId: WEB_CLIENT_ID
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
        button.className = "auth-provider-btn";
        button.innerHTML = `
          <svg class="provider-btn-icon" viewBox="0 0 24 24" aria-hidden="true">
            <path fill="#4285F4" d="M23.52 12.27c0-.85-.08-1.67-.22-2.45H12v4.64h6.47a5.53 5.53 0 0 1-2.4 3.63v3h3.88c2.27-2.09 3.57-5.17 3.57-8.82z"/>
            <path fill="#34A853" d="M12 24c3.24 0 5.96-1.07 7.95-2.91l-3.88-3c-1.08.72-2.46 1.15-4.07 1.15-3.13 0-5.78-2.11-6.73-4.96H1.26v3.1A12 12 0 0 0 12 24z"/>
            <path fill="#FBBC05" d="M5.27 14.28A7.2 7.2 0 0 1 4.89 12c0-.79.14-1.56.38-2.28v-3.1H1.26A12 12 0 0 0 0 12c0 1.94.46 3.77 1.26 5.38z"/>
            <path fill="#EA4335" d="M12 4.77c1.76 0 3.34.61 4.58 1.79l3.44-3.44C17.95 1.19 15.24 0 12 0 7.31 0 3.26 2.69 1.26 6.62l4.01 3.1C6.22 6.88 8.87 4.77 12 4.77z"/>
          </svg>
          <span class="auth-provider-btn__label">Continue with Google</span>
          <span class="auth-provider-btn__arrow"></span>
        `;

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

            const plugin = getNativeGoogleSignInPlugin();

            if (!plugin) {
                throw new Error("Native Google Sign-In plugin is not available.");
            }

            console.log("Opening native Google Sign-In...");

            const result = await plugin.signIn();
            const idToken = result?.idToken;

            if (!idToken) {
                throw new Error("Google did not return an ID token.");
            }

            console.log("Native Google Sign-In returned an ID token.");

            await this.handleCredential(idToken, role, onSuccess, onError);

        } catch (error) {

            console.error("----------------------------------------");
            console.error("Native Google authentication failed.");

            // Common, actionable failure per the plugin's own docs: the
            // account picker opens but fails right after picking an
            // account — almost always means no Android OAuth client is
            // registered yet for this app's package name + SHA-1.
            if (error?.code === "SIGN_IN_CANCELED" || error?.message?.includes("reauth failed")) {
                console.error(
                    "This usually means no Android OAuth client is registered " +
                    "for this app's package name + signing certificate SHA-1 " +
                    "in Google Cloud Console."
                );
            }

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

        if (isNativePlatform() && this.nativeInitialized) {

            const plugin = getNativeGoogleSignInPlugin();
            plugin?.signOut().catch(() => {});

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
