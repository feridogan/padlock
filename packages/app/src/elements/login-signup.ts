import "./password-input";
import { translate as $l } from "@padloc/locale/src/translate";
import { ErrorCode } from "@padloc/core/src/error";
import { AuthPurpose } from "@padloc/core/src/auth";
import { router } from "../globals";
import { StartForm } from "./start-form";
import { Input } from "./input";
import { Button } from "./button";
import { alert } from "../lib/dialog";
import "./logo";
import { customElement, property, query, state } from "lit/decorators.js";
import { css, html } from "lit";
import { completeAuthRequest, startAuthRequest, authenticate } from "@padloc/core/src/platform";
import { mixins } from "../styles";
import { promptPwaInstall } from "../lib/pwa";
import { ACCOUNT_EMAIL_MAX_LENGTH, ACCOUNT_NAME_MAX_LENGTH } from "@padloc/core/src/account";

type AuthMode = "login" | "signup" | "forgot";

@customElement("pl-login-signup")
export class LoginOrSignup extends StartForm {
    readonly routePattern =
        /^(start|login|signup|forgot-password)(?:\/(consent|choose-password|confirm-password|success))?/;

    @property({ type: Boolean })
    asAdmin = false;

    @state()
    private _mode: AuthMode = "login";

    @state()
    private _loginError = "";

    @state()
    private _signupError = "";

    @state()
    private _forgotSuccess = "";

    @state()
    private _forgotError = "";

    @state()
    private _forgotStep: 1 | 2 = 1;

    // Login inputs
    @query("#loginEmailInput")
    private _loginEmailInput: Input;

    @query("#loginPasswordInput")
    private _loginPasswordInput: Input;

    @query("#loginSubmitButton")
    private _loginSubmitButton: Button;

    // Signup inputs
    @query("#signupEmailInput")
    private _signupEmailInput: Input;

    @query("#signupNameInput")
    private _signupNameInput: Input;

    @query("#signupPasswordInput")
    private _signupPasswordInput: Input;

    @query("#signupRepeatPasswordInput")
    private _signupRepeatPasswordInput: Input;

    @query("#signupTosCheckbox")
    private _signupTosCheckbox: HTMLInputElement;

    @query("#signupSubmitButton")
    private _signupSubmitButton: Button;

    // Forgot inputs
    @query("#forgotEmailInput")
    private _forgotEmailInput: Input;

    @query("#forgotSendCodeButton")
    private _forgotSendCodeButton: Button;

    @query("#forgotCodeInput")
    private _forgotCodeInput: Input;

    @query("#forgotNewPasswordInput")
    private _forgotNewPasswordInput: Input;

    @query("#forgotRepeatPasswordInput")
    private _forgotRepeatPasswordInput: Input;

    @query("#forgotResetSubmitButton")
    private _forgotResetSubmitButton: Button;

    async reset() {
        await this.updateComplete;
        if (this._loginEmailInput) this._loginEmailInput.value = router.params.email || "";
        if (this._loginPasswordInput) this._loginPasswordInput.value = "";
        this._loginError = "";
        this._signupError = "";
        this._forgotError = "";
        this._forgotSuccess = "";
        this._forgotStep = 1;
        super.reset();
    }

    async handleRoute([page]: [string, string]) {
        if (page === "signup") {
            this._mode = "signup";
        } else if (page === "forgot-password") {
            this._mode = "forgot";
        } else {
            this._mode = "login";
        }

        await this.updateComplete;

        if (this._email) {
            if (this._loginEmailInput) this._loginEmailInput.value = this._email;
            if (this._signupEmailInput) this._signupEmailInput.value = this._email;
            if (this._forgotEmailInput) this._forgotEmailInput.value = this._email;
        }
    }

    private _setMode(mode: AuthMode) {
        this._mode = mode;
        this._loginError = "";
        this._signupError = "";
        this._forgotError = "";
        this._forgotSuccess = "";
        this.requestUpdate();
    }

