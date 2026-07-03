import { Injectable, signal } from '@angular/core';

const STORAGE_KEY_ENABLED = 'mf_reminder_enabled';
const STORAGE_KEY_LAST = 'mf_reminder_last';
const REMINDER_INTERVAL_DAYS = 28;

@Injectable({ providedIn: 'root' })
export class NotificationService {
  readonly permission = signal<NotificationPermission>(
    typeof Notification !== 'undefined' ? Notification.permission : 'denied'
  );

  readonly enabled = signal(localStorage.getItem(STORAGE_KEY_ENABLED) === 'true');

  async requestPermission(): Promise<void> {
    if (typeof Notification === 'undefined') return;
    const result = await Notification.requestPermission();
    this.permission.set(result);
    if (result === 'granted') {
      this.setEnabled(true);
    } else {
      this.setEnabled(false);
    }
  }

  setEnabled(value: boolean): void {
    this.enabled.set(value);
    localStorage.setItem(STORAGE_KEY_ENABLED, String(value));
    if (value && this.permission() !== 'granted') {
      void this.requestPermission();
    }
  }

  /** Beim App-Start prüfen ob ein Reminder fällig ist (>= 28 Tage seit letztem) */
  checkAndShowReminder(): void {
    if (!this.enabled() || this.permission() !== 'granted') return;
    const lastStr = localStorage.getItem(STORAGE_KEY_LAST);
    const now = Date.now();
    const lastMs = lastStr ? new Date(lastStr).getTime() : 0;
    const daysSinceLast = (now - lastMs) / 86_400_000;
    if (daysSinceLast >= REMINDER_INTERVAL_DAYS) {
      void this.showNotification();
    }
  }

  async showTestNotification(): Promise<void> {
    if (this.permission() !== 'granted') {
      await this.requestPermission();
    }
    if (this.permission() === 'granted') {
      await this.showNotification();
    }
  }

  private async showNotification(): Promise<void> {
    const title = $localize`:@@notification.reminder.title:MeterFlow – Zähler ablesen`;
    const body = $localize`:@@notification.reminder.body:Zeit für deinen monatlichen Zählerstand! Jetzt Werte erfassen.`;
    const options: NotificationOptions = {
      body,
      icon: '/icons/icon-192x192.png',
      badge: '/icons/icon-96x96.png',
      tag: 'monthly-reminder',
    };

    try {
      const reg = await navigator.serviceWorker.ready;
      reg.showNotification(title, options);
    } catch {
      // Fallback ohne Service Worker (z. B. im Dev-Modus)
      new Notification(title, options);
    }

    localStorage.setItem(STORAGE_KEY_LAST, new Date().toISOString());
  }
}
