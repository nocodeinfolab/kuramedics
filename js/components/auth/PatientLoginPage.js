import { Component } from "../../core/component.js";
import { h } from "../../utils/dom.js";
import GoogleAuth from "./GoogleAuth.js";
import pushNotifications from "../../services/pushNotifications.js";
import api from "../../services/api.js";

// Backend routes for authService.requestLoginOtp / verifyLoginOtp:
//   POST /auth/otp/request  { email, role } -> { message, isNewAccount }
//   POST /auth/otp/verify   { email, otp, role, full_name? } -> { message, data: { accessToken, user } }
const OTP_REQUEST_ENDPOINT = "/auth/otp/request";
const OTP_VERIFY_ENDPOINT = "/auth/otp/verify";
const RESEND_COOLDOWN_SECONDS = 30;
const OTP_DIGIT_COUNT = 6;

const EnvelopeIcon = () =>
  h(
    "svg",
    { class: "auth-input-icon", viewBox: "0 0 24 24", fill: "none", "aria-hidden": "true" },
    h("path", {
      d: "M3 6.5 12 13l9-6.5M4 5h16a1 1 0 0 1 1 1v12a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1Z",
      stroke: "currentColor",
      "stroke-width": "1.6",
      "stroke-linecap": "round",
      "stroke-linejoin": "round"
    })
  );

const ArrowIcon = () =>
  h(
    "svg",
    { class: "auth-btn-icon", viewBox: "0 0 24 24", fill: "none", "aria-hidden": "true" },
    h("path", {
      d: "M5 12h14M13 6l6 6-6 6",
      stroke: "currentColor",
      "stroke-width": "1.8",
      "stroke-linecap": "round",
      "stroke-linejoin": "round"
    })
  );

export class PatientLoginPage extends Component {
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

