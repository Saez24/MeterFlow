# MeterFlow-Mono — Blueprint

> Lebendes Projektdokument. **Nach jedem abgeschlossenen Schritt aktualisieren** (Regel aus CLAUDE.md
> + Projekt-Constraint). Enthält Kontext, Entscheidungen, Stand und nächsten Schritt, damit in einem
> **frischen Chat in diesem Repo** ohne das alte Projekt weitergearbeitet werden kann.

## 1. Ausgangslage (warum dieses Projekt)

Es existierten zwei getrennte MeterFlow-Projekte mit zwei Frontends, die doppelt gepflegt werden mussten:

- `../MeterFlow` — reine Angular-22-SPA, spricht **direkt mit Supabase** (Auth, DB, Storage).
  Featurereich (7 Feature-Module, ~22 Services: OCR, PDF, CSV-Import, CO₂, Tarife, Fernwärme).
- `../MeterFlow-Fullstack` — Monorepo (`frontend/` + `backend/`), Angular spricht per **REST** mit
  **FastAPI** + SQLAlchemy. Auth = JWT in **HttpOnly-Cookies** + Refresh-Rotation. Single-Container
  (nginx + supervisor + uvicorn), Alembic, pytest/Allure.

**Ziel:** ein Monorepo, ein Frontend, ein Django-Backend, getrennt deploybar.

## 2. Getroffene Entscheidungen (verbindlich)

1. **Ein neues Monorepo** (dieses Repo, `MeterFlow-Mono`), Struktur analog `MeterFlow-Fullstack`.
2. Backend **FastAPI → Django + Django REST Framework (DRF)**.
3. **Supabase komplett raus** — kein Dual-Backend, keine Abstraktionsschicht für zwei Backends.
4. **UI-Basis = das Supabase-Frontend** (`../MeterFlow/src`, featurereicher); Datenschicht wird auf
   REST/Django umgebaut. Das Fullstack-Frontend ist die **Vorlage** für REST-Client + Cookie-Auth.
5. Getrennt deploybar: **Frontend allein / Backend allein / Fullstack (ein Container)** → 3 Images.
6. **Angular Material RAUS** → eigenes cleanes **Apple-Design** mit Light/Dark. Token-System als
   Inspiration aus `../DataForge/src/styles.scss` (nur Tokens + `.df-*`-Komponenten, nicht Materials).
7. Durchgängig **Angular-22-Idiome**: `httpResource`/`resource`, **Signal Forms**, `@Service()`,
   `injectAsync()`, neuer Kontrollfluss, FetchBackend, `@angular/aria`. (Quellen gelesen:
   angulararchitects.io v22-Überblick + angular.dev/events/v22.)
8. **Auth = JWT in HttpOnly-Cookies** (SameSite=Strict, Secure, Refresh-Rotation) — passt zur
   User-Security-Vorgabe.
9. **Kontext-Übertrag = Doku im Repo** (kein JSONL-Transcript-Kopieren).
10. **API-Casing = durchgängig `camelCase`** (Request + Response). DRF `djangorestframework-camel-
    case` an der API-Grenze; Model-/Serializer-Felder intern `snake_case`. Der Frontend-Mapper
    entfällt. (API_CONTRACT §12.1)
11. **Default-Branch = `main`** (nicht `master`) — GitHub-Vorgabe.

## 3. Verbindliche Constraints

- **KEIN CDN — alles lokal.** Fonts self-hosted (WOFF2 in `frontend/public/fonts/`), alle Libs via
  npm gebündelt (Chart.js, jsPDF, Tesseract inkl. WASM/Worker, PapaParse), Icons als lokale Inline-SVGs.
  CSP-Ziel `default-src 'self'`. Keine externen `<script>`/`<link>`/Font-CDNs.
- **Blueprint nach JEDEM Schritt fortschreiben.**
- Python 3.14, Node 24 LTS, PEP8/Black/ruff/mypy strict, Tests strikt OOP (siehe CLAUDE.md).

## 4. Zielarchitektur (Kurzform)

