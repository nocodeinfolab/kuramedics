// js/components/doctor/settings/DoctorProfilePage.js

import { Component } from "../../../core/component.js";
import { h } from "../../../utils/dom.js";
import api from "../../../services/api.js";

export default class DoctorProfilePage extends Component {

    constructor() {

        super();

        this.loading = true;

        this.profile = {
            full_name: "",
            specialization: "",
            bio: "",
            years_of_experience: "",
            clinic_name: "",
            phone_number: "",
            mdcn_registration_number: "",
            consultation_fee: "",
            follow_up_fee: "",
            currency: "NGN",
            is_available: true,
            doctor_terms_accepted: false,
            avatar_url: null,
            verification_status: "unsubmitted",
            booking_link_path: null
        };

    }

    render() {

        return h(
            "div",
            {
                class: "dashboard-page"
            },

            this.renderHero(),

            this.loading
                ? this.renderLoading()
                : this.renderForm()

        );

    }

    afterMount() {

        this.loadProfile();

    }

    async loadProfile() {

        try {

            const result =
                await api.get("/doctor-profile/me");

            this.profile = {

                ...this.profile,

                ...result.data

            };

        }

        catch (error) {

            console.error(error);

            alert("Unable to load profile.");

        }

        finally {

            this.loading = false;

            this.update();

        }

    }

    renderLoading() {

        return h(
            "div",
            {
                class: "dashboard-card"
            },

            h(
                "p",
                {},
                "Loading profile..."
            )

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
                "Doctor Profile"
            ),

            h(
                "h1",
                {
                    class: "dashboard-title"
                },
                "Complete Your Profile"
            ),

            h(
                "p",
                {
                    class: "dashboard-subtitle"
                },
                "Patients see the information you provide here."
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
                    this.formatVerificationStatus(
                        this.profile.verification_status
                    )
                )

            )

        );

    }

    renderForm() {

        return h(

            "div",

            this.renderAvatarCard(),

            this.renderProfessionalCard()

        );

    }

    renderAvatarCard() {

        const avatar =
            this.profile.avatar_url;

        return h(

            "div",
            {
                class: "dashboard-card"
            },

            avatar ?

                h(
                    "img",
                    {
                        class: "settings-profile-avatar",
                        src: avatar,
                        alt: "Doctor Avatar"
                    }
                )

                :

                h(
                    "div",
                    {
                        class:
                            "settings-profile-avatar settings-profile-avatar--placeholder"
                    },

                    this.profile.full_name
                        ? this.profile.full_name.charAt(0)
                        : "D"

                ),

            h(
                "button",
                {
                    class: "btn btn-outline",
                    disabled: true
                },
                "Change Photo"
            )

        );

    }

    renderProfessionalCard() {

        return h(

            "div",
            {
                class: "dashboard-card"
            },

            h(
                "h2",
                {},
                "Professional Information"
            ),

            this.renderInput(
                "Full Name",
                "full_name"
            ),

            this.renderInput(
                "Specialization",
                "specialization"
            ),

            this.renderTextarea(
                "Bio",
                "bio"
            ),

            this.renderInput(
                "Years of Experience",
                "years_of_experience",
                "number"
            ),

            this.renderInput(
                "Clinic Name",
                "clinic_name"
            ),

            this.renderInput(
                "Phone Number",
                "phone_number"
            ),

            this.renderInput(
                "MDCN Registration Number",
                "mdcn_registration_number"
            ),

            this.renderInput(
                "Consultation Fee",
                "consultation_fee",
                "number"
            ),

            this.renderInput(
                "Follow-up Fee",
                "follow_up_fee",
                "number"
            )

        );

    }

    renderInput(label, field, type = "text") {

        return h(

            "div",
            {
                class: "form-group"
            },

            h(
                "label",
                {},
                label
            ),

            h(
                "input",
                {
                    type,
                    value: this.profile[field] ?? "",

                    oninput: e => {

                        this.profile[field] =
                            e.target.value;

                    }

                }
            )

        );

    }

    renderTextarea(label, field) {

        return h(

            "div",
            {
                class: "form-group"
            },

            h(
                "label",
                {},
                label
            ),

            h(
                "textarea",
                {
                    rows: 5,

                    oninput: e => {

                        this.profile[field] =
                            e.target.value;

                    }

                },

                this.profile[field] || ""

            )

        );

    }

    formatVerificationStatus(status) {

        switch (status) {

            case "verified":
                return "Verified";

            case "pending_review":
                return "Pending Review";

            case "suspended":
                return "Suspended";

            default:
                return "Unsubmitted";

        }

    }

}
