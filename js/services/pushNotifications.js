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

const ALWAYS_VISIBLE_PUSH_TYPES = new Set(["new_appointment", "appointment_confirmed", "appointment_rescheduled", "appointment_time_accepted"]);

function getLocalNotificationsPlugin() {
    return window.Capacitor?.Plugins?.LocalNotifications ?? null;
}

class PushNotificationsService {

    constructor() {
        this.initialized = false;
        this.currentToken = null;
        this._initPromise = null;
    }

    async init(onNotificationTap) {

        if (!isNativePlatform()) {
            console.log("PushNotifications: skipped (not on a native platform).");
            return;
        }

        if (this.initialized) return;

        // If init() is already in flight (e.g. called twice in quick
        // succession before the first call has finished awaiting
        // permissions/registration), share that same in-flight promise
        // instead of racing through listener registration a second time.
        if (this._initPromise) {
            return this._initPromise;
        }

        this._initPromise = this._doInit(onNotificationTap);

        try {
            await this._initPromise;
        } finally {
            this._initPromise = null;
        }
    }

    async _doInit(onNotificationTap) {

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

        plugin.addListener("registration", async (token) => {
            console.log("PushNotifications: device token received.");
            await this.syncTokenWithBackend(token.value);
        });

        plugin.addListener("registrationError", (error) => {
            console.error("PushNotifications: registration failed.", error);
        });

        const localNotifications = getLocalNotificationsPlugin();
        if (localNotifications) {
            try {
                await localNotifications.requestPermissions();
            } catch (error) {
                console.warn("PushNotifications: local notification permission request failed.", error);
            }

            localNotifications.addListener("localNotificationActionPerformed", (action) => {
                console.log("PushNotifications: local notification tapped.", action);
                if (onNotificationTap) {
                    onNotificationTap(action.notification?.extra || {});
                }
            });
        }

        plugin.addListener("pushNotificationReceived", async (notification) => {
            console.log("PushNotifications: received in foreground.", notification);

            const type = notification.data?.type;
            if (!ALWAYS_VISIBLE_PUSH_TYPES.has(type)) return;

            const ln = getLocalNotificationsPlugin();
            if (!ln) {
                console.warn("PushNotifications: LocalNotifications plugin not available, cannot force-display.");
                return;
            }

            try {
                await ln.schedule({
                    notifications: [
                        {
                            id: Math.floor(Math.random() * 2147483647),
                            title: notification.title || "Notification",
                            body: notification.body || "",
                            extra: notification.data || {},
                        },
                    ],
                });
            } catch (error) {
                console.error("PushNotifications: failed to show local notification.", error);
            }
        });

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

            const localNotifications = getLocalNotificationsPlugin();
            await localNotifications?.removeAllListeners();
            
            this.currentToken = null;
            this.initialized = false;
        }
    }

}

export default new PushNotificationsService();
