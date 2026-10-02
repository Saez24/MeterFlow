# MeterFlow

**Self-hosted Verbrauchs- & Kostentracker für Strom, Gas, Wasser & Co.**

![License: MIT](https://img.shields.io/badge/License-MIT-blue) ![Angular](https://img.shields.io/badge/Angular-22-dd0031) ![Django](https://img.shields.io/badge/Django-6-092e20)

MeterFlow erfasst deine Zählerstände (auch per Foto mit On-Device-Texterkennung), berechnet
Verbrauch, Kosten und CO₂ pro Energieart und liefert Dashboards, Auswertungen und eine
Jahres-Kostenprognose. Alles **self-hosted**, ohne Cloud-Abhängigkeit – ein Angular-22-Frontend
und ein Django/DRF-Backend als Monorepo, **getrennt oder gemeinsam** deploybar.

> Konsolidiert die beiden Altprojekte (`MeterFlow` mit Supabase, `MeterFlow-Fullstack` mit FastAPI)
> in einen Stack. Status: **Pre-1.0** – siehe [blueprint.md](blueprint.md).

## Features

- **Zähler & Ablesungen** – 7 Energiearten; Ablesungen mit serverseitig berechnetem Verbrauch,
  kWh, Kosten und Abwasser. Gas-Umrechnung (Brennwert × Zustandszahl), Fernwärme nach
  Anschlussleistung, Gartenwasser-Abzug vom Hauptzähler.
- **Foto & OCR** – Foto-Upload (JPG/PNG/WebP/HEIC, ≤ 10 MB, HEIC wird automatisch konvertiert) mit
  **On-Device-Texterkennung** (Tesseract.js/WASM, lokal gebündelt, kein CDN), die den Zählerstand
  direkt aus dem Bild ausliest.
- **Tarife & Kosten** – Tarifhistorie mit Gültigkeitszeiträumen (Arbeitspreis, Grundgebühr,
  Abwasser, Emissionspreis, Fernwärme-Bereitstellung) und **Jahres-Kostenprognose**.
- **CO₂** – Emissionsfaktoren je Energieart (UBA/AGFW-Standardwerte, editierbar mit Quellenangabe).
- **Auswertungen** – Dashboard (Monats-/Jahreskosten, CO₂, Budget-Warnungen, Jahresvergleich),
  Diagramme (Chart.js) und **PDF-Jahresabrechnung** (jsPDF).
- **Import/Export** – vollständiger JSON-Export/-Import sowie **CSV-Import** (Datum/Wert/Notiz) mit
  Duplikat- und Fehler-Vorschau vor dem Übernehmen.
- **App** – installierbare **PWA** (Service Worker), Light/Dark/System-Theme, optionale monatliche
  Ablese-Erinnerung. UI auf Angular Material, Apple-artig gethemt.
- **Sicherheit** – Auth über **JWT in HttpOnly-Cookies** mit Refresh-Rotation und serverseitigem
  Logout, strikte Pro-Nutzer-Datentrennung (Ownership), unveränderliches **Audit-Log**,
  Rate-Limiting und eine strenge Content-Security-Policy (per-Request-Nonce, kein CDN).

## Unterstützte Zählertypen

| Typ          | Einheit | Besonderheit                                     |
| ------------ | ------- | ------------------------------------------------ |
| Strom        | kWh     | –                                                |
| Gas          | m³      | Umrechnung in kWh über Brennwert × Zustandszahl  |
| Wasser       | m³      | zzgl. Abwassergebühr                             |
| Gartenwasser | m³      | abwasserfrei, verknüpfbar mit Hauptwasserzähler  |
| Heizöl       | Liter   | –                                                |
| Solar        | kWh     | negative CO₂-Bilanz (Gutschrift)                 |
| Fernwärme    | MWh     | Bereitstellungspreis nach Anschlussleistung (kW) |

## Tech-Stack

- **Frontend:** Angular 22 (Standalone, Signals, PWA) · Angular Material (Apple/DataForge-Theme) ·
  Chart.js · Tesseract.js · jsPDF · PapaParse
- **Backend:** Django 6 + Django REST Framework · PostgreSQL (psycopg 3) · Redis · Gunicorn ·
  Argon2 · WhiteNoise
- **Laufzeiten:** Python 3.14 · Node 24 · nginx

## Struktur

```
frontend/   Angular 22 (Zoneless, Signals, PWA) — Angular Material, Apple/DataForge-artig gethemt
            + eigene .df-*/app-*-Komponenten
backend/    Django + Django REST Framework (Custom User, JWT-HttpOnly-Cookie-Auth)
deploy/     Dockerfiles (frontend / backend / fullstack) + nginx + supervisor
```

## Deploy-Modi

| Modus | Image                         | Beschreibung                                         |
| ----- | ----------------------------- | ---------------------------------------------------- |
| A     | `deploy/Dockerfile.frontend`  | Nur Frontend (nginx), `apiUrl` = externe Backend-URL |
| B     | `deploy/Dockerfile.backend`   | Nur Django-API (headless), CORS auf erlaubte Origins |
| C     | `deploy/Dockerfile.fullstack` | Alles in einem Container (nginx + Django)            |

> **Postgres und Redis sind nicht Teil des Stacks** — sie laufen als separate/externe
> Container. `DATABASE_URL` / `REDIS_URL` zeigen per `.env` auf sie (routbare Host/IP oder
> gemeinsames Docker-Netzwerk). Siehe `docker-compose.yml`.

## Installation / Schnellstart

**Voraussetzungen:** Docker · eine erreichbare **PostgreSQL**- **und** **Redis**-Instanz · für den
Produktivbetrieb ein HTTPS-Reverse-Proxy davor (z. B. Nginx Proxy Manager).

```bash
# 1. Konfiguration anlegen und anpassen (mind. DATABASE_URL, REDIS_URL, DJANGO_SECRET_KEY)
cp .env.example .env

# 2a. Fullstack — alles in einem Container → http://localhost:8080
docker compose -f docker-compose.fullstack.yml up --build

# 2b. …oder Frontend + Backend getrennt → http://localhost:8080
docker compose up --build
```

Secret erzeugen: `python -c "import secrets; print(secrets.token_urlsafe(64))"`.
Details siehe **Umgebungsvariablen** und **Deployment auf Unraid** unten.

## Umgebungsvariablen

Alle Variablen werden vom Backend über die Prozess-Umgebung gelesen (`config/settings/`),
lokal zusätzlich aus einer `.env` im Repo-Root (`.env.example` als Vorlage). Reale Umgebungs­
variablen haben Vorrang vor der `.env`.

### Pflicht (Produktion — Container startet sonst nicht)

| Variable               | Beispiel                              | Zweck                                                                                                                    |
| ---------------------- | ------------------------------------- | ------------------------------------------------------------------------------------------------------------------------ |
| `DJANGO_ENV`           | `production`                          | aktiviert die gehärteten Prod-Settings                                                                                   |
| `DJANGO_SECRET_KEY`    | _(64 Zeichen zufällig)_               | Prod bricht ab bei leer/Default/`build-time-*`. Erzeugen: `python -c "import secrets; print(secrets.token_urlsafe(64))"` |
| `DATABASE_URL`         | `postgres://user:pass@ip:5432/dbname` | Prod bricht ab wenn unset. Format `postgres://USER:PASS@HOST:PORT/DB`                                                    |
| `REDIS_URL`            | `redis://ip:6379/0`                   | Prod bricht ab wenn unset — geteilter Rate-Limit-Cache über die Gunicorn-Worker                                          |
| `DJANGO_ALLOWED_HOSTS` | `meterflow.example.com`               | Default `localhost,127.0.0.1` → sonst HTTP 400. Kommagetrennt (Loopback wird automatisch ergänzt)                        |

### Empfohlen

| Variable               | Beispiel                        | Default / sonst                                                                        |
| ---------------------- | ------------------------------- | -------------------------------------------------------------------------------------- |
| `CSRF_TRUSTED_ORIGINS` | `https://meterflow.example.com` | Default `http://localhost:4200`; sonst scheitert der Login-POST an CSRF. Kommagetrennt |

### HTTPS / Cookies (hinter Reverse-Proxy)

Das Backend erwartet HTTPS-Terminierung durch einen Reverse-Proxy (z. B. Nginx Proxy Manager),
der `X-Forwarded-Proto: https` setzt. Die Defaults sind dann korrekt — **nichts setzen**.
Nur für einen reinen HTTP-Test (ohne Proxy) beide abschalten, sonst Redirect-Loop + keine Cookies:

| Variable              | Default    | Für Plain-HTTP-Test |
| --------------------- | ---------- | ------------------- |
| `SECURE_SSL_REDIRECT` | `1` (prod) | `0`                 |
| `AUTH_COOKIE_SECURE`  | `1` (prod) | `0`                 |

### Optional (Defaults meist ausreichend)

| Variable                        | Default                 | Zweck                                                                              |
| ------------------------------- | ----------------------- | ---------------------------------------------------------------------------------- |
| `DJANGO_DEBUG`                  | `0` (prod)              | niemals `1` in Produktion                                                          |
| `CORS_ALLOWED_ORIGINS`          | `http://localhost:4200` | nur bei getrenntem Frontend-Origin (Modus A/B); beim Fullstack same-origin unnötig |
| `JWT_SIGNING_KEY`               | = `DJANGO_SECRET_KEY`   | separater JWT-Schlüssel (optional)                                                 |
| `ACCESS_TOKEN_LIFETIME_MINUTES` | `15`                    | Access-Token-Lebensdauer                                                           |
| `REFRESH_TOKEN_LIFETIME_DAYS`   | `7`                     | Refresh-Token-Lebensdauer                                                          |
| `AUTH_COOKIE_SAMESITE`          | `Strict`                | SameSite-Flag der Auth-Cookies                                                     |
| `GUNICORN_WORKERS`              | `3`                     | Anzahl Gunicorn-Worker (Backend- & Fullstack-Image)                                |
| `STORAGE_BACKEND`               | `local`                 | `local` oder `s3`                                                                  |
| `LOCAL_STORAGE_PATH`            | `/app/media` (Image)    | Ablage der Zählerfotos bei `local` → als Volume persistieren!                      |

### Nur bei `STORAGE_BACKEND=s3`

| Variable               | Default     | Zweck                               |
| ---------------------- | ----------- | ----------------------------------- |
| `S3_BUCKET_NAME`       | —           | Bucket-Name                         |
| `S3_ENDPOINT_URL`      | _(AWS)_     | z. B. `http://minio:9000` für MinIO |
| `S3_ACCESS_KEY_ID`     | —           | Access Key                          |
| `S3_SECRET_ACCESS_KEY` | —           | Secret Key                          |
| `S3_REGION_NAME`       | `us-east-1` | Region                              |

### Nur Frontend-Image (Modus A)

| Variable      | Default               | Zweck                                                              |
| ------------- | --------------------- | ------------------------------------------------------------------ |
| `BACKEND_URL` | `http://backend:8000` | nginx-Proxy-Ziel für `/api` (zur Container-Startzeit substituiert) |

## Deployment auf Unraid (Fullstack-Image)

Einfachster Weg: ein Container aus `deploy/Dockerfile.fullstack` hinter einem HTTPS-Reverse-Proxy.

**Container-Settings (nicht-Env):**

- **Port:** Host-Port → Container **80**
- **Volume (persistente Fotos):** Container `/app/media` → z. B. `/mnt/user/appdata/meterflow/media`

**Minimal-Env (hinter HTTPS-Proxy):**

```env
DJANGO_ENV=production
DJANGO_SECRET_KEY=<langer-zufallswert>
DATABASE_URL=postgres://user:pass@192.168.188.47:5432/meterflow
REDIS_URL=redis://192.168.188.47:6379/0
DJANGO_ALLOWED_HOSTS=meterflow.example.com
CSRF_TRUSTED_ORIGINS=https://meterflow.example.com
```

> Laufen Postgres/Redis selbst als Docker-Container auf Unraid, häng den MeterFlow-Container
> ins selbe Custom-Docker-Netzwerk und nutze die Container-Namen statt einer IP.

## Lokale Entwicklung

`.env.example` nach `.env` kopieren und mindestens `DATABASE_URL` / `REDIS_URL` auf deine
externen Postgres/Redis setzen (Postgres/Redis werden **nicht** vom Compose gestartet):

```bash
cp .env.example .env
# .env anpassen (DATABASE_URL, REDIS_URL, DJANGO_SECRET_KEY …)

docker compose up --build                 # Django-API + Angular/nginx → http://localhost:8080
# oder alles in einem Container:
docker compose -f docker-compose.fullstack.yml up --build
```

Ohne Docker, mit lokalen Toolchains:

```bash
# Backend (Dev-Settings, sqlite-Default wenn DATABASE_URL leer)
cd backend && pip install ".[dev]" && python manage.py migrate && python manage.py runserver

# Frontend (proxyt /api → :8000, siehe proxy.conf.json)
cd frontend && npm ci && npm start        # http://localhost:4200
```

## Sicherheit

Die verbindlichen Sicherheitsregeln stehen in
[`.claude/skills/security-standards.md`](.claude/skills/security-standards.md) (OWASP Top 10,
Auth, CSP, Audit, CI/CD). Kurz: JWT nur in HttpOnly-Cookies, Refresh-Rotation mit
Reuse-Detection, App-Layer-Ownership auf jeder Query, unveränderliches Audit-Log, Rate-Limiting,
`Content-Security-Policy` mit per-Request-Nonce, alle Assets self-hosted (kein CDN).

## Lizenz

[MIT](LICENSE) © 2026 Saez24.

## Status

Siehe **[blueprint.md](blueprint.md)** — wird nach jedem Schritt fortgeschrieben.
