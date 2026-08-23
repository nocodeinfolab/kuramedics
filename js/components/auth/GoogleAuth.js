// js/components/auth/GoogleAuth.js

// No bundler in this project, so we deliberately do NOT `import` from
// "@capacitor/core" or "@capacitor/google-auth" — bare npm specifiers can't
// be resolved by a browser without a bundler/import map, and doing so broke
// the plain web deployment entirely (Cloudflare Pages has no Capacitor
// runtime, so the import itself failed to resolve).
//
// Instead we use the global `window.Capacitor` object that Capacitor's
// native runtime auto-injects into the WebView. It exposes
// `Capacitor.isNativePlatform()` and every registered native plugin under
// `Capacitor.Plugins.<PluginName>` — this is Capacitor's documented,
// supported path for apps that don't use a bundler. On the web deployment,
// `window.Capacitor` simply doesn't exist, so every reference below safely
// falls back via optional chaining.
//
// Note: @capacitor/google-auth still needs to be an npm dependency
// (`npm install @capacitor/google-auth`) so `npx cap sync android` picks it
// up and registers the native plugin during the build — it's just never
// imported into browser-loaded JS.

const API_BASE_URL =
    "https://doctors-consultation-backend.onrender.com/api/v1";

// Same client ID Google Identity Services (web) already uses. The native
// plugin needs this as its "server client ID" so the idToken it returns is
// verifiable by the same backend endpoint that already validates GIS tokens.
const WEB_CLIENT_ID =
    "249309356521-ajkp64pp89gru2pb1qqti3gahbe2ffcc.apps.googleusercontent.com";

function isNativePlatform() {
    return window.Capacitor?.isNativePlatform?.() ?? false;
}

function getNativeGoogleAuthPlugin() {
    return window.Capacitor?.Plugins?.GoogleAuth ?? null;
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

        const plugin = getNativeGoogleAuthPlugin();

        if (!plugin) {
            throw new Error("Native Google Sign-In plugin is not available.");
        }

        await plugin.initialize({
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

            const plugin = getNativeGoogleAuthPlugin();

            if (!plugin) {
                throw new Error("Native Google Sign-In plugin is not available.");
            }

            console.log("Opening native Google Sign-In...");

            const user = await plugin.signIn();
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

        if (isNativePlatform() && this.nativeInitialized) {

            const plugin = getNativeGoogleAuthPlugin();
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
