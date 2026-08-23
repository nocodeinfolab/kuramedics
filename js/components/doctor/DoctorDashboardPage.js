// js/components/doctor/DoctorDashboardPage.js

import { Component } from "../../core/component.js";
import { h } from "../../utils/dom.js";

import DashboardHome from "./DashboardHome.js";
import ConsultationQueue from "./consultations/ConsultationQueue.js";
import PatientRecords from "./patients/PatientRecords.js";
import MessagingPage from "./messaging/MessagingPage.js";
import SettingsPage from "./settings/SettingsPage.js";
import DoctorProfilePage from "./settings/DoctorProfilePage.js";
import DoctorConsultationServicesPage from "./settings/DoctorConsultationServicesPage.js";
import DoctorSubscriptionPage from "./settings/DoctorSubscriptionPage.js";
import DoctorCardPage from "./settings/DoctorCardPage.js";
import api from "../../services/api.js";

// Loaded via <script src="https://cdn.socket.io/4.7.5/socket.io.min.js"></script>
// in index.html — `io` is a global, not an ES module import, since this is a
// no-bundler vanilla JS project. See patient-side wiring for the same pattern.
/* global io */
const SOCKET_BASE_URL = "https://doctors-consultation-backend.onrender.com";

export default class DoctorDashboardPage extends Component {

    constructor() {
        super();

        console.log("DoctorDashboardPage: constructor");

        this.activeTab = "home";
        this.settingsView = "menu";
        this.loading = true;
        this.doctor = null;

        this.socket = null;
        this.unreadMessageCount = 0;
        this._recentlySeenMessageIds = new Set();

        this._tabInstances = {};
        this._currentStaticInstance = null;
        this._tabWrappers = {};
        this.pendingConversation = null;

        this.tabs = [
            {
                id: "home",
                label: "Home",
                icon: "house"
            },
            {
                id: "consultations",
                label: "Queue",
                icon: "clipboard"
            },
            {
                id: "patients",
                label: "Patients",
                icon: "people"
            },
            {
                id: "messages",
                label: "Messages",
                icon: "chat"
            },
            {
                id: "settings",
                label: "Settings",
                icon: "gear"
            }
        ];

    }

    render() {

        console.log("DoctorDashboardPage: render()");

        return h(
            "div",
            {
                class: "doctor-dashboard"
            },

            h("div", { id: "doctor-payment-return-banner" }),

            h(
                "main",
                {
                    id: "doctor-dashboard-content",
                    class: "doctor-dashboard__content"
                },

                this.loading
                    ? h(
                        "div",
                        {
                            class: "dashboard-loading"
                        },
                        "Loading dashboard..."
                    )
                    : null

            ),

            this.renderBottomNavigation()

        );

    }

    afterMount() {

        console.log("DoctorDashboardPage: afterMount()");
        this.checkForPaymentReturn();
        this.loadDoctor();
        this.connectSocket();
        this.loadUnreadMessageCount();

    }

    async checkForPaymentReturn() {
        const params = new URLSearchParams(window.location.search);
        const reference = params.get("reference") || params.get("trxref");

        if (!reference) {
            return;
        }

        this.activeTab = "settings";
        this.settingsView = "subscription";

        try {
            const res = await api.get(`/subscription/verify/${encodeURIComponent(reference)}`);
            const subscription = res.data || res;

            const message = subscription.status === "active" || subscription.status === "paid"
                ? { type: "success", text: `Your ${subscription.plan_name || "subscription"} renewal is confirmed.` }
                : subscription.status === "past_due" || subscription.status === "suspended"
                    ? { type: "error", text: "Renewal could not be confirmed. Please try again." }
                    : { type: "info", text: "Your renewal is still processing. This will update shortly." };

            this.showPaymentReturnBanner(message);
        } catch (error) {
            console.error("Failed to verify subscription renewal on return:", error);
            this.showPaymentReturnBanner({ type: "error", text: "We couldn't confirm your renewal status. Please refresh in a moment." });
        } finally {
            window.history.replaceState({}, document.title, `${window.location.pathname}#/doctor/dashboard`);

            if (!this.loading) {
                this.updatePage();
            }
        }
    }

