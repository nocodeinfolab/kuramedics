import { Component } from "../../core/component.js";
import { h } from "../../utils/dom.js";
import GoogleAuth from "./GoogleAuth.js";
import pushNotifications from "../../services/pushNotifications.js";

export class PatientLoginPage extends Component {
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

          h("span", { class: "auth-badge" }, "For Patients"),

          h(
            "h1",
            { class: "auth-title" },
            "Welcome to YerosCare"
          ),

          h(
            "p",
            { class: "auth-subtitle" },
            "Sign in securely with your Google account to begin AI triage, manage appointments and access your medical records."
          )
        ),

        h("div", {
          id: "google-login-btn",
          class: "google-btn-container"
        }),

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
      "patient",
      (user) => {
          console.log("Patient login successful.");
          console.log(user);
      
          // Runs after a tap on a background/killed-app notification.
          // `data` is whatever custom payload the backend sent (see
          // notifications.controller.js) — route further once you decide
          // what that payload looks like for each notification type.
          pushNotifications.init((data) => {
            console.log("Notification tapped:", data);
            window.location.hash = "/patient/dashboard";
          });
      
          window.location.hash = "/patient/dashboard";
      },
      (error) => {
        console.error("Patient login failed:", error);
        alert(error.message || "Google sign-in failed.");
      }
    );
  }
}