    // Inputs are re-created (not patched) on every update(), so their
    // values live here in state and get handed back as `value` on
    // render — otherwise a re-render mid-typing or after an error wipes
    // whatever the person already entered.
    this.emailValue = "";
    this.fullNameValue = "";
    this.otpDigits = Array(OTP_DIGIT_COUNT).fill("");
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
          h("span", { class: "auth-badge" }, "For patients"),
          h("h1", { class: "auth-title" }, "Welcome to YerosCare"),
          h(
            "p",
            { class: "auth-subtitle" },
            "Sign in to begin AI triage, manage appointments and access your medical records."
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
            "Signing in creates your patient account automatically — you can start a triage or book an appointment right away."
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
          h("a", { href: "#/", class: "auth-back" }, "Back to Home")
        )
      )
    );
  }

  renderGoogleView() {
    return h(
      "div",
      { id: "google-auth-section" },
      h(
        "div",
        { class: "google-btn-container" },
        h("div", { id: "google-login-btn" })
      ),
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
      { id: "otp-auth-section", class: "otp-auth-section" },
      h(
        "div",
        { class: "otp-step-intro" },
        h("p", { class: "auth-subtitle" }, "We'll email you a 6-digit code to sign in.")
      ),
      h(
        "div",
        { class: "auth-input-group" },
        h("label", { class: "sr-only", for: "otp-email" }, "Email address"),
        EnvelopeIcon(),
        h("input", {
          type: "email",
          id: "otp-email",
          class: "auth-input",
          placeholder: "you@example.com",
          autocomplete: "email",
          value: this.emailValue,
          onInput: (e) => {
            this.emailValue = e.target.value;
          },
          onKeydown: (e) => {
            if (e.key === "Enter") this.handleSendCode();
          }
        })
      ),
      h(
        "button",
        {
          type: "button",
          class: "auth-btn auth-btn--primary auth-btn--icon",
          disabled: this.loading,
          onClick: () => this.handleSendCode()
        },
        h("span", {}, this.loading ? "Sending…" : "Send code"),
        !this.loading && ArrowIcon()
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
    const digitInput = (index) =>
      h("input", {
        type: "text",
        id: `otp-digit-${index + 1}`,
        class: "otp-code-digit",
        inputmode: "numeric",
        pattern: "[0-9]*",
        maxlength: "1",
        autocomplete: index === 0 ? "one-time-code" : "off",
        value: this.otpDigits[index],
        onInput: (e) => this.handleOtpDigitInput(e, index),
        onKeydown: (e) => this.handleOtpDigitKeydown(e, index)
      });

    return h(
      "div",
      { id: "otp-auth-section", class: "otp-auth-section" },
      h(
        "div",
        { class: "otp-step-intro" },
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
            "We'll create your patient account with this email."
          )
      ),
      this.isNewAccount &&
        h(
          "div",
          { class: "otp-name-field" },
          h("label", { class: "auth-label", for: "otp-full-name" }, "Full name"),
          h("input", {
            type: "text",
            id: "otp-full-name",
            class: "auth-input",
            placeholder: "Jane Doe",
            autocomplete: "name",
            value: this.fullNameValue,
            onInput: (e) => {
              this.fullNameValue = e.target.value;
            },
            onKeydown: (e) => {
              if (e.key === "Enter") this.handleVerifyCode();
            }
          })
        ),
      h(
        "div",
        {
          class: "otp-code-group",
          onPaste: (e) => this.handleOtpPaste(e)
        },
        ...Array.from({ length: OTP_DIGIT_COUNT }, (_, i) => digitInput(i))
      ),
      h(
        "button",
        {
          type: "button",
          class: "auth-btn auth-btn--primary auth-btn--icon",
          disabled: this.loading,
          onClick: () => this.handleVerifyCode()
        },
        h("span", {}, this.loading ? "Verifying…" : "Verify & sign in"),
        !this.loading && ArrowIcon()
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
              this.otpDigits = Array(OTP_DIGIT_COUNT).fill("");
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
      "patient",
      (user) => this.onAuthSuccess(user),
      (error) => {
        console.error("Patient login failed:", error);
        alert(error.message || "Google sign-in failed.");
      }
    );
  }

  onAuthSuccess(user) {
    console.log("Patient login successful.");
    console.log(user);

    pushNotifications.init((data) => {
      console.log("Notification tapped:", data);
      window.location.hash = "/patient/dashboard";
    });

    window.location.hash = "/patient/dashboard";
  }

  // ---------- Segmented OTP digit boxes ----------

  getOtpCode() {
    return this.otpDigits.join("");
  }

  focusOtpDigit(index) {
    // Deferred: after handleSendCode() flips the view and calls update(),
    // the code-step markup may not exist in the DOM yet on this tick.
    setTimeout(() => {
      this.el?.querySelector(`#otp-digit-${index + 1}`)?.focus();
    }, 0);
  }

  handleOtpDigitInput(e, index) {
    const digit = e.target.value.replace(/\D/g, "").slice(-1);
    e.target.value = digit;
    this.otpDigits[index] = digit;

    if (digit && index < OTP_DIGIT_COUNT - 1) {
      this.el.querySelector(`#otp-digit-${index + 2}`)?.focus();
    }
  }

  handleOtpDigitKeydown(e, index) {
    if (e.key === "Backspace" && !e.target.value && index > 0) {
      const prev = this.el.querySelector(`#otp-digit-${index}`);
      if (prev) {
        prev.value = "";
        this.otpDigits[index - 1] = "";
        prev.focus();
      }
    } else if (e.key === "Enter") {
      this.handleVerifyCode();
    }
  }

  handleOtpPaste(e) {
    const text = (e.clipboardData || window.clipboardData)
      .getData("text")
      .replace(/\D/g, "")
      .slice(0, OTP_DIGIT_COUNT);

    if (!text) return;
    e.preventDefault();

    const digits = this.el.querySelectorAll(".otp-code-digit");
    text.split("").forEach((digit, i) => {
      if (digits[i]) digits[i].value = digit;
      this.otpDigits[i] = digit;
    });
    digits[Math.min(text.length, OTP_DIGIT_COUNT) - 1]?.focus();
  }

  // ---------- Network calls ----------

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
      const result = await api.post(OTP_REQUEST_ENDPOINT, { email, role: "patient" });

      this.sentEmail = email;
      this.isNewAccount = !!result.data?.isNewAccount;
      this.view = "otp-code";
      this.otpDigits = Array(OTP_DIGIT_COUNT).fill("");
      this.fullNameValue = "";
      this.error = "";
      this.startResendCooldown();
      this.focusOtpDigit(0);
    } catch (err) {
      console.error("OTP request failed:", err);
      this.error = err.message || "Couldn't send the code. Try again.";
    } finally {
      this.loading = false;
      this.update();
    }
  }

  async handleVerifyCode() {
    const code = this.getOtpCode();
    const fullName = this.isNewAccount ? this.fullNameValue.trim() : "";

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
        role: "patient",
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
