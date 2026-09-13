import { alert } from "./dialog";

let deferredPrompt: any = null;

if (typeof window !== "undefined") {
    window.addEventListener("beforeinstallprompt", (e: Event) => {
        e.preventDefault();
        deferredPrompt = e;
        window.dispatchEvent(new CustomEvent("pwa-installable"));
    });
}

export function isPwaInstallable(): boolean {
    return Boolean(deferredPrompt);
}

export function isStandalone(): boolean {
    if (typeof window === "undefined") return false;
    return window.matchMedia("(display-mode: standalone)").matches || (window.navigator as any).standalone === true;
}

export async function promptPwaInstall(): Promise<boolean> {
    if (deferredPrompt) {
        deferredPrompt.prompt();
        const choiceResult = await deferredPrompt.userChoice;
        if (choiceResult && choiceResult.outcome === "accepted") {
            deferredPrompt = null;
            return true;
        }
        return false;
    }

    const isIos =
        typeof navigator !== "undefined" && /iPad|iPhone|iPod/.test(navigator.userAgent) && !(window as any).MSStream;

    if (isIos) {
        await alert(
            "Uygulamayı iPhone veya iPad cihazınıza yüklemek için:\n\n" +
                "1. Safari alt menüsündeki Paylaş (Share) butonuna basın.\n" +
                "2. Açılan menüden 'Ana Ekrana Ekle' (Add to Home Screen) seçeneğine dokunun.",
            { title: "Telefona Yükle (iOS)", type: "info" },
        );
    } else {
        await alert(
            "Uygulamayı tarayıcınızın adres çubuğundaki 'Uygulamayı Yükle' simgesine tıklayarak veya tarayıcı menüsünden 'Ana ekrana ekle / Yükle' seçeneğini kullanarak doğrudan telefon veya bilgisayarınıza kurabilirsiniz.",
            { title: "Telefona / Cihaza Yükle", type: "info" },
        );
    }

    return false;
}