```
MeterFlow-Mono/
├── frontend/   # Angular 22 (aus MeterFlow-Supabase, Datenschicht → REST, Material raus)
├── backend/    # Django + DRF: config/ + apps/{accounts,meters,readings,co2,stats,common}
├── deploy/     # Dockerfile.{frontend,backend,fullstack} + nginx.*.conf + supervisord.conf
├── docs/       # MIGRATION_PLAN.md (vollständiger Plan)
├── docker-compose.yml / docker-compose.fullstack.yml
└── .github/workflows/  # test-backend, test-frontend, build-and-push (3 Images)
```

Deploy-Modi: **A** Frontend-only (apiUrl=externe URL) · **B** Backend-only (headless API, CORS) ·
**C** Fullstack (apiUrl=`/api/v1`, ein Container).

Vollständiger Plan: **[docs/MIGRATION_PLAN.md](docs/MIGRATION_PLAN.md)**.

## 5. Workstreams (Überblick)

- **WS1** Repo-Scaffold + Kontext-Übertrag (Lukas/Max/Niko)
- **WS2** Django-Backend: Models/Auth/DRF-Endpunkte/Storage/Migrations/Tests (Jens/Sascha/Kai/Ben)
- **WS3** Frontend Datenschicht Supabase→REST + Angular-22-Idiome (Kilian/Finn)
- **WS3b** Design-System: Material raus → Apple-Design Light/Dark (Isabel/Kilian/Jelena)
- **WS4** Deployment & CI: 3 Dockerfiles + compose + GH-Actions (Niko)
- **WS5** Security-Gate + Doku (Elena/Lukas)

Empfehlung: **Contract-First** — REST-Endpunkt-Liste zuerst fixieren, dann WS2/WS3 parallel.

## 6. Aktueller Stand

**WS3b (Design-Fundament) — gestartet.** 🟡 · **WS2 (Backend) — funktional fertig.** ✅ · **Contract-First** ✅ · **WS1** ✅

**WS3b — Design-System-Fundament (dieser Schritt):**
- [x] MeterFlow-Angular-App (Angular 22, 7 Feature-Module) nach `frontend/` übernommen
      (`src/`, `angular.json`, `package.json`, tsconfig). `npm install` (Node 26) + `npm run build`
      **grün** (nur bekannte CommonJS-Warnungen von tesseract/jspdf/papaparse).
- [x] **Kanonische Design-Tokens** `src/styles/_design-tokens.scss` (Apple, Light/Dark via
      `:root` + `[data-theme='dark']`, aus DataForge, **ohne Material**): `--bg/--bg-card/--text-1..3/
      --accent/--border/--r-sm..xl/--shadow-*/--blur`. Font = Apple-System-Stack (**kein CDN**;
      self-hosted DM Sans WOFF2 später möglich). Additiv in `styles.scss` eingebunden — Material
      koexistiert noch, wird modulweise entfernt.
- [x] **Basis-Komponenten** (`_ui-components.scss` `.df-btn/.df-card/.df-field/.df-input`) +
      Standalone Angular-22-Komponenten `app-button` (Signal-Inputs variant/size/block/disabled)
      und `app-icon` (Inline-SVG-Registry, **kein Material-Icon-Font**, XSS/CSP-sicher via `[attr.d]`).
      5 Vitest-Specs grün (`ng test --include`).
- [x] ThemeService bereits vorhanden & passend (Signal mode light/dark/system, `prefers-color-scheme`,
      localStorage, setzt `data-theme` auf `<html>`) — übernommen.

Noch offen in WS3b (nächste Schritte):
- [ ] **Material entfernen** (21 Dateien importieren `@angular/material`/`@angular/cdk`) — modulweise
      auf `.df-*`/`app-*` migrieren; danach `@angular/material`+`@angular/cdk` aus `package.json`.
- [ ] Weitere Basis-Komponenten: Dialog/Overlay, Select, Toast/Notification, Tabs.
- [ ] Signal Forms für die Formulare (zusammen mit Input-Migration).