    showPaymentReturnBanner(message) {
        if (!this.el) return;

        const container = this.el.querySelector("#doctor-payment-return-banner");
        if (!container) return;

        const colors = { success: "#10b981", error: "#ef4444", info: "#0284c7" };

        container.replaceChildren(
            h(
                "div",
                { style: `padding: 0.75rem 1rem; background: ${colors[message.type]}; color: #fff; text-align: center; font-size: 0.85rem;` },
                message.text
            )
        );

        if (this._paymentBannerTimer) clearTimeout(this._paymentBannerTimer);
        this._paymentBannerTimer = setTimeout(() => {
            container.replaceChildren();
        }, 6000);
    }

    async loadUnreadMessageCount() {

        try {

            const res = await api.get("/chat/conversations");
            const payload = res.data || res;
            const conversations = Array.isArray(payload) ? payload : payload.rows || payload.data || [];

            const total = conversations.reduce((sum, c) => sum + (c.unread_count || 0), 0);

            this.unreadMessageCount = total;
            this.updateUnreadBadge();

        } catch (error) {

            console.error("Failed to load initial unread message count:", error);

        }

    }

    beforeUnmount() {

        this.socket?.disconnect();
        this._tabInstances?.messages?.unmount?.();
        this._currentStaticInstance?.unmount?.();
        if (this._paymentBannerTimer) clearTimeout(this._paymentBannerTimer);

    }
    // ---------- Realtime (WebSocket) ----------

    connectSocket() {

        const token = localStorage.getItem("accessToken");
        if (!token) return;

        this.socket = io(SOCKET_BASE_URL, {
            auth: { token },
            reconnection: true,
            reconnectionDelay: 1000,
            reconnectionDelayMax: 10000,
        });

        this.socket.on("connect_error", (err) => {
            console.error("Chat socket connection error:", err.message);
        });

        this.socket.on("message:new", (message) => {
            if (this._recentlySeenMessageIds.has(message.id)) return;
            this._recentlySeenMessageIds.add(message.id);

            // The doctor is the recipient whenever the patient sent it.
            const isForDoctor = message.sender_role === "patient";

            if (isForDoctor) {
                this.unreadMessageCount += 1;
                this.updateUnreadBadge();
            }

            // If the Messages tab is already cached/mounted, push the
            // message straight into it. If the doctor is actively viewing
            // that exact thread, PatientMessaging-equivalent logic there
            // will call onMessagesRead(1) right back, netting the badge
            // to zero change for that message — same pattern as the
            // patient-side implementation.
            this._tabInstances?.messages?.receiveIncomingMessage?.(message);
        });

    }

    onMessagesRead(count = 1) {
        this.unreadMessageCount = Math.max(0, this.unreadMessageCount - count);
        this.updateUnreadBadge();
    }

    // Nav bar is only rendered once (see renderBottomNavigation / updatePage,
    // which toggles classes via direct DOM manipulation rather than a full
    // re-render). We follow the same approach for the badge to avoid
    // rebuilding the whole nav on every message event.
    updateUnreadBadge() {
        if (!this.el) return;

        const wrap = this.el.querySelector('[data-tab-icon="messages"]');
        if (!wrap) return;

        let badge = wrap.querySelector(".doctor-bottom-nav__badge");

        if (this.unreadMessageCount > 0) {
            const text = this.unreadMessageCount > 9 ? "9+" : String(this.unreadMessageCount);
            if (!badge) {
                badge = document.createElement("span");
                badge.className = "doctor-bottom-nav__badge";
                wrap.appendChild(badge);
            }
            badge.textContent = text;
        } else if (badge) {
            badge.remove();
        }
    }

    async loadDoctor() {

        console.log("----------------------------------------");
        console.log("loadDoctor() called");
        console.log("Time:", new Date().toISOString());

        try {

            const token = localStorage.getItem("accessToken");

            console.log("Access Token Exists:", !!token);

            if (!token) {

                console.warn("No access token found.");

                window.location.hash = "/doctor/login";
                return;

            }

            console.log("Token (first 40 chars):");
            console.log(token.substring(0, 40) + "...");

            try {

                const payload = JSON.parse(
                    atob(token.split(".")[1])
                );

                console.log("Decoded JWT Payload:");
                console.table(payload);

                console.log(
                    "Issued At:",
                    new Date(payload.iat * 1000).toLocaleString()
                );

                console.log(
                    "Expires At:",
                    new Date(payload.exp * 1000).toLocaleString()
                );

                console.log(
                    "Current Time:",
                    new Date().toLocaleString()
                );

                console.log(
                    "Seconds Until Expiry:",
                    payload.exp - Math.floor(Date.now() / 1000)
                );

            } catch (err) {

                console.error("Could not decode JWT:", err);

            }

            console.log("Sending request to:");
            console.log(`/doctor-profile/me`);

            const result = await api.get("/doctor-profile/me");

            console.log("Doctor profile API response:");
            console.log(result);

            console.log("Doctor profile loaded successfully.");

            this.doctor = result.data.user || result.data;

            console.log("Doctor:");
            console.table(this.doctor);

        } catch (error) {

            console.error("----------------------------------------");
            console.error("Doctor profile request failed.");
            console.error(error);

            const cachedUser = localStorage.getItem("user");

            console.log("Cached User Exists:", !!cachedUser);

            if (cachedUser) {

                console.log("Using cached user.");

                this.doctor = JSON.parse(cachedUser);

                console.table(this.doctor);

            }

        } finally {

            console.log("Loading complete.");
            console.log("----------------------------------------");

            this.loading = false;

            this.updatePage();

        }

    }

