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

      // Inactive for now — kept visible per product decision, just disabled.
      h(
        "button",
        {
          type: "button",
          class: "apple-signin-btn",
          disabled: true,
          "aria-disabled": "true",
          title: "Sign in with Apple — coming soon"
        },
        h(
          "svg",
          {
            class: "apple-signin-icon",
            viewBox: "0 0 24 24",
            xmlns: "http://www.w3.org/2000/svg",
            "aria-hidden": "true"
          },
          h("path", {
            fill: "currentColor",
            d: "M12.152 6.896c-.948 0-2.415-1.078-3.96-1.04-2.04.027-3.91 1.183-4.961 3.014-2.117 3.675-.546 9.103 1.519 12.09 1.013 1.454 2.208 3.09 3.792 3.03 1.52-.06 2.098-.98 3.938-.98 1.837 0 2.35.98 3.96.95 1.637-.03 2.676-1.48 3.676-2.94 1.156-1.687 1.636-3.32 1.666-3.404-.036-.017-3.19-1.226-3.223-4.86-.028-3.036 2.478-4.49 2.59-4.554-1.42-2.08-3.617-2.31-4.39-2.36-2-.16-3.67 1.083-4.62 1.083zm3.42-3.11c.837-1.012 1.4-2.42 1.25-3.83-1.21.05-2.68.81-3.55 1.82-.78.9-1.46 2.33-1.28 3.7 1.34.1 2.72-.68 3.58-1.7z"
          })
        ),
        h("span", {}, "Sign in with Apple")
      ),

      h(
        "div",
        { class: "auth-divider" },
        h("span", {}, "or")
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
              this.focusSoon("#otp-email");
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
        "p",
        { class: "auth-subtitle otp-step-intro" },
        "We'll email you a 6-digit code — no password needed."
      ),
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
