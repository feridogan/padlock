import { Workbox } from "workbox-window";
import { translate as $l } from "@padloc/locale/src/translate";
import { confirm } from "../lib/dialog";

type Constructor<T> = new (...args: any[]) => T;

export function ServiceWorker<B extends Constructor<Object>>(baseClass: B) {
    return class extends baseClass {
        constructor(...args: any[]) {
            super(...args);
            if (!process.env.PL_DISABLE_SW) {
                this.initSW();
            }
        }

        private _wb: Workbox;

        private async _updateReady() {
            // Immediately activate the new worker so clients are never stuck on stale code
            this._wb.messageSW({ type: "INSTALL_UPDATE" });
        }

        initSW() {
            if (!("serviceWorker" in navigator)) {
                return;
            }

            this._wb = new Workbox("/sw.js");

            // When new worker is controlling, reload to get fresh assets
            this._wb.addEventListener("controlling", () => {
                window.location.reload();
            });

            // Auto-activate when waiting
            this._wb.addEventListener("waiting", () => {
                this._updateReady();
            });

            this._wb.register();
        }

        checkForUpdates() {
            this._wb.register();
        }
    };
}
