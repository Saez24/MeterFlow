# ⚡ MeterFlow

> Intelligente Energieverwaltung für dein Zuhause — Strom, Gas, Wasser und mehr auf einen Blick.

MeterFlow ist eine moderne Web-App zur Erfassung und Auswertung von Energiezählerständen. Verwalte alle deine Zähler an einem Ort, behalte Kosten im Überblick und erkenne Verbrauchsmuster mit übersichtlichen Diagrammen.

---

## 📸 Preview

> _Screenshots folgen_

<!-- Füge hier Screenshots ein, z.B.:
![Dashboard](./assets/screenshot-dashboard.png)
![Auswertungen](./assets/screenshot-reports.png)
-->

---

## 🛠 Tech Stack

| Bereich        | Technologie                                          |
| -------------- | --------------------------------------------------- |
| Frontend       | Angular 22 (Standalone Components, Signals, Zoneless)|
| UI             | Angular Material (M3)                                |
| Charts         | Chart.js                                             |
| OCR            | Tesseract.js (Zählerstand per Foto erfassen)        |
| Export/Import  | jsPDF (PDF) · PapaParse (CSV)                        |
| Backend / Auth | Supabase (PostgreSQL)                                |
| Hosting        | Docker + Nginx                                       |
| CI/CD          | GitHub Actions → GHCR                                |
| Tests          | Vitest (Unit) · Playwright (E2E)                     |

---

## 🌍 Umgebungsvariablen

MeterFlow benötigt zwei Umgebungsvariablen die zur Build-Zeit übergeben werden:

| Variable       | Beschreibung                      |
| -------------- | --------------------------------- |
| `SUPABASE_URL` | URL deines Supabase-Projekts      |
| `SUPABASE_KEY` | Anon-Key deines Supabase-Projekts |

### Lokal (Development)

Erstelle `src/environments/environment.development.ts`:

```typescript
export const environment = {
  production: false,
  supabaseUrl: 'https://deine-url.supabase.co',
  supabaseKey: 'dein-anon-key',
};
```

### Docker

```bash
docker run -d \
  --name MeterFlow \
  -p 80:80 \
  ghcr.io/saez24/meterflow:latest
```

Die Werte werden beim Build über GitHub Secrets injiziert — kein manuelles Setzen nötig.

---

## 🚀 Roadmap

### In Arbeit

- [ ] Mobile App (Flutter + SQLite + iCloud/Google Drive Backup)

### Geplant

- [ ] Push-Benachrichtigungen bei Budget-Überschreitung
- [ ] Mehrsprachigkeit (DE/EN)
- [ ] Tarif-Vergleich & Einsparpotenzial
- [ ] Selbst-gehostetes Supabase (Unraid)

### Fertig ✅

- [x] Dashboard mit Jahres- und Monatsübersicht
- [x] Zählerverwaltung (Strom, Gas, Wasser, Solar, Heizöl)
- [x] Automatische kWh-Umrechnung für Gas
- [x] Wasserabrechnung mit Gartenabzug
- [x] Budget-Alerts
- [x] Dark / Light Mode
- [x] Docker-Deployment via GitHub Actions
- [x] Tarif-Historie pro Zähler
- [x] Zählerstand per Foto erfassen (OCR)
- [x] PDF-Export der Ablesungen
- [x] CSV-Import

---

## 📄 Lizenz

MIT © [saez24](https://github.com/saez24)