    /**
     * Mounts the component for whichever tab/settings-view is currently
     * active into `container`.
     *
     * The Messages tab is cached: it lives in its own persistent wrapper
     * div that is only ever created once and then shown/hidden, so its
     * component instance (conversation list, open thread, etc.) survives
     * switching to other tabs and back — no refetch, no lost state, and
     * the socket keeps feeding it live messages regardless of which tab
     * is currently visible.
     *
     * All other tabs keep their original behaviour: freshly mounted into
     * a separate "static" wrapper every time the tab is selected.
     */
    mountCurrentPage(container) {

        console.log(
            "Mounting tab:",
            this.activeTab,
            "| Settings View:",
            this.settingsView,
            "| Loading:",
            this.loading
        );

        // Remove anything left over that isn't one of our managed wrappers —
        // most importantly the initial "Loading dashboard..." div from the
        // very first render(), which otherwise has nothing left to clear it
        // now that we append wrappers instead of using replaceChildren().
        Array.from(container.children).forEach(child => {
            if (!child.hasAttribute("data-static-wrapper") && !child.hasAttribute("data-tab-wrapper")) {
                child.remove();
            }
        });

        let staticWrapper = container.querySelector('[data-static-wrapper]');
        if (!staticWrapper) {
            staticWrapper = document.createElement("div");
            staticWrapper.dataset.staticWrapper = "true";
            container.appendChild(staticWrapper);
        }

        if (this.activeTab === "messages") {
            staticWrapper.style.display = "none";
            this.ensureMessagesTabMounted(container);
            this.showMessagesTab(true);
        } else {
            this.showMessagesTab(false);
            staticWrapper.style.display = "";
            this.mountStaticTab(staticWrapper);
        }

    }

    ensureMessagesTabMounted(container) {

        if (this._tabInstances.messages) {
            const wrapper = this._tabWrappers.messages;
            if (wrapper && wrapper.parentNode !== container) {
                container.appendChild(wrapper);
            }
            return;
        }

        const wrapper = document.createElement("div");
        wrapper.dataset.tabWrapper = "messages";
        container.appendChild(wrapper);
        this._tabWrappers.messages = wrapper;

        const instance = new MessagingPage(
            this.doctor,
            this.socket,
            (count) => this.onMessagesRead(count)
        );
        this._tabInstances.messages = instance;

        instance.mount(wrapper);

    }

    showMessagesTab(show) {
        const wrapper = this._tabWrappers.messages;
        if (wrapper) wrapper.style.display = show ? "" : "none";
    }

