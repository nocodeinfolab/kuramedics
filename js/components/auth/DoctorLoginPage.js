import { Component } from "../../core/component.js";
import { h } from "../../utils/dom.js";
import GoogleAuth from "./GoogleAuth.js";
import pushNotifications from "../../services/pushNotifications.js";
import api from "../../services/api.js";

// Backend routes for authService.requestLoginOtp / verifyLoginOtp:
//   POST /auth/otp/request  { email, role } -> { message, isNewAccount }
//   POST /auth/otp/verify   { email, otp, role, full_name? } -> { message, data: { accessToken, user } }
// full_name is only required when requestLoginOtp came back isNewAccount:
// true — same envelope shape GoogleAuth.handleCredential already expects.
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
      { class: "auth-page auth-page--split" },
      h(
        "section",
        { class: "auth-panel" },
        h(
          "div",
          { class: "auth-panel__mark" },
          h("span", {}, "YerosCare")
        ),
        h(
          "div",
          { class: "auth-panel__body" },
          h(
            "p",
            { class: "auth-panel__quote" },
            "Built so a clinic can run itself — bookings, patients and earnings, in one place."
          ),
          h(
            "div",
            { class: "auth-panel__stats" },
            h(
              "div",
              { class: "auth-panel__stat" },
              h("strong", {}, "MDCN-verified"),
              h("span", {}, "every doctor profile")
            ),
            h(
              "div",
              { class: "auth-panel__stat" },
              h("strong", {}, "Your fees"),
              h("span", {}, "you set the terms")
            )
          )
        ),
        h("div", { class: "auth-panel__motif", "aria-hidden": "true" },
          h(
            "svg",
            { viewBox: "0 0 400 120", preserveAspectRatio: "none" },
            h("path", {
              d: "M0,80 L70,80 L95,20 L120,110 L145,55 L170,80 L400,80",
              fill: "none",
              stroke: "currentColor",
              "stroke-width": "1.25"
            })
          )
        )
      ),
      h(
        "section",
        { class: "auth-content" },
        h(
          "div",
          { class: "auth-content__inner" },
          h(
            "div",
            { class: "auth-topbar" },
            h("a", { href: "#/", class: "auth-back" }, "← Back to home"),
            h("span", { class: "auth-badge auth-badge--doctor" }, "For doctors")
          ),

          h(
            "div",
            { class: "auth-header" },
            h("h1", { class: "auth-title" }, "Welcome back, doctor"),
            h(
              "p",
              { class: "auth-subtitle" },
              "Sign in to manage your clinic, appointments, patients and earnings."
            )
          ),

          h(
            "div",
            { class: "auth-step", key: this.view },
            this.view === "google" && this.renderGoogleView(),
            this.view === "otp-email" && this.renderOtpEmailStep(),
            this.view === "otp-code" && this.renderOtpCodeStep()
          ),

          h(
            "div",
            { class: "auth-info" },
            h("h3", {}, "New to YerosCare?"),
            h(
              "p",
              {},
              "Signing in creates your doctor account. Afterward, you'll complete your professional profile, upload your MDCN licence and set your consultation fees before patients can find you."
            )
          ),

          h(
            "p",
            { class: "auth-fineprint" },
            "By continuing, you agree to our Terms of Service and Privacy Policy."
          )
        )
      )
    );
  }

  renderGoogleView() {
    return h(
      "div",
      { id: "google-auth-section", class: "auth-view" },
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
      { id: "otp-auth-section", class: "auth-view" },
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
      { id: "otp-auth-section", class: "auth-view" },
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
          "We'll create your doctor account with this email — specialization, MDCN licence and consultation fees come next."
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
        placeholder: "······",
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
      this.error = "";
      this.startResendCooldown();
    } catch (err) {
      console.error("OTP request failed:", err);
      this.error = err.message || "Couldn't send the code. Try again.";
    } finally {
      this.loading = false;
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

      this.onAuthSuccess(result.data);
    } catch (err) {
      console.error("OTP verify failed:", err);
      this.error = err.message || "Invalid or expired code.";
    } finally {
      this.loading = false;
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