    /* -------------------------------------------------------------
       1. DOĞRUDAN GİRİŞ (LOGIN)
       ------------------------------------------------------------- */
    private async _handleLogin(): Promise<void> {
        if (this._loginSubmitButton?.state === "loading") {
            return;
        }

        const email = (this._loginEmailInput?.value || "").trim();
        const password = this._loginPasswordInput?.value || "";

        if (!email) {
            this._loginError = $l("Lütfen kullanıcı adı veya e-posta adresinizi girin.");
            this.rumble();
            this._loginEmailInput?.focus();
            return;
        }

        if (!password) {
            this._loginError = $l("Lütfen şifrenizi girin.");
            this.rumble();
            this._loginPasswordInput?.focus();
            return;
        }

        this._loginError = "";
        this._loginSubmitButton?.start();

        try {
            await this.app.login({
                email,
                password,
                authToken: this._authToken || "",
                addTrustedDevice: true,
                asAdmin: this.asAdmin,
            });

            this._loginSubmitButton?.success();
            const invite = this._invite;
            const { email: _e, authToken: _a, ...params } = this.router.params;
            this.go(invite ? `invite/${invite.orgId}/${invite.id}` : "items", params);
        } catch (e: any) {
            this._loginSubmitButton?.fail();
            this.rumble();

            switch (e.code) {
                case ErrorCode.INVALID_CREDENTIALS:
                    this._loginError = $l("Hatalı şifre veya kullanıcı adı. Lütfen tekrar deneyin!");
                    break;
                case ErrorCode.NOT_FOUND:
                    this._loginError = $l("Bu kullanıcı adı veya e-posta ile kayıtlı bir hesap bulunamadı.");
                    break;
                case ErrorCode.AUTHENTICATION_REQUIRED:
                    // MFA zorunlu tutulan hesaplar için OTP doğrulaması tetikle
                    await this._handleMfaFallback(email, password);
                    return;
                default:
                    this._loginError = e.message || $l("Giriş yapılamadı. Lütfen bilgilerinizi kontrol edin.");
                    break;
            }

            this._loginPasswordInput?.focus();
        }
    }

    private async _handleMfaFallback(email: string, password: string) {
        try {
            const req = await startAuthRequest({
                purpose: this.asAdmin ? AuthPurpose.AdminLogin : AuthPurpose.Login,
                email,
            });
            const res = await completeAuthRequest(req);
            if (res && res.token) {
                await this.app.login({
                    email,
                    password,
                    authToken: res.token,
                    addTrustedDevice: true,
                    asAdmin: this.asAdmin,
                });
                this.go("items");
            }
        } catch (err: any) {
            this._loginError = err.message || $l("Doğrulama başarısız oldu.");
        }
    }

    /* -------------------------------------------------------------
       2. DOĞRUDAN KAYIT (SIGNUP)
       ------------------------------------------------------------- */
    private async _handleSignup(): Promise<void> {
        if (this._signupSubmitButton?.state === "loading") {
            return;
        }

        const email = (this._signupEmailInput?.value || "").trim();
        const name = (this._signupNameInput?.value || "").trim();
        const password = this._signupPasswordInput?.value || "";
        const repeatPassword = this._signupRepeatPasswordInput?.value || "";

        if (!email) {
            this._signupError = $l("Lütfen geçerli bir e-posta adresi veya kullanıcı adı girin.");
            this.rumble();
            this._signupEmailInput?.focus();
            return;
        }

        if (!password) {
            this._signupError = $l("Lütfen bir şifre belirleyin.");
            this.rumble();
            this._signupPasswordInput?.focus();
            return;
        }

        if (password.length < 4) {
            this._signupError = $l("Şifreniz en az 4 karakter uzunluğunda olmalıdır.");
            this.rumble();
            this._signupPasswordInput?.focus();
            return;
        }

        if (password !== repeatPassword) {
            this._signupError = $l("Girdiğiniz şifreler birbiriyle uyuşmuyor!");
            this.rumble();
            this._signupRepeatPasswordInput?.focus();
            return;
        }

        if (this._signupTosCheckbox && !this._signupTosCheckbox.checked) {
            this._signupError = $l("Lütfen kullanım koşullarını kabul edin.");
            this.rumble();
            return;
        }

        this._signupError = "";
        this._signupSubmitButton?.start();

        try {
            await this.app.signup({
                email,
                name,
                password,
                authToken: "",
                invite: this._invite ? { id: this._invite.id, org: this._invite.orgId } : undefined,
            });

            this._signupSubmitButton?.success();
            await alert($l("Hesabınız başarıyla oluşturuldu ve oturum açıldı!"), {
                title: $l("Kayıt Başarılı"),
                type: "success",
            });
            this.go("items");
        } catch (e: any) {
            this._signupSubmitButton?.fail();
            this.rumble();
            if (e.code === ErrorCode.ACCOUNT_EXISTS) {
                this._signupError = $l("Bu hesap zaten mevcut! Lütfen giriş yapın.");
            } else {
                this._signupError = e.message || $l("Kayıt oluşturulurken bir hata meydana geldi.");
            }
        }
    }