    mountStaticTab(staticWrapper) {

        if (this._currentStaticInstance) {
            this._currentStaticInstance.unmount();
            this._currentStaticInstance = null;
        }

        const navigateToTab = (tabId, settingsView = "menu") => {
            this.activeTab = tabId;
            this.settingsView = settingsView;
            this.updatePage();
        };

        switch (this.activeTab) {

            case "home":
                this._currentStaticInstance = new DashboardHome(this.doctor, (tabId, settingsView) => navigateToTab(tabId, settingsView));
                this._currentStaticInstance.mount(staticWrapper);
                break;

            case "consultations":
                this._currentStaticInstance = new ConsultationQueue(this.doctor, (conversation) => {
                    this.activeTab = "messages";
                    this.pendingConversation = conversation;
                    this.updatePage();
                });
                this._currentStaticInstance.mount(staticWrapper);
                break;

            case "patients":
                this._currentStaticInstance = new PatientRecords();
                this._currentStaticInstance.mount(staticWrapper);
                break;

            case "settings":
                if (this.settingsView === "profile") {
                    this._currentStaticInstance = new DoctorProfilePage(this.doctor, () => this.navigateSettings("menu"));
                    this._currentStaticInstance.mount(staticWrapper);
                } else if (this.settingsView === "consultation-services") {
                    this._currentStaticInstance = new DoctorConsultationServicesPage(this.doctor, () => this.navigateSettings("menu"));
                    this._currentStaticInstance.mount(staticWrapper);
                } else if (this.settingsView === "subscription") {
                    this._currentStaticInstance = new DoctorSubscriptionPage(this.doctor, () => this.navigateSettings("menu"));
                    this._currentStaticInstance.mount(staticWrapper);
                } else if (this.settingsView === "doctor-card") {
                    this._currentStaticInstance = new DoctorCardPage(this.doctor, () => this.navigateSettings("menu"));
                    this._currentStaticInstance.mount(staticWrapper);
                } else if (this.settingsView === "finance") {
                    staticWrapper.replaceChildren(this.renderFinanceComingSoon());
                } else {
                    this._currentStaticInstance = new SettingsPage(this.doctor, view => this.navigateSettings(view));
                    this._currentStaticInstance.mount(staticWrapper);
                }
                break;

            default:
                this._currentStaticInstance = new DashboardHome(this.doctor, (tabId, settingsView) => navigateToTab(tabId, settingsView));
                this._currentStaticInstance.mount(staticWrapper);

        }

    }

    navigateSettings(view) {

        this.settingsView = view;
        this.updatePage();

    }
    renderFinanceComingSoon() {
        return h(
            "div",
            { class: "dashboard-page" },
            h(
                "section",
                { class: "dashboard-header" },
                h(
                    "button",
                    {
                        class: "btn btn-outline",
                        style: "padding: 0.4rem 0.6rem; font-size: 0.8rem; border-radius: 6px; margin-bottom: 10px;",
                        onclick: () => this.navigateSettings("menu"),
                    },
                    "← Back"
                ),
                h("h1", { class: "dashboard-title" }, "Finance")
            ),
            h(
                "div",
                { class: "dashboard-card text-center py-4" },
                h("p", { class: "dashboard-muted" }, "Your earnings, payouts, and billing history."),
                h("p", { class: "dashboard-muted", style: "margin-top: 6px; font-size: 0.8rem;" }, "Coming soon.")
            )
        );
    }

    renderBottomNavigation() {

        return h(
            "nav",
            {
                class: "doctor-bottom-nav"
            },

            this.tabs.map(tab =>

                h(
                    "button",
                    {
                        class: `doctor-bottom-nav__item ${
                            this.activeTab === tab.id
                                ? "doctor-bottom-nav__item--active"
                                : ""
                        }`,

                        onclick: () => {
                            console.log("Switching to tab:", tab.id);
                            this.activeTab = tab.id;
                            this.settingsView = "menu";
                            this.updatePage();
                        }
                    },

                    h(
                        "span",
                        {
                            class: "doctor-bottom-nav__icon-wrap",
                            "data-tab-icon": tab.id
                        },
                        h(
                            "span",
                            {
                                class: `icon-${tab.icon} doctor-bottom-nav__icon`
                            }
                        ),
                        tab.id === "messages" && this.unreadMessageCount > 0
                            ? h(
                                "span",
                                { class: "doctor-bottom-nav__badge" },
                                this.unreadMessageCount > 9 ? "9+" : String(this.unreadMessageCount)
                            )
                            : null
                    ),

                    h(
                        "span",
                        {
                            class: "doctor-bottom-nav__label"
                        },
                        tab.label
                    )

                )

            )

        );

    }

    updatePage() {

        console.log("updatePage()");

        if (!this.el) {

            console.warn("this.el is null");
            return;

        }

        const container = this.el.querySelector(
            "#doctor-dashboard-content"
        );

        if (!container) {

            console.warn("Dashboard container not found.");
            return;

        }

        if (this.loading) {

            container.replaceChildren(
                h(
                    "div",
                    {
                        class: "dashboard-loading"
                    },
                    "Loading dashboard..."
                )
            );

        } else {

            this.mountCurrentPage(container);

        }

        const buttons = this.el.querySelectorAll(
            ".doctor-bottom-nav__item"
        );

        buttons.forEach((button, index) => {

            button.classList.toggle(
                "doctor-bottom-nav__item--active",
                this.tabs[index].id === this.activeTab
            );

        });

    }

}
