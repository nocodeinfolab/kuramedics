// js/components/doctor/DashboardHome.js

import { Component } from "../../core/component.js";
import { h } from "../../utils/dom.js";

export default class DashboardHome extends Component {

    constructor(doctor = null) {
        super();
        this.doctor = doctor || {};
    }

    render() {

        return h(
            "div",
            {
                class: "doctor-home"
            },

            this.renderHeader(),

            this.renderStatistics(),

            this.renderSubscription(),

            this.renderVerification(),

            this.renderQuickActions(),

            this.renderRecentActivity()

        );

    }

    renderHeader() {

        return h(
            "section",
            {
                class: "dashboard-section"
            },

            h(
                "div",
                {
                    class: "dashboard-header"
                },

                h(
                    "div",
                    {},

                    h(
                        "p",
                        {
                            class: "dashboard-greeting"
                        },
                        "Welcome back"
                    ),

                    h(
                        "h1",
                        {
                            class: "dashboard-title"
                        },
                        this.doctor.full_name || "Doctor"
                    )

                )

            )

        );

    }

    renderStatistics() {

        return h(
            "section",
            {
                class: "dashboard-section stats-grid"
            },

            this.statCard(
                "Today's Queue",
                "0"
            ),

            this.statCard(
                "Patients",
                "0"
            ),

            this.statCard(
                "Unread",
                "0"
            ),

            this.statCard(
                "Earnings",
                "₦0"
            )

        );

    }

    renderSubscription() {

        return h(
            "section",
            {
                class: "dashboard-card"
            },

            h(
                "h3",
                {},
                "Subscription"
            ),

            h(
                "p",
                {},
                this.doctor.subscription_plan_name || "Starter"
            ),

            h(
                "p",
                {
                    class: "dashboard-muted"
                },
                this.doctor.subscription_status || "Active"
            )

        );

    }

    renderVerification() {

        return h(
            "section",
            {
                class: "dashboard-card"
            },

            h(
                "h3",
                {},
                "Verification"
            ),

            h(
                "p",
                {},
                this.doctor.verification_status || "Pending"
            )

        );

    }

    renderQuickActions() {

        return h(
            "section",
            {
                class: "dashboard-card"
            },

            h(
                "h3",
                {},
                "Quick Actions"
            ),

            h(
                "div",
                {
                    class: "quick-actions"
                },

                this.actionButton(
                    "Edit Profile"
                ),

                this.actionButton(
                    "Consultation Fees"
                ),

                this.actionButton(
                    "Availability"
                ),

                this.actionButton(
                    "Booking Link"
                )

            )

        );

    }

    renderRecentActivity() {

        return h(
            "section",
            {
                class: "dashboard-card"
            },

            h(
                "h3",
                {},
                "Recent Activity"
            ),

            h(
                "p",
                {
                    class: "dashboard-muted"
                },
                "No recent activity."
            )

        );

    }

    statCard(title, value) {

        return h(
            "div",
            {
                class: "stat-card"
            },

            h(
                "div",
                {
                    class: "stat-value"
                },
                value
            ),

            h(
                "div",
                {
                    class: "stat-label"
                },
                title
            )

        );

    }

    actionButton(label) {

        return h(
            "button",
            {
                class: "btn btn-outline"
            },
            label
        );

    }

}