    /* -------------------------------------------------------------
       3. ŞİFREMİ UNUTTUM / SIFIRLAMA (RECOVERY)
       ------------------------------------------------------------- */
    private async _handleSendResetCode(): Promise<void> {
        if (this._forgotSendCodeButton?.state === "loading") {
            return;
        }

        const email = (this._forgotEmailInput?.value || "").trim();
        if (!email) {
            this._forgotError = $l("Lütfen kayıtlı e-posta adresinizi girin.");
            this.rumble();
            this._forgotEmailInput?.focus();
            return;
        }

        this._forgotError = "";
        this._forgotSuccess = "";
        this._forgotSendCodeButton?.start();

        try {
            // Standart SMTP üzerinden sıfırlama talebi
            await startAuthRequest({
                purpose: AuthPurpose.Recover,
                email,
            });

            this._forgotSendCodeButton?.success();
            this._forgotSuccess = $l(
                "Sıfırlama kodu e-posta adresinize gönderildi. Lütfen gelen kutunuzu kontrol edin.",
            );
            this._forgotStep = 2;
        } catch (e: any) {
            this._forgotSendCodeButton?.fail();
            this._forgotError = e.message || $l("Sıfırlama kodu gönderilemedi. Lütfen adresi kontrol edin.");
        }
    }

    private async _handleCompletePasswordReset(): Promise<void> {
        if (this._forgotResetSubmitButton?.state === "loading") {
            return;
        }

        const email = (this._forgotEmailInput?.value || "").trim();
        const code = (this._forgotCodeInput?.value || "").trim();
        const newPassword = this._forgotNewPasswordInput?.value || "";
        const repeatPassword = this._forgotRepeatPasswordInput?.value || "";

        if (!code) {
            this._forgotError = $l("Lütfen e-postanıza gelen doğrulama kodunu girin.");
            this._forgotCodeInput?.focus();
            return;
        }

        if (!newPassword || newPassword.length < 4) {
            this._forgotError = $l("Yeni şifreniz en az 4 karakter olmalıdır.");
            this._forgotNewPasswordInput?.focus();
            return;
        }

        if (newPassword !== repeatPassword) {
            this._forgotError = $l("Yeni şifreler eşleşmiyor!");
            this._forgotRepeatPasswordInput?.focus();
            return;
        }

        this._forgotError = "";
        this._forgotResetSubmitButton?.start();

        try {
            // Şifre kurtarma akışını tamamla
            const { token } = await authenticate({ email, purpose: AuthPurpose.Recover });
            await this.app.recoverAccount({ email, password: newPassword, verify: token });

            this._forgotResetSubmitButton?.success();
            await alert($l("Şifreniz başarıyla sıfırlandı! Yeni şifreniz ile giriş yapabilirsiniz."), {
                title: $l("Şifre Sıfırlandı"),
                type: "success",
            });

            this._mode = "login";
            this._forgotStep = 1;
            if (this._loginEmailInput) this._loginEmailInput.value = email;
            if (this._loginPasswordInput) this._loginPasswordInput.value = newPassword;
        } catch (e: any) {
            this._forgotResetSubmitButton?.fail();
            this._forgotError =
                e.message || $l("Şifre sıfırlama tamamlanamadı. Kod hatalı veya süresi dolmuş olabilir.");
        }
    }