**WS2 — Django-Backend (fertig):**
- [x] `backend/.venv` + Deps installiert (Django 5.2→6.0, DRF, `djangorestframework-camel-case`,
      `django-cors-headers`, `django-ratelimit`, `django-storages`, `psycopg`, `dj-database-url`,
      `pyjwt`, `argon2-cffi`). `pyproject.toml` mit ruff/black/mypy/bandit/pytest-Konfig.
- [x] Projekt-Scaffold: `manage.py`, `config/settings/{base,dev,prod}.py` (Split, Prod-Härtung:
      HSTS, SSL-Redirect, Secure-Cookies, Secret/DB-URL-Pflicht), `config/{urls,wsgi,asgi}.py`.
- [x] `apps/accounts`: **Custom User** (E-Mail-Login, UUID, kein Username) + **JWT-Cookie-Auth**
      (`CookieJWTAuthentication`), Access-Token (PyJWT HS256, 15 min, Claims sub/email), opaker
      **Refresh-Token gehasht (SHA-256) in DB, Rotation + Revoke**, Cookie-Flags aus Settings
      (HttpOnly/Secure/SameSite, Refresh-Cookie path-scoped). Endpunkte register/login/refresh/
      logout/me, Rate-Limits 2/3 pro Minute (→ 429). Argon2-Passwort-Hashing.
- [x] `apps/common`: abstrakte Basis-Models (`UUIDTimestampedModel`, `OwnedModel`), `IsOwner`,
      `/health`, `/config`.
- [x] Domain-Apps **meters / readings / co2 / stats**: Models (Feldparität §10), Serializer,
      ViewSets/Views mit **Ownership-Scoping** (fremde Zeile → 404), URLs. Reading-**Berechnung**
      (`compute_reading`/`recalculate`) + **Stats-Aggregation** (`build_year_stats`, YoY,
      Budget-Alerts) + `calculate_co2` **1:1 aus dem FastAPI-Backend portiert**.
- [x] `camelCase` an der API-Grenze via `djangorestframework-camel-case` (Renderer + Parser global).
- [x] **Verifiziert:** `manage.py check` clean, `makemigrations`+`migrate` (sqlite) grün,
      **End-to-End-Smoke-Test grün** (Register→me→Meter-CRUD→Reading mit korrekter Kostenberechnung
      200 kWh→89,30 €→Dashboard→Logout; camelCase-Wire-Format bestätigt; anonym→401). ruff + black clean.

- [x] **Test-Suite** (Ben): pytest-django, **strikt OOP** (BaseTest, API-Service-Klassen mit
      `@allure.step`, Pydantic-Request/Response-Modelle mit camelCase-Alias, `DataGenerator`,
      Allure-Metadaten epic/feature/story/severity, AAA-Pattern, kein `sleep`). **30 Tests grün,
      91 % Coverage** (`apps/`). Deckt Auth-Flow (register/login/refresh/logout/me + Rate-Limit-429),
      Meter-CRUD + Filter, Reading-Berechnung (electricity **und** gas), CO₂-Upsert/Defaults,
      Stats/Dashboard/Budget-Alerts und **Ownership-Isolation** (User A ↔ B → 404) ab.
      ruff + black clean.

- [x] **Import-Endpunkt** `POST /api/v1/import/` (Bulk, camelCase, §8) — aus FastAPI portiert:
      ID-Mapping, Idempotenz (skip bei vorhandener eigener id), Ownership (fremde Zeile → 403),
      Datums-/UUID-Validierung (→ 400), `transaction.atomic`, Rate-Limit 5/min. 4 Tests (Create,
      Idempotenz, Fremd-Row→403, Auth). **Damit alle 26 Contract-Endpunkte implementiert.**

- [x] **Foto-Upload** `POST /readings/{id}/photo/` (multipart, §12.4): Content-Type-/Extension-/
      Größen-Validierung (10 MiB), Ownership (→404), speichert via `default_storage`, setzt
      `reading.photo` = URL. **Storage-Backend** (`STORAGES`) konfiguriert: lokales FS (dev) /
      **S3-MinIO private + signierte URLs** (prod) je nach `STORAGE_BACKEND`. 4 Tests.

- [x] **Stats-Decimals vereinheitlicht**: Custom-Renderer `CamelCaseDecimalRenderer` rendert
      `Decimal` global als String → Stats-Endpunkte konsistent mit CRUD (keine Float-Präzisionsverluste).

