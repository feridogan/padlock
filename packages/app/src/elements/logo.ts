import { css, html, LitElement } from "lit";
import { customElement, property } from "lit/decorators.js";
import LogoLight from "assets/logo-light.svg";
import LogoDark from "assets/logo-dark.svg";
import { StateMixin } from "../mixins/state";

@customElement("pl-logo")
export class Logo extends StateMixin(LitElement) {
    @property({ type: Boolean, reflect: true })
    reveal: boolean = false;

    static styles = [
        css`
            :host {
                position: relative;
                display: block;
            }

            img {
                width: 100%;
                height: 100%;
                object-fit: contain;
                filter: drop-shadow(0 0 12px rgba(252, 209, 22, 0.45));
                transition: filter 0.3s ease;
            }

            :host(:hover) img {
                filter: drop-shadow(0 0 18px rgba(252, 209, 22, 0.7));
            }
        `,
    ];
    render() {
        return html`<img src="${this.theme === "dark" ? LogoDark : LogoLight}" />`;
    }
}