    /* -------------------------------------------------------------
       STİLLER (KOYU GECE MAVİSİ & SARI KURUMSAL TEMA)
       ------------------------------------------------------------- */
    static styles = [
        ...StartForm.styles,
        css`
            :host {
                display: block;
                min-height: 100vh;
                background:
                    radial-gradient(circle at 50% 20%, rgba(245, 183, 0, 0.08) 0%, transparent 60%),
                    var(--color-background-dark);
            }

            .auth-container {
                ${mixins.fullbleed()};
                ${mixins.scroll()};
                display: flex;
                flex-direction: column;
                align-items: center;
                justify-content: center;
                padding: 2em 1em;
                box-sizing: border-box;
            }

            pl-logo {
                margin: 0 auto 1.2em auto;
                height: 4.2em;
                width: auto;
            }

            .auth-card {
                width: 100%;
                max-width: 25.5em;
                box-sizing: border-box;
                border-radius: 1.2em;
                padding: 2em;
                background: linear-gradient(180deg, #111d42 0%, #0b132b 100%);
                border: 1px solid rgba(245, 183, 0, 0.28);
                box-shadow:
                    0 20px 45px -10px rgba(0, 0, 0, 0.75),
                    0 0 0 1px rgba(245, 183, 0, 0.15);
            }

            .auth-tabs {
                display: flex;
                background: rgba(7, 12, 30, 0.85);
                border-radius: 0.75em;
                padding: 0.3em;
                margin-bottom: 1.5em;
                border: 1px solid rgba(245, 183, 0, 0.2);
            }

            .auth-tab {
                flex: 1;
                text-align: center;
                padding: 0.7em 0.5em;
                border-radius: 0.5em;
                font-weight: 600;
                font-size: 0.95em;
                cursor: pointer;
                color: #94a3b8;
                transition: all 0.2s ease;
                user-select: none;
            }

            .auth-tab.active {
                background: #f5b700;
                color: #070c1e;
                box-shadow: 0 2px 10px rgba(245, 183, 0, 0.35);
            }

            .forgot-link {
                color: #f5b700;
                font-size: 0.85em;
                text-decoration: none;
                font-weight: 600;
                cursor: pointer;
                display: inline-block;
                margin: 0.8em 0 1.2em 0;
                transition: color 0.2s;
            }

            .forgot-link:hover {
                color: #ffd000;
                text-decoration: underline;
            }

            .back-to-login {
                display: flex;
                align-items: center;
                gap: 0.4em;
                color: #94a3b8;
                font-size: 0.85em;
                cursor: pointer;
                margin-bottom: 1.2em;
                transition: color 0.2s;
            }

            .back-to-login:hover {
                color: #f5b700;
            }

            .auth-error {
                background: rgba(239, 68, 68, 0.18);
                border: 1px solid #ef4444;
                color: #fca5a5;
                padding: 0.75em 1em;
                border-radius: 0.5em;
                font-size: 0.85em;
                text-align: center;
                margin-bottom: 1.2em;
                line-height: 1.35;
            }

            .auth-success {
                background: rgba(245, 183, 0, 0.18);
                border: 1px solid #f5b700;
                color: #ffd000;
                padding: 0.75em 1em;
                border-radius: 0.5em;
                font-size: 0.85em;
                text-align: center;
                margin-bottom: 1.2em;
                line-height: 1.35;
            }

            .card-title {
                font-size: 1.3em;
                font-weight: 700;
                color: #ffffff;
                margin-bottom: 0.4em;
                text-align: center;
            }

            .card-subtitle {
                font-size: 0.85em;
                color: #94a3b8;
                margin-bottom: 1.5em;
                text-align: center;
                line-height: 1.4;
            }

            .tos-label {
                display: flex;
                align-items: center;
                gap: 0.5em;
                font-size: 0.85em;
                color: #cbd5e1;
                margin: 1.2em 0;
            }

            .tos-label a {
                color: #f5b700;
                text-decoration: underline;
            }

            /* PWA Kurulum Kartı */
            .pwa-card {
                width: 100%;
                max-width: 25.5em;
                box-sizing: border-box;
                border-radius: 1em;
                padding: 1.2em 1.5em;
                margin-top: 1.5em;
                background: rgba(17, 29, 66, 0.85);
                border: 1px solid rgba(245, 183, 0, 0.25);
                box-shadow: 0 10px 25px -5px rgba(0, 0, 0, 0.5);
                display: flex;
                flex-direction: column;
                gap: 0.8em;
            }

            .pwa-header {
                display: flex;
                align-items: center;
                gap: 0.9em;
            }

            .pwa-icon {
                font-size: 2em;
                color: #f5b700;
            }

            .pwa-title {
                font-weight: 700;
                font-size: 0.95em;
                color: #ffffff;
            }

            .pwa-desc {
                font-size: 0.8em;
                color: #94a3b8;
                line-height: 1.35;
                margin-top: 0.2em;
            }

            .pwa-button {
                --button-background: rgba(245, 183, 0, 0.15);
                --button-color: #f5b700;
                --button-border-color: rgba(245, 183, 0, 0.4);
                font-weight: 600;
            }

            .pwa-button:hover {
                --button-background: rgba(245, 183, 0, 0.25);
            }
        `,
    ];