- [x] **mypy strict clean** über **84 Dateien** (apps + config + tests) mit `django-stubs` +
      `djangorestframework-stubs`. Typed-User-Helfer `request_user()` (narrowt `request.user`),
      `ClassVar`/`Literal`-Fixes, gezielte Overrides für untypisierte Libs (allure/ratelimit/
      camel-case). **Voller `/verify`-Gate grün: ruff · black · mypy · pytest 38 (91 %) · bandit
      0 Issues · pip-audit 0 CVEs.**

Noch offen in WS2 (Infra, → WS4/Deployment):
- [ ] Rate-Limiting nutzt Default-LocMemCache → in Prod auf Redis.

**Contract-First (nach WS1):**
- [x] `docs/API_CONTRACT.md` aus dem FastAPI-Backend abgeleitet (26 Endpunkte: auth, meters,
      readings, co2-factors, stats, config, import, health). Enthält Pfade, Request/Response-
      Schemas, Cookie-Semantik (HttpOnly/Secure/SameSite=Strict, 15min/7d, Refresh-Rotation),
      Rate-Limits, Fehlerformat, Datenmodell-Feldparität für Migrations, Endpunkt-Checkliste.
- [x] Offene Entscheidungen für den Django-Port markiert (§12): **Casing** (Domain snake_case vs.
      Import camelCase — Empfehlung: API durchgängig camelCase, Frontend-Mapper entfällt),
      Fehlerformat, Trailing Slashes, Foto-Upload/Storage nachziehen, Rate-Limiting-Backend, CSRF.

Erledigt:
- [x] Neues Repo `MeterFlow-Mono` (`git init`) + Monorepo-Ordnerstruktur (frontend/backend/deploy/docs).
- [x] `CLAUDE.md` + `.claude/` (Agents, Skills, Standards, Rules) übernommen (ohne `settings.local.json`).
- [x] `.editorconfig`, `.prettierrc` übernommen.
- [x] `blueprint.md` (dieses Dokument) angelegt.
- [x] Plan nach `docs/MIGRATION_PLAN.md` kopiert.
- [x] Root-`README.md`, `.env.example` (Django-Variablen), `.gitignore`.
- [x] Projekt-Kontext-Memory-Eintrag (`project-meterflow-mono-migration`).

Noch **nicht** gemacht (bewusst, für spätere Workstreams):
- Angular-App noch nicht nach `frontend/` kopiert (Teil von WS3).
- Django-Projekt noch nicht initialisiert (Teil von WS2).
- Noch **kein** git commit (erst auf ausdrückliche Freigabe).

## 7. Nächster Schritt

**Fundament steht** (App im Monorepo, Tokens, Theme, Basis-Komponenten, Build+Tests grün).

Weiter in **WS3b — Material entfernen, modulweise**: pro Feature-/Shared-Komponente die `mat-*`
durch `.df-*`/`app-*` ersetzen (Button/Input/Select/Dialog/Icon/Tabs/Snackbar), fehlende Basis-
Komponenten (Dialog/Overlay, Select, Toast) dabei ergänzen, Formulare auf **Signal Forms**. Sinnvolle
Reihenfolge: erst die kleinen Shared-Komponenten (`confirm-dialog`, `tariff-form`), dann Feature-Module.
Am Ende `@angular/material` + `@angular/cdk` aus `package.json`.

Parallel möglich: **WS3** (Datenschicht Supabase→REST gegen das laufende Backend) und **WS4**
(Docker/CI inkl. Redis).

## 8. Referenz-Quellen (aus den Altprojekten)

- Domäne/Models: `../MeterFlow-Fullstack/backend/src/meterflow/models/`
- Auth-Logik: `../MeterFlow-Fullstack/backend/src/meterflow/auth/service.py`
- Endpunkte: `../MeterFlow-Fullstack/backend/src/meterflow/routers/`
- REST-Client + Cookie-Interceptor: `../MeterFlow-Fullstack/frontend/src/app/core/{services/api.service.ts,interceptors/credentials.interceptor.ts}`
- DB-Schema-Kontrakt (UI-Quelle): `../MeterFlow/supabase/migrations/*.sql`
- Design-Tokens + Theme: `../DataForge/src/styles.scss`, `../DataForge/src/app/core/services/app-state.service.ts`

