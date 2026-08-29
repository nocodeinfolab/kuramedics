// js/services/pushNotifications.js

import api from "./api.js";

function isNativePlatform() {
    return window.Capacitor?.isNativePlatform?.() ?? false;
}

function getPlugin() {
    return window.Capacitor?.Plugins?.PushNotifications ?? null;
}

function getPlatform() {
    return window.Capacitor?.getPlatform?.() ?? "android";
}

class PushNotificationsService {

    constructor() {
        this.initialized = false;
        this.currentToken = null;
    }

    /**
     * Call once after login (both doctor and patient), once `user` is
     * known. Safe to call multiple times — it's a no-op after the first
     * successful run per app session, and it's a no-op entirely on web,
     * since there's no native push transport there.
     */
    async init(onNotificationTap) {

        if (!isNativePlatform()) {

            console.log("PushNotifications: skipped (not on a native platform).");
            return;

        }

        if (this.initialized) return;

        const plugin = getPlugin();

        if (!plugin) {

            console.error("PushNotifications: native plugin not available.");
            return;

        }

        console.log("----------------------------------------");
        console.log("PushNotifications: requesting permission...");

        const permission = await plugin.requestPermissions();

        if (permission.receive !== "granted") {

            console.warn("PushNotifications: permission not granted.");
            return;

        }

        // registrationError / registration are one-shot events tied to
        // this specific register() call, so wire them up right before
        // calling it rather than at module load time.
        plugin.addListener("registration", async (token) => {

            console.log("PushNotifications: device token received.");
            await this.syncTokenWithBackend(token.value);

        });

        plugin.addListener("registrationError", (error) => {

            console.error("PushNotifications: registration failed.", error);

        });

        // Foreground notifications don't show a system banner by default
        // on Android — this just logs for now. Route this into your own
        // in-app toast/badge system if you want a visible foreground alert.
        plugin.addListener("pushNotificationReceived", (notification) => {

            console.log("PushNotifications: received in foreground.", notification);

        });

        // Fires when the user taps a notification (app in background or
        // killed). `notification.notification.data` carries whatever
        // custom `data` payload the backend sent — use it to deep-link
        // (e.g. straight into a specific consultation or booking).
        plugin.addListener("pushNotificationActionPerformed", (action) => {

            console.log("PushNotifications: tapped.", action);

            if (onNotificationTap) {
                onNotificationTap(action.notification?.data || {});
            }

        });

        await plugin.register();

        this.initialized = true;

        console.log("PushNotifications: initialized.");
        console.log("----------------------------------------");

    }

    async syncTokenWithBackend(token) {

        if (token === this.currentToken) {

            console.log("PushNotifications: token unchanged, skipping sync.");
            return;

        }

        try {

            await api.post("/notifications/register-device", {
                token,
                platform: getPlatform()
            });

            this.currentToken = token;

            console.log("PushNotifications: token synced with backend.");

        } catch (error) {

            console.error("PushNotifications: failed to sync token.", error);

        }

    }

    /**
     * Call on logout so the backend stops sending pushes for a device
     * that's no longer signed in to this account.
     */
    async unregister() {
        if (!isNativePlatform() || !this.currentToken) return;
    
        try {
            await api.post("/notifications/unregister-device", {
                token: this.currentToken
            });
            console.log("PushNotifications: device unregistered.");
        } catch (error) {
            console.error("PushNotifications: failed to unregister device.", error);
        } finally {
            const plugin = getPlugin();
            await plugin?.removeAllListeners();
            this.currentToken = null;
            this.initialized = false;
        }
    }

}

export default new PushNotificationsService();
