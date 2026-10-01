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

const PATIENT_ILLUSTRATION_SRC = "/assets/patient_illustration.png";

const EnvelopeIcon = (cls = "provider-btn-icon") =>
  h(
    "svg",
    { class: cls, viewBox: "0 0 24 24", fill: "none", "aria-hidden": "true" },
    h("path", {
      d: "M3.5 6.5h17a1 1 0 0 1 1 1v9a1 1 0 0 1-1 1h-17a1 1 0 0 1-1-1v-9a1 1 0 0 1 1-1zM3 7l9 6.5L21 7",
      stroke: "currentColor",
      "stroke-width": "1.8",
      "stroke-linecap": "round",
      "stroke-linejoin": "round"
    })
  );

const AppleIcon = () =>
  h(
    "svg",
    { class: "provider-btn-icon", viewBox: "0 0 24 24", "aria-hidden": "true" },
    h("path", {
      fill: "currentColor",
      d: "M12.152 6.896c-.948 0-2.415-1.078-3.96-1.04-2.04.027-3.91 1.183-4.961 3.014-2.117 3.675-.546 9.103 1.519 12.09 1.013 1.454 2.208 3.09 3.792 3.03 1.52-.06 2.098-.98 3.938-.98 1.837 0 2.35.98 3.96.95 1.637-.03 2.676-1.48 3.676-2.94 1.156-1.687 1.636-3.32 1.666-3.404-.036-.017-3.19-1.226-3.223-4.86-.028-3.036 2.478-4.49 2.59-4.554-1.42-2.08-3.617-2.31-4.39-2.36-2-.16-3.67 1.083-4.62 1.083zm3.42-3.11c.837-1.012 1.4-2.42 1.25-3.83-1.21.05-2.68.81-3.55 1.82-.78.9-1.46 2.33-1.28 3.7 1.34.1 2.72-.68 3.58-1.7z"
    })
  );

