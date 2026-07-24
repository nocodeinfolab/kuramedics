// js/components/doctor/settings/SettingsPage.js

import { Component } from "../../../core/component.js";
import { h } from "../../../utils/dom.js";

export default class SettingsPage extends Component {

    render() {

        return h(
            "div",
            {
                class: "dashboard-page settings-page"
            },

            this.renderHero(),

            this.renderMenu()

        );

    }

    renderHero() {

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
                "Doctor Account"
            ),

            h(
                "h1",
                {
                    class: "dashboard-title"
                },
                "Settings"
            ),

            h(
                "p",
                {
                    class: "dashboard-subtitle"
                },
                "Manage your professional profile, subscription, security and account preferences."
            ),

            h(
                "div",
                {
                    class: "dashboard-hero-meta"
                },

                h(
                    "span",
                    {
                        class: "dashboard-badge"
                    },
                    "Profile"
                ),

                h(
                    "span",
                    {
                        class: "dashboard-badge"
                    },
                    "Subscription"
                ),

                h(
                    "span",
                    {
                        class: "dashboard-badge"
                    },
                    "Security"
                )

            )

        );

    }

    renderMenu() {

        return h(
            "div",

            this.renderMenuCard(
                "Profile",
                "Manage your personal and professional information.",
                "person",
                () => {
                    window.location.hash = "/doctor/settings/profile";
                }
            ),

            this.renderMenuCard(
                "Subscription",
                "View your plan, billing and subscription status.",
                "wallet",
                () => {
                    window.location.hash = "/doctor/settings/subscription";
                }
            ),

            this.renderMenuCard(
                "Security",
                "Password, login sessions and account protection.",
                "gear",
                () => {
                    window.location.hash = "/doctor/settings/security";
                }
            )

        );

    }

    renderMenuCard(title, description, icon, onclick) {

        return h(
            "button",
            {
                class: "dashboard-card settings-menu-card",
                onclick
            },

            h(
                "div",
                {
                    class: "settings-menu-card__content"
                },

                h(
                    "div",
                    {
                        class: "settings-menu-card__icon"
                    },

                    h(
                        "span",
                        {
                            class: `icon-${icon}`
                        }
                    )

                ),

                h(
                    "div",
                    {
                        class: "settings-menu-card__text"
                    },

                    h(
                        "h3",
                        {},
                        title
                    ),

                    h(
                        "p",
                        {
                            class: "dashboard-muted"
                        },
                        description
                    )

                ),

                h(
                    "span",
                    {
                        class: "settings-menu-card__arrow"
                    },
                    "›"
                )

            )

        );

    }

}
