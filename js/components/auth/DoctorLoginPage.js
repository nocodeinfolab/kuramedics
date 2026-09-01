import { Component } from "../../core/component.js";
import { h } from "../../utils/dom.js";
import GoogleAuth from "./GoogleAuth.js";
import pushNotifications from "../../services/pushNotifications.js";
import api from "../../services/api.js";

const OTP_REQUEST_ENDPOINT = "/auth/otp/request";
const OTP_VERIFY_ENDPOINT = "/auth/otp/verify";
const RESEND_COOLDOWN_SECONDS = 30;

export class DoctorLoginPage extends Component {
  constructor(props) {
    super(props);

    // "google" | "otp-email" | "otp-code"
    this.view = "google";
    this.sentEmail = "";
    this.isNewAccount = false;
    this.loading = false;
    this.error = "";
    this.resendCooldown = 0;
    this._resendInterval = null;
  }

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
          h("span", { class: "auth-badge auth-badge--doctor" }, "For Doctors"),
          h("h1", { class: "auth-title" }, "Welcome back, Doctor"),
          h(
            "p",
            { class: "auth-subtitle" },
            "Sign in securely to manage your clinic, appointments, patients and earnings."
          )
        ),

        this.view === "google" && this.renderGoogleView(),
        this.view === "otp-email" && this.renderOtpEmailStep(),
        this.view === "otp-code" && this.renderOtpCodeStep(),

        h(
          "div",
          { class: "doctor-info" },
          h("h3", {}, "New to YerosCare?"),
          h(
            "p",
            {},
            "Signing in creates your doctor account. Afterward, you'll complete your professional profile, upload your MDCN licence and configure your consultation fees before your profile becomes visible to patients."
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
          h("a", { href: "#/", class: "auth-back" }, "← Back to Home")
        )
      )
    );
  }

  renderGoogleView() {
    return h(
      "div",
      { id: "google-auth-section" },
      h("div", { id: "google-login-btn", class: "google-btn-container" }),
      h(
        "p",
        { class: "auth-switch" },
        "Prefer a code? ",
        h(
          "a",
          {
            href: "#",
            class: "auth-link",
            onClick: (e) => {
              e.preventDefault();
              this.error = "";
              this.view = "otp-email";
              this.update();
            }
          },
          "Sign in with email instead"
        )
      )
    );
  }

  renderOtpEmailStep() {
    return h(
      "div",
      { id: "otp-auth-section" },
      h("label", { class: "auth-label", for: "otp-email" }, "Email address"),
      h("input", {
        type: "email",
        id: "otp-email",
        class: "auth-input",
        placeholder: "you@example.com",
        autocomplete: "email",
        onKeydown: (e) => {
          if (e.key === "Enter") this.handleSendCode();
        }
      }),
      h(
        "button",
        {
          type: "button",
          class: "auth-btn auth-btn--primary",
          disabled: this.loading,
          onClick: () => this.handleSendCode()
        },
        this.loading ? "Sending…" : "Send code"
      ),
      this.error && h("p", { class: "auth-error" }, this.error),
      h(
        "p",
        { class: "auth-switch" },
        h(
          "a",
          {
            href: "#",
            class: "auth-link",
            onClick: (e) => {
              e.preventDefault();
              this.error = "";
              this.view = "google";
              this.update();
              this.mountGoogleButton();
            }
          },
          "← Back to Google sign-in"
        )
      )
    );
  }

  renderOtpCodeStep() {
    return h(
      "div",
      { id: "otp-auth-section" },
      h(
        "p",
        { class: "auth-subtitle" },
        "Enter the 6-digit code sent to ",
        h("strong", {}, this.sentEmail)
      ),
      this.isNewAccount &&
        h(
          "p",
          { class: "auth-subtitle" },
          "We'll create your doctor account with this email — you can add your specialization, MDCN licence and consultation fees afterward."
        ),
      this.isNewAccount &&
        h(
          "div",
          {},
          h("label", { class: "auth-label", for: "otp-full-name" }, "Full name"),
          h("input", {
            type: "text",
            id: "otp-full-name",
            class: "auth-input",
            placeholder: "Dr. Jane Doe",
            autocomplete: "name",
            onKeydown: (e) => {
              if (e.key === "Enter") this.handleVerifyCode();
            }
          })
        ),
      h("input", {
        type: "text",
        id: "otp-code",
        class: "auth-input auth-input--code",
        placeholder: "123456",
        inputmode: "numeric",
        maxlength: "6",
        autocomplete: "one-time-code",
        onKeydown: (e) => {
          if (e.key === "Enter") this.handleVerifyCode();
        }
      }),
      h(
        "button",
        {
          type: "button",
          class: "auth-btn auth-btn--primary",
          disabled: this.loading,
          onClick: () => this.handleVerifyCode()
        },
        this.loading ? "Verifying…" : "Verify & sign in"
      ),
      this.error && h("p", { class: "auth-error" }, this.error),
      h(
        "p",
        { class: "auth-switch" },
        h(
          "a",
          {
            href: "#",
            id: "otp-resend-link",
            class: this.resendCooldown > 0 ? "auth-link auth-link--disabled" : "auth-link",
            onClick: (e) => {
              e.preventDefault();
              if (this.resendCooldown > 0) return;
              this.handleSendCode(this.sentEmail);
            }
          },
          this.resendCooldown > 0 ? `Resend code (${this.resendCooldown}s)` : "Resend code"
        ),
        " · ",
        h(
          "a",
          {
            href: "#",
            class: "auth-link",
            onClick: (e) => {
              e.preventDefault();
              this.error = "";
              this.view = "otp-email";
              this.update();
            }
          },
          "Use a different email"
        )
      )
    );
  }

  afterMount() {
    this.mountGoogleButton();
  }

  mountGoogleButton() {
    if (this.view !== "google") return;

    GoogleAuth.renderButton(
      "google-login-btn",
      "doctor",
      (user) => this.onAuthSuccess(user),
      (error) => {
        console.error("Doctor login failed:", error);
        alert(error.message || "Google sign-in failed.");
      }
    );
  }

  // Shared success handler for both Google and OTP login
  onAuthSuccess(user) {
    console.log("Doctor login successful.");
    console.log(user);

    pushNotifications.init((data) => {
      console.log("Notification tapped:", data);
      window.location.hash = "/doctor/dashboard";
    });

    window.location.hash = "/doctor/dashboard";
  }

  async handleSendCode(prefillEmail) {
    const email =
      prefillEmail || this.el.querySelector("#otp-email")?.value.trim() || "";

    this.error = "";

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      this.error = "Enter a valid email address.";
      this.update();
      return;
    }

    this.loading = true;
    this.update();

    try {
      const result = await api.post(OTP_REQUEST_ENDPOINT, { email, role: "doctor" });

      this.sentEmail = email;
      this.isNewAccount = !!result.data?.isNewAccount;
      this.view = "otp-code";
      this.loading = false;
      this.error = "";
      this.update();
      this.startResendCooldown();
    } catch (err) {
      console.error("OTP request failed:", err);
      this.loading = false;
      this.error = err.message || "Couldn't send the code. Try again.";
      this.update();
    }
  }

  async handleVerifyCode() {
    const code = this.el.querySelector("#otp-code")?.value.trim() || "";
    const fullName = this.isNewAccount
      ? this.el.querySelector("#otp-full-name")?.value.trim() || ""
      : "";

    this.error = "";

    if (!/^\d{6}$/.test(code)) {
      this.error = "Enter the 6-digit code.";
      this.update();
      return;
    }

    if (this.isNewAccount && !fullName) {
      this.error = "Enter your full name to create your account.";
      this.update();
      return;
    }

    this.loading = true;
    this.update();

    try {
      const result = await api.post(OTP_VERIFY_ENDPOINT, {
        email: this.sentEmail,
        otp: code,
        role: "doctor",
        ...(this.isNewAccount ? { full_name: fullName } : {})
      });

      const { accessToken, user } = result.data;

      api.setAccessToken(accessToken);
      localStorage.setItem("user", JSON.stringify(user));

      this.loading = false;
      this.onAuthSuccess(result.data);
    } catch (err) {
      console.error("OTP verify failed:", err);
      this.loading = false;
      this.error = err.message || "Invalid or expired code.";
      this.update();
    }
  }

  startResendCooldown() {
    clearInterval(this._resendInterval);
    this.resendCooldown = RESEND_COOLDOWN_SECONDS;

    this._resendInterval = setInterval(() => {
      this.resendCooldown -= 1;

      if (this.resendCooldown <= 0) {
        clearInterval(this._resendInterval);
        this.resendCooldown = 0;
      }

      // Only touch the countdown text directly — avoid a full re-render
      // (and losing focus on the code input) every second.
      const link = this.el?.querySelector("#otp-resend-link");
      if (!link) {
        clearInterval(this._resendInterval);
        return;
      }
      link.textContent =
        this.resendCooldown > 0 ? `Resend code (${this.resendCooldown}s)` : "Resend code";
      link.classList.toggle("auth-link--disabled", this.resendCooldown > 0);
    }, 1000);
  }

  beforeUnmount() {
    clearInterval(this._resendInterval);
  }
}
