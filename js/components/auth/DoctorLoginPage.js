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
const CODE_LENGTH = 6;


const DOCTOR_ILLUSTRATION_SRC = "/assets/doctor-illustration.png";

const Icons = {
  arrow: () =>
    h(
      "svg",
      { class: "auth-btn-icon", viewBox: "0 0 24 24", fill: "none", "aria-hidden": "true" },
      h("path", {
        d: "M5 12h14M13 6l6 6-6 6",
        stroke: "currentColor",
        "stroke-width": "2",
        "stroke-linecap": "round",
        "stroke-linejoin": "round"
      })
    ),
  envelope: () =>
    h(
      "svg",
      { class: "provider-btn-icon", viewBox: "0 0 24 24", fill: "none", "aria-hidden": "true" },
      h("path", {
        d: "M3.5 6.5h17a1 1 0 0 1 1 1v9a1 1 0 0 1-1 1h-17a1 1 0 0 1-1-1v-9a1 1 0 0 1 1-1zM3 7l9 6.5L21 7",
        stroke: "currentColor",
        "stroke-width": "1.8",
        "stroke-linecap": "round",
        "stroke-linejoin": "round"
      })
    ),
  google: () =>
    h(
      "svg",
      { class: "provider-btn-icon", viewBox: "0 0 24 24", "aria-hidden": "true" },
      h("path", { fill: "#4285F4", d: "M23.52 12.27c0-.85-.08-1.67-.22-2.45H12v4.64h6.47a5.53 5.53 0 0 1-2.4 3.63v3h3.88c2.27-2.09 3.57-5.17 3.57-8.82z" }),
      h("path", { fill: "#34A853", d: "M12 24c3.24 0 5.96-1.07 7.95-2.91l-3.88-3c-1.08.72-2.46 1.15-4.07 1.15-3.13 0-5.78-2.11-6.73-4.96H1.26v3.1A12 12 0 0 0 12 24z" }),
      h("path", { fill: "#FBBC05", d: "M5.27 14.28A7.2 7.2 0 0 1 4.89 12c0-.79.14-1.56.38-2.28v-3.1H1.26A12 12 0 0 0 0 12c0 1.94.46 3.77 1.26 5.38z" }),
      h("path", { fill: "#EA4335", d: "M12 4.77c1.76 0 3.34.61 4.58 1.79l3.44-3.44C17.95 1.19 15.24 0 12 0 7.31 0 3.26 2.69 1.26 6.62l4.01 3.1C6.22 6.88 8.87 4.77 12 4.77z" })
    ),
  apple: () =>
    h(
      "svg",
      { class: "provider-btn-icon", viewBox: "0 0 24 24", "aria-hidden": "true" },
      h("path", {
        fill: "currentColor",
        d: "M12.152 6.896c-.948 0-2.415-1.078-3.96-1.04-2.04.027-3.91 1.183-4.961 3.014-2.117 3.675-.546 9.103 1.519 12.09 1.013 1.454 2.208 3.09 3.792 3.03 1.52-.06 2.098-.98 3.938-.98 1.837 0 2.35.98 3.96.95 1.637-.03 2.676-1.48 3.676-2.94 1.156-1.687 1.636-3.32 1.666-3.404-.036-.017-3.19-1.226-3.223-4.86-.028-3.036 2.478-4.49 2.59-4.554-1.42-2.08-3.617-2.31-4.39-2.36-2-.16-3.67 1.083-4.62 1.083zm3.42-3.11c.837-1.012 1.4-2.42 1.25-3.83-1.21.05-2.68.81-3.55 1.82-.78.9-1.46 2.33-1.28 3.7 1.34.1 2.72-.68 3.58-1.7z"
      })
    ),
  heartPulse: () =>
    h(
      "svg",
      { class: "auth-hero-bubble__icon-glyph", viewBox: "0 0 24 24", fill: "none", "aria-hidden": "true" },
      h("path", {
        d: "M3.5 12h4l2-5 4 10 2-5h5",
        stroke: "currentColor",
        "stroke-width": "2",
        "stroke-linecap": "round",
        "stroke-linejoin": "round"
      })
    ),
  stethoscope: () =>
    h(
      "svg",
      { class: "auth-hero-fallback-icon", viewBox: "0 0 24 24", fill: "none", "aria-hidden": "true" },
      h("path", { d: "M5 3H4a2 2 0 0 0-2 2v4a6 6 0 0 0 12 0V5a2 2 0 0 0-2-2h-1", stroke: "currentColor", "stroke-width": "1.6", "stroke-linecap": "round", "stroke-linejoin": "round" }),
      h("path", { d: "M11 2v2", stroke: "currentColor", "stroke-width": "1.6", "stroke-linecap": "round" }),
      h("path", { d: "M5 2v2", stroke: "currentColor", "stroke-width": "1.6", "stroke-linecap": "round" }),
      h("path", { d: "M8 15a6 6 0 0 0 12 0v-3", stroke: "currentColor", "stroke-width": "1.6", "stroke-linecap": "round", "stroke-linejoin": "round" }),
      h("circle", { cx: "20", cy: "10", r: "2", stroke: "currentColor", "stroke-width": "1.6" })
    )
};

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
    this._focusTimeout = null;
    this._illustrationFailed = false;
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

  // ---------- Hero (default) view: brand, illustration, headline, three
  // provider buttons. This is the screen a doctor sees first. ----------

  renderHeroView() {
    return h(
      "div",
      {},
      this.renderBrand(),
      this.renderIllustration(),
      h(
        "h1",
        { class: "auth-hero-title" },
        h("span", {}, "Welcome Back,"),
        h("span", { class: "auth-hero-title-accent" }, "Doctor")
      ),
      h(
        "p",
        { class: "auth-hero-lead" },
        "Sign in to access your dashboard, manage your patients and continue providing exceptional care."
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
      h("div", { class: "auth-hero-illustration__blob", "aria-hidden": "true" }),
      this._illustrationFailed
        ? h("div", { class: "auth-hero-fallback" }, Icons.stethoscope())
        : h("img", {
            class: "auth-hero-illustration__photo",
            src: DOCTOR_ILLUSTRATION_SRC,
            alt: "",
            onError: () => {
              this._illustrationFailed = true;
              this.update();
            }
          }),
      h(
        "div",
        { class: "auth-hero-bubble" },
        h("span", { class: "auth-hero-bubble__icon" }, Icons.heartPulse()),
        h("span", { class: "auth-hero-bubble__text" }, "Better care, together")
      )
    );
  }

  renderProviderButtons() {
    return h(
      "div",
      { class: "auth-provider-list" },
      h(
        "div",
        { id: "google-login-btn", class: "google-btn-container" }
      ),
      // Inactive for now — kept visible per product decision, just disabled.
      h(
        "button",
        {
          type: "button",
          class: "auth-provider-btn",
          disabled: true,
          "aria-disabled": "true",
          title: "Sign in with Apple — coming soon"
        },
        Icons.apple(),
        h("span", { class: "auth-provider-btn__label" }, "Sign in with Apple"),
        h("span", { class: "auth-provider-btn__arrow" }, Icons.arrow())
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
        Icons.envelope(),
        h("span", { class: "auth-provider-btn__label" }, "Sign in with Email"),
        h("span", { class: "auth-provider-btn__arrow" }, Icons.arrow())
      )
    );
  }

  renderDivider() {
    return h(
      "div",
      { class: "auth-labeled-divider", "aria-hidden": "true" },
      h("span", { class: "auth-labeled-divider__rule" }),
      h("span", { class: "auth-labeled-divider__label" }, "Doctor login"),
      h("span", { class: "auth-labeled-divider__rule" })
    );
  }

  renderFooterSwitch() {
    return h(
      "p",
      { class: "auth-role-switch" },
      "Are you a patient? ",
      h("a", { href: "#/patient/login", class: "auth-link" }, "Sign in here"),
      " ",
      h(
        "svg",
        { class: "auth-role-switch__arrow", viewBox: "0 0 24 24", fill: "none", "aria-hidden": "true" },
        h("path", { d: "M5 12h14M13 6l6 6-6 6", stroke: "currentColor", "stroke-width": "2", "stroke-linecap": "round", "stroke-linejoin": "round" })
      )
    );
  }

  // ---------- Form views (OTP steps): boxed card, same as before but
  // restyled. Logic is unchanged from the working version. ----------

  renderFormView() {
    return h(
      "div",
      {},
      h(
        "div",
        { class: "auth-header" },
        h("span", { class: "auth-badge auth-badge--doctor" }, "For Doctors"),
        h("h2", { class: "auth-title" }, this.view === "otp-code" ? "Enter your code" : "Sign in with email"),
        this.view !== "otp-code" &&
          h("p", { class: "auth-subtitle" }, "We'll email you a 6-digit code — no password needed.")
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

  renderOtpEmailStep() {
    return h(
      "div",
      { id: "otp-auth-section", class: "otp-auth-section" },
      h(
        "label",
        { class: "sr-only", for: "otp-email" },
        "Email address"
      ),
      h(
        "div",
        { class: "auth-input-group" },
        Icons.envelope(),
        h("input", {
          type: "email",
          id: "otp-email",
          class: "auth-input",
          placeholder: "you@example.com",
          autocomplete: "email",
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
        !this.loading && Icons.arrow()
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
      { id: "otp-auth-section", class: "otp-auth-section" },
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

      h(
        "div",
        { class: "otp-code-group", role: "group", "aria-label": "6-digit verification code" },
        ...this.renderCodeDigitInputs()
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
            placeholder: "Dr. Jane Doe",
            autocomplete: "name",
            onKeydown: (e) => {
              if (e.key === "Enter") this.handleVerifyCode();
            }
          })
        ),

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
              this.focusSoon("#otp-email");
            }
          },
          "Use a different email"
        )
      )
    );
  }

  // Six individual boxes rather than one text field — auto-advances as you
  // type, supports paste-the-whole-code, and auto-submits once filled (for
  // returning doctors; new accounts still need the name field below first).
  renderCodeDigitInputs() {
    const inputs = [];
    for (let i = 0; i < CODE_LENGTH; i++) {
      inputs.push(
        h("input", {
          type: "text",
          inputmode: "numeric",
          pattern: "[0-9]*",
          maxlength: "1",
          class: "otp-code-digit",
          id: `otp-code-${i}`,
          autocomplete: i === 0 ? "one-time-code" : "off",
          "aria-label": `Digit ${i + 1} of ${CODE_LENGTH}`,
          onInput: (e) => this.handleCodeDigitInput(i, e),
          onKeydown: (e) => this.handleCodeDigitKeydown(i, e),
          onPaste: (e) => this.handleCodeDigitPaste(i, e)
        })
      );
    }
    return inputs;
  }

  handleCodeDigitInput(index, e) {
    const digit = e.target.value.replace(/[^0-9]/g, "").slice(-1);
    e.target.value = digit;

    if (digit && index < CODE_LENGTH - 1) {
      this.el.querySelector(`#otp-code-${index + 1}`)?.focus();
    }

    this.maybeAutoAdvanceOrSubmit();
  }

  handleCodeDigitKeydown(index, e) {
    if (e.key === "Backspace" && !e.target.value && index > 0) {
      e.preventDefault();
      const prev = this.el.querySelector(`#otp-code-${index - 1}`);
      if (prev) {
        prev.value = "";
        prev.focus();
      }
      return;
    }

    if (e.key === "ArrowLeft" && index > 0) {
      e.preventDefault();
      this.el.querySelector(`#otp-code-${index - 1}`)?.focus();
      return;
    }

    if (e.key === "ArrowRight" && index < CODE_LENGTH - 1) {
      e.preventDefault();
      this.el.querySelector(`#otp-code-${index + 1}`)?.focus();
      return;
    }

    if (e.key === "Enter") {
      this.handleVerifyCode();
    }
  }

  handleCodeDigitPaste(index, e) {
    e.preventDefault();
    const pasted = (e.clipboardData || window.clipboardData)
      .getData("text")
      .replace(/[^0-9]/g, "")
      .slice(0, CODE_LENGTH);

    if (!pasted) return;

    pasted.split("").forEach((digit, i) => {
      const input = this.el.querySelector(`#otp-code-${i}`);
      if (input) input.value = digit;
    });

    const nextEmpty = Math.min(pasted.length, CODE_LENGTH - 1);
    this.el.querySelector(`#otp-code-${nextEmpty}`)?.focus();

    this.maybeAutoAdvanceOrSubmit();
  }

  maybeAutoAdvanceOrSubmit() {
    const code = this.getCode();
    if (code.length !== CODE_LENGTH) return;

    if (this.isNewAccount) {
      const nameInput = this.el.querySelector("#otp-full-name");
      if (nameInput && !nameInput.value) nameInput.focus();
      return;
    }

    this.handleVerifyCode();
  }

  getCode() {
    let code = "";
    for (let i = 0; i < CODE_LENGTH; i++) {
      code += this.el.querySelector(`#otp-code-${i}`)?.value.trim() || "";
    }
    return code;
  }

  // Re-render (view switches, cooldown ticks) recreates these nodes, so
  // focus has to be re-applied after the DOM settles rather than assumed.
  focusSoon(selector) {
    clearTimeout(this._focusTimeout);
    this._focusTimeout = setTimeout(() => {
      this.el?.querySelector(selector)?.focus();
    }, 0);
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
      // finally guarantees this runs even if api.post() rejects for a
      // reason the try/catch above didn't anticipate (timeout, aborted
      // request, etc.) — the spinner can never get stuck open.
      this.loading = false;
      this.update();

      if (this.view === "otp-code") {
        this.focusSoon("#otp-code-0");
      }
    }
  }

  async handleVerifyCode() {
    const code = this.getCode();
    const fullName = this.isNewAccount
      ? this.el.querySelector("#otp-full-name")?.value.trim() || ""
      : "";

    this.error = "";

    if (code.length !== CODE_LENGTH) {
      this.error = "Enter the 6-digit code.";
      this.update();
      return;
    }

    if (this.isNewAccount && !fullName) {
      this.error = "Enter your full name to create your account.";
      this.update();
      this.el.querySelector("#otp-full-name")?.focus();
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
      // Runs even on the success path above (finally always runs after a
      // try block, return or not) — harmless here since onAuthSuccess
      // navigates away, but it's what guarantees loading never sticks.
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

      // Only touch the countdown text directly — avoid a full re-render
      // (and losing focus on the code inputs) every second.
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
    clearTimeout(this._focusTimeout);
  }
}