    /* -------------------------------------------------------------
       RENDER METOTLARI
       ------------------------------------------------------------- */
    render() {
        return html`
            <div class="auth-container">
                <pl-logo class="animated"></pl-logo>

                <div class="auth-card animated">
                    ${
                        this._mode !== "forgot"
                            ? html`
                                  <div class="auth-tabs">
                                      <div
                                          class="auth-tab ${this._mode === "login" ? "active" : ""}"
                                          @click=${() => this._setMode("login")}
                                      >
                                          ${$l("Giriş Yap")}
                                      </div>
                                      <div
                                          class="auth-tab ${this._mode === "signup" ? "active" : ""}"
                                          @click=${() => this._setMode("signup")}
                                      >
                                          ${$l("Kayıt Ol")}
                                      </div>
                                  </div>
                              `
                            : ""
                    }
                    ${this._mode === "login" ? this._renderLoginForm() : ""}
                    ${this._mode === "signup" ? this._renderSignupForm() : ""}
                    ${this._mode === "forgot" ? this._renderForgotForm() : ""}
                </div>

                <!-- Mobil Kurulum (PWA) Yönlendirme Alanı -->
                <div class="pwa-card animated">
                    <div class="pwa-header">
                        <pl-icon icon="mobile" class="pwa-icon"></pl-icon>
                        <div>
                            <div class="pwa-title">${$l("Telefona Yükle / PWA Kurulum")}</div>
                            <div class="pwa-desc">
                                ${$l("Uygulamayı telefonunuza veya tabletinize doğrudan yükleyerek hızlı ve güvenli erişin.")}
                            </div>
                        </div>
                    </div>
                    <pl-button class="pwa-button" @click=${() => promptPwaInstall()}>
                        <pl-icon icon="download" class="right-margined"></pl-icon>
                        <div>${$l("Telefona Yükle / Kur")}</div>
                    </pl-button>
                </div>
            </div>
        `;
    }

    private _renderLoginForm() {
        return html`
            <div class="vertical layout">
                ${this._loginError ? html` <div class="auth-error">${this._loginError}</div> ` : ""}

                <pl-input
                    id="loginEmailInput"
                    type="text"
                    required
                    select-on-focus
                    maxlength=${ACCOUNT_EMAIL_MAX_LENGTH}
                    .label=${$l("Kullanıcı Adı veya E-posta")}
                    @enter=${() => this._loginPasswordInput?.focus()}
                >
                </pl-input>

                <div style="height: 0.8em"></div>

                <pl-password-input
                    id="loginPasswordInput"
                    required
                    select-on-focus
                    .label=${$l("Şifre")}
                    @enter=${() => this._handleLogin()}
                >
                </pl-password-input>

                <div class="horizontal layout" style="justify-content: flex-end">
                    <a class="forgot-link" @click=${() => this._setMode("forgot")}> ${$l("Şifremi Unuttum?")} </a>
                </div>

                <pl-button id="loginSubmitButton" class="primary stretch" @click=${() => this._handleLogin()}>
                    <pl-icon icon="login" class="right-margined"></pl-icon>
                    <div>${$l("Giriş Yap")}</div>
                </pl-button>
            </div>
        `;
    }

