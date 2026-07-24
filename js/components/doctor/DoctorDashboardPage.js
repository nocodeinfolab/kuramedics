// js/components/doctor/DoctorDashboardPage.js

import { Component } from "../../core/component.js";
import { h } from "../../utils/dom.js";

import DashboardHome from "./DashboardHome.js";
import ConsultationQueue from "./consultations/ConsultationQueue.js";
import PatientRecords from "./patients/PatientRecords.js";
import MessagingPage from "./messaging/MessagingPage.js";
import FinancialSummary from "./finance/FinancialSummary.js";
import SettingsPage from "./settings/SettingsPage.js";

const API_BASE_URL =
    "https://doctors-consultation-backend.onrender.com/api/v1";

export default class DoctorDashboardPage extends Component {

    constructor() {
        super();

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
        this.loadDoctor();
    }

    async loadDoctor() {

        try {

            const token = localStorage.getItem("accessToken");

            if (!token) {
                window.location.hash = "/doctor/login";
                return;
            }

            const response = await fetch(
                `${API_BASE_URL}/doctor-profile/me`,
                {
                    headers: {
                        Authorization: `Bearer ${token}`
                    }
                }
            );

            const result = await response.json();

            if (!response.ok) {
                throw new Error(result.message || "Unable to load doctor profile.");
            }

            this.doctor = result.data;

        } catch (error) {

            console.error("Failed to load doctor profile:", error);

            const cachedUser = localStorage.getItem("user");

            if (cachedUser) {
                this.doctor = JSON.parse(cachedUser);
            }

        } finally {

            this.loading = false;

            this.updatePage();

        }

    }

    renderCurrentPage() {

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

        if (!this.el) {
            return;
        }

        const container = this.el.querySelector(
            "#doctor-dashboard-content"
        );

        if (!container) {
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
