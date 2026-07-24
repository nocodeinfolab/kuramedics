// js/components/doctor/DoctorDashboardPage.js

import { Component } from "../../core/component.js";
import { h } from "../../utils/dom.js";

import DashboardHome from "./DashboardHome.js";
import ConsultationQueue from "./consultations/ConsultationQueue.js";
import PatientRecords from "./patients/PatientRecords.js";
import MessagingPage from "./messaging/MessagingPage.js";
import FinancialSummary from "./finance/FinancialSummary.js";
import SettingsPage from "./settings/SettingsPage.js";
import api from "../../services/api.js";

export default class DoctorDashboardPage extends Component {

    constructor() {

        super();

        console.log("DoctorDashboardPage: constructor");

        this.activeTab = "home";
        this.loading = true;
        this.doctor = null;

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
                id: "finance",
                label: "Finance",
                icon: "wallet"
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

            h(
                "main",
                {
                    id: "doctor-dashboard-content",
                    class: "doctor-dashboard__content"
                },
                this.renderCurrentPage()
            ),

            this.renderBottomNavigation()

        );

    }

    afterMount() {

        console.log("DoctorDashboardPage: afterMount()");
        this.loadDoctor();

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

    renderCurrentPage() {

        console.log(
            "Rendering tab:",
            this.activeTab,
            "| Loading:",
            this.loading
        );

        if (this.loading) {

            return h(
                "div",
                {
                    class: "dashboard-loading"
                },
                "Loading dashboard..."
            );

        }

        switch (this.activeTab) {

            case "home":
                return new DashboardHome(this.doctor).render();

            case "consultations":
                return new ConsultationQueue().render();

            case "patients":
                return new PatientRecords().render();

            case "messages":
                return new MessagingPage().render();

            case "finance":
                return new FinancialSummary().render();

            case "settings":
                return new SettingsPage().render();

            default:
                return new DashboardHome(this.doctor).render();

        }

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

                            console.log(
                                "Switching to tab:",
                                tab.id
                            );

                            this.activeTab = tab.id;

                            this.updatePage();

                        }
                    },

                    h(
                        "span",
                        {
                            class: `icon-${tab.icon} doctor-bottom-nav__icon`
                        }
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

        container.replaceChildren(
            this.renderCurrentPage()
        );

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