    private _renderSignupForm() {
        return html`
            <div class="vertical layout">
                ${this._signupError ? html` <div class="auth-error">${this._signupError}</div> ` : ""}

                <pl-input
                    id="signupEmailInput"
                    type="text"
                    required
                    select-on-focus
                    maxlength=${ACCOUNT_EMAIL_MAX_LENGTH}
                    .label=${$l("E-posta veya Kullanıcı Adı")}
                    @enter=${() => this._signupNameInput?.focus()}
                >
                </pl-input>

                <div style="height: 0.8em"></div>

                <pl-input
                    id="signupNameInput"
                    maxlength=${ACCOUNT_NAME_MAX_LENGTH}
                    .label=${$l("Ad Soyad (İsteğe Bağlı)")}
                    @enter=${() => this._signupPasswordInput?.focus()}
                >
                </pl-input>

                <div style="height: 0.8em"></div>

                <pl-password-input
                    id="signupPasswordInput"
                    required
                    select-on-focus
                    .label=${$l("Şifre")}
                    @enter=${() => this._signupRepeatPasswordInput?.focus()}
                >
                </pl-password-input>

                <div style="height: 0.8em"></div>

                <pl-password-input
                    id="signupRepeatPasswordInput"
                    required
                    select-on-focus
                    .label=${$l("Şifreyi Tekrarla")}
                    @enter=${() => this._handleSignup()}
                >
                </pl-password-input>

                <label class="tos-label">
                    <input type="checkbox" id="signupTosCheckbox" checked />
                    <span>${$l("Kullanım Koşullarını kabul ediyorum")}</span>
                </label>

                <pl-button id="signupSubmitButton" class="primary stretch" @click=${() => this._handleSignup()}>
                    <pl-icon icon="forward" class="right-margined"></pl-icon>
                    <div>${$l("Kayıt Ol")}</div>
                </pl-button>
            </div>
        `;
    }

    private _renderForgotForm() {
        return html`
            <div class="vertical layout">
                <div class="back-to-login" @click=${() => this._setMode("login")}>
                    <pl-icon icon="backward" class="small"></pl-icon>
                    <div>${$l("Giriş Ekranına Dön")}</div>
                </div>

                <div class="card-title">${$l("Şifre Sıfırlama")}</div>
                <div class="card-subtitle">
                    ${
                        this._forgotStep === 1
                            ? $l("Kayıtlı e-posta adresinizi girin. Size bir sıfırlama kodu göndereceğiz.")
                            : $l("E-postanıza gönderilen doğrulama kodunu ve yeni şifrenizi girin.")
                    }
                </div>

                ${this._forgotError ? html` <div class="auth-error">${this._forgotError}</div> ` : ""}
                ${this._forgotSuccess ? html` <div class="auth-success">${this._forgotSuccess}</div> ` : ""}
                ${
                    this._forgotStep === 1
                        ? html`
                              <pl-input
                                  id="forgotEmailInput"
                                  type="email"
                                  required
                                  select-on-focus
                                  .label=${$l("E-posta Adresi")}
                                  @enter=${() => this._handleSendResetCode()}
                              >
                              </pl-input>

                              <div style="height: 1.2em"></div>

                              <pl-button
                                  id="forgotSendCodeButton"
                                  class="primary stretch"
                                  @click=${() => this._handleSendResetCode()}
                              >
                                  <pl-icon icon="mail" class="right-margined"></pl-icon>
                                  <div>${$l("Sıfırlama Kodu Gönder")}</div>
                              </pl-button>
                          `
                        : html`
                              <pl-input
                                  id="forgotCodeInput"
                                  type="text"
                                  required
                                  .label=${$l("Doğrulama Kodu")}
                                  @enter=${() => this._forgotNewPasswordInput?.focus()}
                              >
                              </pl-input>

                              <div style="height: 0.8em"></div>

                              <pl-password-input
                                  id="forgotNewPasswordInput"
                                  required
                                  select-on-focus
                                  .label=${$l("Yeni Şifre")}
                                  @enter=${() => this._forgotRepeatPasswordInput?.focus()}
                              >
                              </pl-password-input>

                              <div style="height: 0.8em"></div>

                              <pl-password-input
                                  id="forgotRepeatPasswordInput"
                                  required
                                  select-on-focus
                                  .label=${$l("Yeni Şifre Tekrar")}
                                  @enter=${() => this._handleCompletePasswordReset()}
                              >
                              </pl-password-input>

                              <div style="height: 1.2em"></div>

                              <pl-button
                                  id="forgotResetSubmitButton"
                                  class="primary stretch"
                                  @click=${() => this._handleCompletePasswordReset()}
                              >
                                  <pl-icon icon="refresh" class="right-margined"></pl-icon>
                                  <div>${$l("Şifreyi Güncelle ve Giriş Yap")}</div>
                              </pl-button>
                          `
                }
            </div>
        `;
    }
}
