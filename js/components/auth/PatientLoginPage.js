import { Component } from "../../core/component.js";
import { h } from "../../utils/dom.js";

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
          h("h1", { class: "auth-title" }, "Welcome to KuraMedics"),
          h(
            "p",
            { class: "auth-subtitle" },
            "Sign in securely with your Google account to begin AI triage, manage appointments and access your medical records."
          )
        ),

        h(
          "button",
          {
            id: "google-login-btn",
            class: "google-btn",
            type: "button",
          },

          h(
            "svg",
            {
              width: "20",
              height: "20",
              viewBox: "0 0 48 48",
              "aria-hidden": "true",
            },
            h("path", {
              fill: "#EA4335",
              d: "M24 9.5c3.54 0 6.72 1.22 9.22 3.61l6.87-6.87C35.91 2.43 30.35 0 24 0 14.64 0 6.57 5.38 2.62 13.22l8 6.22C12.56 13.58 17.82 9.5 24 9.5z",
            }),
            h("path", {
              fill: "#4285F4",
              d: "M46.5 24.5c0-1.64-.14-2.86-.45-4.13H24v8.13h12.94c-.26 2.02-1.67 5.06-4.81 7.11l7.42 5.76C43.87 37.38 46.5 31.62 46.5 24.5z",
            }),
            h("path", {
              fill: "#FBBC05",
              d: "M10.62 28.56A14.52 14.52 0 0 1 9.86 24c0-1.58.27-3.11.76-4.56l-8-6.22A23.96 23.96 0 0 0 0 24c0 3.87.92 7.53 2.62 10.78l8-6.22z",
            }),
            h("path", {
              fill: "#34A853",
              d: "M24 48c6.35 0 11.68-2.09 15.57-5.69l-7.42-5.76c-2 1.39-4.68 2.36-8.15 2.36-6.18 0-11.44-4.08-13.38-9.94l-8 6.22C6.57 42.62 14.64 48 24 48z",
            })
          ),

          h("span", {}, "Continue with Google")
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
              class: "auth-back",
            },
            "← Back to Home"
          )
        )
      )
    );
  }

  afterMount() {
    document
      .getElementById("google-login-btn")
      .addEventListener("click", () => {
        this.loginWithGoogle();
      });
  }

  async loginWithGoogle() {
    console.log("Start Google login for patient...");
  }
}
