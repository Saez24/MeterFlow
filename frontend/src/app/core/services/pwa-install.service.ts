import { Injectable, signal } from '@angular/core';

// BeforeInstallPromptEvent ist kein Standard-DOM-Typ, daher eigenes Interface
interface BeforeInstallPromptEvent extends Event {
    readonly platforms: string[];
    readonly userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
    prompt(): Promise<void>;
}

@Injectable({ providedIn: 'root' })
export class PwaInstallService {
    /** Wird gesetzt sobald der Browser das Install-Prompt anbietet */
    readonly canInstall = signal(false);

    /** true nachdem der User die App installiert hat */
    readonly installed = signal(false);

    private deferredPrompt: BeforeInstallPromptEvent | null = null;

    constructor() {
        // Nur im Browser ausführen
        if (typeof window === 'undefined') return;

        window.addEventListener('beforeinstallprompt', (e) => {
            e.preventDefault();
            this.deferredPrompt = e as BeforeInstallPromptEvent;
            this.canInstall.set(true);
        });

        window.addEventListener('appinstalled', () => {
            this.deferredPrompt = null;
            this.canInstall.set(false);
            this.installed.set(true);
        });
    }

    /** Zeigt den nativen Browser-Install-Dialog an */
    async promptInstall(): Promise<'accepted' | 'dismissed' | 'unavailable'> {
        if (!this.deferredPrompt) return 'unavailable';
        await this.deferredPrompt.prompt();
        const { outcome } = await this.deferredPrompt.userChoice;
        if (outcome === 'accepted') {
            this.deferredPrompt = null;
            this.canInstall.set(false);
        }
        return outcome;
    }

    /** Erkennt iOS-Geräte, die kein beforeinstallprompt unterstützen */
    get isIos(): boolean {
        if (typeof navigator === 'undefined') return false;
        return /iphone|ipad|ipod/i.test(navigator.userAgent);
    }

    /** Ist die App bereits als PWA gestartet (standalone Modus)? */
    get isStandalone(): boolean {
        if (typeof window === 'undefined') return false;
        return window.matchMedia('(display-mode: standalone)').matches;
    }
}