## Änderungslog

- (WS1) Repo-Scaffold + Team-Config übernommen, blueprint/README/.env.example/.gitignore/docs
  angelegt, Plan nach docs/MIGRATION_PLAN.md kopiert, Projekt-Memory-Eintrag erstellt. **WS1 done.**
- (Contract-First) `docs/API_CONTRACT.md` aus dem FastAPI-Backend abgeleitet (26 Endpunkte inkl.
  Schemas, Cookie-/Auth-Semantik, Rate-Limits, Datenmodell-Feldparität, offene Django-Port-
  Entscheidungen §12). Nächster Schritt: Casing-Entscheidung, dann WS2 + WS3b parallel.
  **Contract-First done.**
- (Entscheidungen) API-Casing = durchgängig **camelCase** festgelegt (§12.1 als ENTSCHIEDEN
  markiert); Default-Branch von `master` → **`main`** umbenannt (GitHub-Vorgabe).
- (WS2) Django-Backend-Fundament gebaut: Scaffold + Settings-Split (Prod-Härtung), Custom-User +
  JWT-Cookie-Auth mit Refresh-Rotation (Argon2, SHA-256-Hash, path-scoped Refresh-Cookie),
  Domain-Apps meters/readings/co2/stats mit Ownership-Scoping, Reading-/Stats-/CO₂-Berechnung
  1:1 aus FastAPI portiert, camelCase via DRF-camel-case. `check`/`migrate`/Smoke-Test/ruff/black
  grün. Offen: Import-Endpunkt, Foto-Upload, pytest-Suite, mypy-strict, Stats-Decimal-Format.
  **WS2-Fundament done (🟡 Rest offen).**
- (WS2) Alle Backend-Deps auf **neueste Versionen** aktualisiert und **Version-Pins entfernt**
  (`pyproject.toml` = bare Paketnamen) — u.a. **Django 6.0.6**, DRF 3.17. Check/Migrate/Smoke/
  ruff/black erneut grün. Projektvorgabe: Pakete nie festschreiben, immer latest installieren.
- (WS2/Ben) pytest-django-Test-Suite aufgebaut (strikt OOP, Allure, Pydantic-Modelle, DataGenerator,
  Ownership-/Auth-/Berechnungs-Tests): **30 Tests, 91 % Coverage**, ruff+black clean.
  Offen: Import-Endpunkt, Foto-Upload, mypy-strict, Stats-Decimal-Format.
- (WS2/Sascha) **Import-Endpunkt** `POST /api/v1/import/` aus FastAPI portiert (ID-Mapping,
  Idempotenz, Ownership→403, atomic, Rate-Limit) + 4 Tests. Suite jetzt **34 Tests, 90 % Coverage**.
  Alle 26 Contract-Endpunkte implementiert. Offen: Foto-Upload, mypy-strict, Stats-Decimal-Format.
- (WS2) **Foto-Upload** (`POST /readings/{id}/photo/`, multipart, Validierung, Storage local/S3),
  **Stats-Decimal-Renderer** (Decimal→String global), **mypy strict clean** (84 Dateien) +
  **bandit 0 / pip-audit 0**. Backend-`/verify`-Gate vollständig grün. **38 Tests, 91 % Coverage.**
  Einziger WS2-Restpunkt: Rate-Limit-Cache → Redis (Infra, WS4).
- (WS3b/Isabel+Kilian) **Design-Fundament**: MeterFlow-App nach `frontend/` übernommen (Build grün),
  kanonische Apple-Tokens Light/Dark (`_design-tokens.scss`, ohne Material, kein CDN), Basis-Klassen
  `.df-*` + Standalone-Komponenten `app-button`/`app-icon` (Angular-22-Signal-Inputs, Inline-SVG),
  5 Vitest-Specs grün. Material koexistiert noch (21 Dateien) → modulweise Entfernung als nächstes.