const StethoscopeIcon = () =>
  h(
    "svg",
    { class: "auth-hero-fallback-icon", viewBox: "0 0 24 24", fill: "none", "aria-hidden": "true" },
    h("path", { d: "M5 3H4a2 2 0 0 0-2 2v4a6 6 0 0 0 12 0V5a2 2 0 0 0-2-2h-1", stroke: "currentColor", "stroke-width": "1.6", "stroke-linecap": "round", "stroke-linejoin": "round" }),
    h("path", { d: "M11 2v2", stroke: "currentColor", "stroke-width": "1.6", "stroke-linecap": "round" }),
    h("path", { d: "M5 2v2", stroke: "currentColor", "stroke-width": "1.6", "stroke-linecap": "round" }),
    h("path", { d: "M8 15a6 6 0 0 0 12 0v-3", stroke: "currentColor", "stroke-width": "1.6", "stroke-linecap": "round", "stroke-linejoin": "round" }),
    h("circle", { cx: "20", cy: "10", r: "2", stroke: "currentColor", "stroke-width": "1.6" })
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
    this._focusTimeout = null;
    this._illustrationFailed = false;

    // Inputs are re-created (not patched) on every update(), so their
    // values live here in state and get handed back as `value` on
    // render — otherwise a re-render mid-typing or after an error wipes
    // whatever the person already entered.
    this.emailValue = "";
    this.fullNameValue = "";
    this.otpDigits = Array(OTP_DIGIT_COUNT).fill("");
  }

  render() {
    const isHero = this.view === "google";
  
    return h(
      "main",
      { class: "auth-page" },
      h(
        "div",
        { class: isHero ? "auth-hero" : "auth-card" },
        isHero ? this.renderHeroView() : this.renderFormView()
      )
    );
  }
  
  renderHeroView() {
    return h(
      "div",
      {},
      this.renderBrand(),
      this.renderIllustration(),
      h(
        "h1",
        { class: "auth-hero-title" },
        h("span", {}, "Welcome to"),
        h("span", { class: "auth-hero-title-accent" }, "YerosCare")
      ),
      h(
        "p",
        { class: "auth-hero-lead" },
        "Sign in to begin AI triage, manage appointments and access your medical records."
      ),
      this.renderProviderButtons(),
      this.renderDivider(),
      this.renderFooterSwitch()
    );
  }
  
  renderBrand() {
    return h(
      "div",
      { class: "auth-brand" },
      h("img", {
        class: "auth-brand-mark",
        src: "/assets/yeroscarelogo.png",
        alt: "YerosCare"
      }),
      h("p", { class: "auth-brand-tagline" }, "Care moves closer")
    );
  }
  
  renderIllustration() {
    return h(
      "div",
      { class: "auth-hero-illustration" },
      this._illustrationFailed
        ? h("div", { class: "auth-hero-fallback" }, StethoscopeIcon())
        : h("img", {
            class: "auth-hero-illustration__photo",
            src: PATIENT_ILLUSTRATION_SRC,
            alt: "",
            onError: () => {
              this._illustrationFailed = true;
              this.update();
              this.mountGoogleButton(); // update() recreates the Google slot
            }
          })
    );
  }
  
  renderProviderButtons() {
    return h(
      "div",
      { class: "auth-provider-list" },
      h("div", { id: "google-login-btn", class: "google-btn-container" }),
      h(
        "button",
        {
          type: "button",
          class: "auth-provider-btn",
          disabled: true,
          "aria-disabled": "true",
          title: "Sign in with Apple — coming soon"
        },
        AppleIcon(),
        h("span", { class: "auth-provider-btn__label" }, "Sign in with Apple"),
        h("span", { class: "auth-provider-btn__arrow" }, ArrowIcon())
      ),
      h(
        "button",
        {
          type: "button",
          class: "auth-provider-btn auth-provider-btn--primary",
          onClick: () => {
            this.error = "";
            this.view = "otp-email";
            this.update();
            this.focusSoon("#otp-email");
          }
        },
        EnvelopeIcon(),
        h("span", { class: "auth-provider-btn__label" }, "Sign in with Email"),
        h("span", { class: "auth-provider-btn__arrow" }, ArrowIcon())
      )
    );
  }
  
  renderDivider() {
    return h(
      "div",
      { class: "auth-labeled-divider", "aria-hidden": "true" },
      h("span", { class: "auth-labeled-divider__rule" }),
      h("span", { class: "auth-labeled-divider__label" }, "Patient login"),
      h("span", { class: "auth-labeled-divider__rule" })
    );
  }
  
  renderFooterSwitch() {
    return h(
      "p",
      { class: "auth-role-switch" },
      "Are you a doctor? ",
      h("a", { href: "#/doctor/login", class: "auth-link" }, "Sign in here"),
      " ",
      h(
        "svg",
        { class: "auth-role-switch__arrow", viewBox: "0 0 24 24", fill: "none", "aria-hidden": "true" },
        h("path", { d: "M5 12h14M13 6l6 6-6 6", stroke: "currentColor", "stroke-width": "2", "stroke-linecap": "round", "stroke-linejoin": "round" })
      )
    );
  }
  
  renderFormView() {
    return h(
      "div",
      {},
      h(
        "div",
        { class: "auth-header" },
        h("span", { class: "auth-badge" }, "For patients"),
        h("h2", { class: "auth-title" }, this.view === "otp-code" ? "Enter your code" : "Sign in with email"),
        this.view !== "otp-code" &&
          h("p", { class: "auth-subtitle" }, "We'll email you a 6-digit code. No password needed.")
      ),
  
      this.view === "otp-email" && this.renderOtpEmailStep(),
      this.view === "otp-code" && this.renderOtpCodeStep(),
  
      h(
        "div",
        { class: "doctor-info" },
        h("h3", {}, "New to YerosCare?"),
        h(
          "p",
          {},
          "Signing in creates your patient account automatically. You can start a triage or book an appointment right away."
        )
      ),
      h("p", { class: "auth-note" }, "By continuing, you agree to our Terms of Service and Privacy Policy."),
      h(
        "div",
        { class: "auth-footer" },
        h(
          "a",
          {
            href: "#",
            class: "auth-back",
            onClick: (e) => {
              e.preventDefault();
              this.error = "";
              this.view = "google";
              this.update();
              this.mountGoogleButton();
            }
          },
          "← Back to sign-in options"
        )
      )
    );
  }
  
  focusSoon(selector) {
    clearTimeout(this._focusTimeout);
    this._focusTimeout = setTimeout(() => {
      this.el?.querySelector(selector)?.focus();
    }, 0);
  }
  renderOtpEmailStep() {
    return h(
      "div",
      { id: "otp-auth-section", class: "otp-auth-section" },
      h("label", { class: "sr-only", for: "otp-email" }, "Email address"),
      h(
        "div",
        { class: "auth-input-group" },
        EnvelopeIcon("auth-input-icon"),
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
      this.error && h("p", { class: "auth-error" }, this.error)
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
