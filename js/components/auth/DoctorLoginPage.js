import { Component } from "../../core/component.js";
import { h } from "../../utils/dom.js";
import GoogleAuth from "./GoogleAuth.js";

export class DoctorLoginPage extends Component {
  render() {
    return h(
      "main",
      { class: "auth-page" },

      h(
        "div",
        { class: "auth-card" },

        h(
          "div",
          { class: "auth-header" },

          h(
            "span",
            { class: "auth-badge auth-badge--doctor" },
            "For Doctors"
          ),

          h(
            "h1",
            { class: "auth-title" },
            "Welcome back, Doctor"
          ),

          h(
            "p",
            { class: "auth-subtitle" },
            "Sign in securely with your Google account to manage your clinic, appointments, patients and earnings."
          )
        ),

        h("div", {
          id: "google-login-btn",
          class: "google-btn-container"
        }),

        h(
          "div",
          { class: "doctor-info" },

          h("h3", {}, "New to KuraMedics?"),

          h(
            "p",
            {},
            "Your Google account creates your doctor account. After signing in, you'll complete your professional profile, upload your MDCN licence and configure your consultation fees before your profile becomes visible to patients."
          )
        ),

        h(
          "p",
          { class: "auth-note" },
          "By continuing, you agree to our Terms of Service and Privacy Policy."
        ),

        h(
          "div",
          { class: "auth-footer" },

          h(
            "a",
            {
              href: "#/",
              class: "auth-back"
            },
            "← Back to Home"
          )
        )
      )
    );
  }

  afterMount() {
    GoogleAuth.renderButton(
      "google-login-btn",
      "doctor",
      (user) => {
        console.log("Doctor login successful.");
        console.log(user);

        window.location.hash = "/doctor/dashboard";
      },
      (error) => {
        console.error("Doctor login failed:", error);

        alert(error.message || "Google sign-in failed.");
      }
    );
  }
}
