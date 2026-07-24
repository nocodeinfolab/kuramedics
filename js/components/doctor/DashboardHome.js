// js/components/doctor/DashboardHome.js

import { Component } from "../../core/component.js";
import { h } from "../../utils/dom.js";

export default class DashboardHome extends Component {

    constructor(doctor = {}) {
        super();
        this.doctor = doctor;
    }

    render() {
        return h(
            "div",
            {
                class: "doctor-home"
            },

            this.renderHero(),

            this.renderStatistics(),

            this.renderSubscription(),

            this.renderVerification(),

            this.renderQuickActions(),

            this.renderRecentActivity()
        );
    }

    renderHero() {

        const firstName =
            this.doctor.full_name?.split(" ")[0] || "Doctor";

        return h(
            "section",
            {
                class: "dashboard-header"
            },

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
                `Dr. ${firstName}`
            ),

            h(
                "p",
                {
                    class: "dashboard-subtitle"
                },
                this.doctor.specialization ||
                "Complete your professional profile to start receiving bookings."
            ),

            h(
                "div",
                {
                    class: "dashboard-hero-meta"
                },

                this.badge(
                    this.doctor.verification_status || "Verification Pending"
                ),

                this.badge(
                    this.doctor.subscription_plan_name || "Starter Plan"
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
                {
                    class: "dashboard-value"
                },
                this.doctor.subscription_plan_name || "Starter"
            ),

            h(
                "p",
                {
                    class: "dashboard-muted"
                },
                `Status: ${this.doctor.subscription_status || "Active"}`
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
                {
                    class: "dashboard-value"
                },
                this.doctor.verification_status || "Pending"
            ),

            h(
                "p",
                {
                    class: "dashboard-muted"
                },
                "Verified doctors appear higher in patient search results."
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

                this.actionButton("Edit Profile"),

                this.actionButton("Consultation Fees"),

                this.actionButton("Availability"),

                this.actionButton("Booking Link")
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
                "No recent activity yet."
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

    badge(text) {

        return h(
            "span",
            {
                class: "dashboard-badge"
            },
            text
        );
    }

}
