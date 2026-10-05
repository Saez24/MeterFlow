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
6. **Angular Material BLEIBT — DataForge-artig gethemt** (Regeländerung 2026-07-03; ersetzt die
   frühere „Material RAUS"-Entscheidung). Apple-Look via `mat.define-theme` (azure/green,
   System-/DM-Sans-Typo, Density -1) + Token-System + `.df-*`/`app-*`-Custom-Komponenten obendrauf —
   genau wie DataForge (das ebenfalls auf Material sitzt). Keine flächige Material-Entfernung mehr.
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
12. **Supabase-Variante als Branch `supabase`** (2026-10-03) — ersetzt das alte Repo
    `Saez24/MeterFlow`. Gleiches Frontend, nur `api.service.ts` (gleiche öffentliche API) läuft gegen
    Supabase; Schema in `supabase/migrations/`. Entscheidung 3 („Supabase komplett raus") gilt
    weiter für `main`. Workflow: `git switch supabase && git merge main`; neue Model-Felder auf
    `supabase` als **neue Migration + Mapper** nachziehen. Details: `SUPABASE.md` auf dem Branch.

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

**Stand 2026-10-05 (beide Branches):**

| Thema | `main`/`production` (Django, Docker) | `supabase` (Webspace per FTP) |
|---|---|---|
| Foto-Upload, HEIC → JPEG bei Auswahl, Fehler sichtbar | ✅ | ✅ |
| Zählerstand-Erkennung: Zuschneide-Werkzeug, Abgleich mit Vor-/Folgestand, m³ = 3 Nachkommastellen | ✅ | ✅ |
| CSP | nginx mit Nonce, `worker-src`/`img-src` + `blob:` | `.htaccess`, ohne Nonce, scharf (vorher Report-Only getestet) |
| Impressum/Datenschutz in der App | ❌ (nicht vorhanden) | ✅ `/impressum`, `/datenschutz` |
| Besucherstatistik Umami | ❌ | ✅ (selbst gehostet, IDs in URLs → `:id`) |
| Favicon/Apple-Touch-Icon (MeterFlow-Logo) | ✅ | ✅ |

**WS5 (Security-Gate) — bestanden.** ✅ · **WS4 (Deploy)** ✅ · **WS3 (Datenschicht)** ✅ · **WS3b (Design)** 🟢 · **WS2 (Backend)** ✅ · **Contract-First** ✅ · **WS1** ✅

**WS5 — Security-Gate & Doku (Elena/Lukas):**
- [x] Vollständiger `security-standards.md`-Durchlauf → **[docs/SECURITY_REVIEW.md](docs/SECURITY_REVIEW.md)**
      (OWASP-Top-10-Tabelle, Findings + Severity, §12-Blocking-Checkliste). **Verdict: PASS** (keine
      offenen §12-Blocker im Code).
- [x] **Blockierende §5-Lücke geschlossen: Audit-Logging (SOX).** `AuditLog`-Modell (immutable,
      Admin read-only) + `record_audit()`-Helper, verdrahtet in Auth (register/login/login_failed/
      logout) + Meter/Reading/CO₂-Mutationen. 2 Tests. Migration erstellt.
- [x] Automatisierte Scans: **keine Secrets** im Source, **kein `.env`** committed, **keine Tokens/PII
      in localStorage** (Auth = nur Cookies), **kein innerHTML/eval**. `check --deploy` = 0, pip-audit/
      npm-audit = 0. Cookie-Flags/CORS/CSP/Rate-Limiting/Ownership bestätigt.
- [x] Voller Backend-Gate grün: ruff · black · mypy (87) · bandit 0 · **40 Tests**.

- [x] **Finding 2 (§4 Media-Access) behoben**: öffentliches `/media/` durch **authentifizierten,
      ownership-geprüften Endpunkt** `GET /api/v1/readings/{id}/photo/` ersetzt (fremder User → 404);
      `photo` speichert internen Storage-Key, Serializer liefert Endpunkt-URL; `/media/`-nginx-Block
      entfernt. Tests (`test_cannot_fetch_foreign_photo`). **41 Backend-Tests grün.**

Deploy-Zeit-Follow-ups (vor Produktion, in SECURITY_REVIEW dokumentiert):
- [ ] **Actions per SHA pinnen** (§11) — `# TODO(§11)` in Workflows.
- [ ] Realer `docker compose up`-E2E-Durchlauf (kein Docker in dieser Umgebung).

**WS4 — Deployment (Schritt 1: Docker/Compose):**
- [x] **3 Dockerfiles** in `deploy/`: `Dockerfile.fullstack` (Angular-Build + Django/gunicorn + nginx +
      supervisor, mode C), `Dockerfile.backend` (headless gunicorn, mode B), `Dockerfile.frontend`
      (nginx + SPA, `/api`→externes Backend via `envsubst`, mode A). Non-root `appuser`, Healthchecks.
- [x] **nginx**: `nginx.fullstack.conf` (CSP-Nonce via `sub_filter`, Rate-Limits auth/api, Security-
      Header, `/api`+`/health`+`/admin`+`/django-static`+`/media`-Routing) + `nginx.frontend.conf.template`
      (envsubst `${BACKEND_URL}`, `NGINX_ENVSUBST_FILTER` schützt nginx-Vars). `supervisord.conf`,
      `entrypoint.sh` (sub_module-Guard → `manage.py migrate` → supervisord), `entrypoint.backend.sh`.
- [x] **Compose**: `docker-compose.yml` (Postgres17 + Redis7 + backend + frontend, App :8080) +
      `docker-compose.fullstack.yml` (Postgres + Redis + Single-Container). `.dockerignore`.
- [x] **Backend deploy-ready**: `pyproject` `[build-system]` (setuptools, `py-modules=[]` → `pip install .`
      zieht nur Deps) + `gunicorn`/`whitenoise`/`redis`; Settings: **Redis-Cache** (Rate-Limit, REDIS_URL),
      whitenoise-Middleware + `CompressedManifestStaticFilesStorage`, `STATIC_URL=/django-static/`
      (kein Clash mit SPA), `prod.py` SSL-Redirect/Secure-Cookie env-überschreibbar. check/collectstatic/
      mypy/ruff/black/38 Tests grün.

- [x] **GitHub Actions** (`.github/workflows/`): **`test-backend`** (ruff/black/mypy/bandit/pip-audit/
      pytest+cov), **`test-frontend`** (prettier/build/vitest/npm-audit), **`build-and-push`** (Matrix
      3 Images → **Trivy blockt HIGH/CRITICAL vor Push** → GHCR, `GITHUB_TOKEN`, `packages: write`).
      Alle CI-Backend-Kommandos lokal verifiziert grün. **Frontend-Codebasis einmal prettier-formatiert**
      (76 Dateien) → `test-frontend` prettier-check grün; Build + 60 Vitest weiter grün.

Noch offen in WS4:
- [ ] **Actions per SHA pinnen** (security-standards §11) — im Repo als `# TODO(§11)` markiert; WS5/Elena
      mit `pin-github-action`/Dependabot (braucht Netz/Tooling).
- [ ] Docker-Build/`compose up` real testen (in dieser Umgebung kein Docker verfügbar).

**WS3 — Frontend-Datenschicht Supabase → REST (Schritt A: Fundament):**
- [x] **`ApiService`** (`core/services/api.service.ts`) — REST-Client gegen das Django-Backend,
      **signaturgleich zu `SupabaseService`** (signIn/Up/Out, getSession, get/add/update/delete für
      Meters+Readings, recalculate, CO₂, Foto-Upload, clearAllUserData, checkConnection). API spricht
      camelCase → nur Date/Decimal-String-Konvertierung, kein snake↔camel-Mapper. Trailing-Slashes
      gemäß DRF-Router.
- [x] **`credentialsInterceptor`** (Cookies via `withCredentials`, 401 → einmaliger Refresh mit
      Request-Queue, sonst → `/auth`). In `app.config` via `withInterceptors` registriert.
- [x] **Environments** auf `apiUrl` umgestellt (`/api/v1`, same-origin), **`proxy.conf.json`**
      (`/api`,`/health` → `:8000`) + `angular.json`-Serve-Proxy. Supabase-Felder bleiben vorerst
      (Koexistenz). Build grün.

**WS3 — Schritt B (Konsumenten + Supabase raus) — fertig:**
- [x] **Alle 11 Konsumenten** auf `ApiService` umgestellt (services/guard/auth/app/settings).
- [x] **Foto-Flow invertiert** (`readings-form`): erst Reading speichern → dann Foto mit `readingId`
      hochladen (Backend setzt `photo` serverseitig). Foto-Entfernen im Edit noch nicht backend-seitig.
- [x] **CO₂-Mapping** in `co2-factor.service` auf camelCase-Response umgestellt.
- [x] **Supabase entfernt**: `supabase.service.ts`/`.spec` gelöscht, `@supabase/supabase-js` raus,
      Supabase-Env-Felder raus. grep über `src/`: **keine** Supabase/CDN-Referenzen mehr.
- [x] **Robustheit**: `MeterService`/`ReadingService`-Loader fangen Fehler ab (kein unhandled reject
      bei 401). Component-Specs mit `ApiService`-Mock (`api.service.mock.ts`). **Build + 60 Vitest grün.**

**WS3b (Design) — Fundament + Apple-Feinschliff fertig:**
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
- [x] **Regeländerung: Material bleibt, DataForge-artig gethemt.** `styles.scss`: `mat.define-theme`
      light/dark mit azure/**green**-Palette, System-Font-Typografie (`plain/brand-family`), **Density -1**;
      Tokens + `.df-*`/`app-*` liegen obendrauf. Build grün. Keine Material-Entfernung mehr nötig.

- [x] **Material-Component-Overrides ausgebaut** (`styles.scss` §10, token-getrieben): Buttons
      (flat/outlined/icon — Radius, Accent, Hover-Scale), Cards, Form-Fields/Inputs (Accent-Fokus),
      Select-/Menu-/Autocomplete-Panels, Dialog + Frosted-Backdrop, Slide-Toggle/Divider/Progress
      (Accent), Snackbar/Toast (success/error/info), Tabs-Mobile-Fix. Alles über Tokens.
- [x] **Fonts self-hosted → CDN entfernt** (Kein-CDN-Regel §3): DM Sans/DM Mono/Material-Icons WOFF2
      nach `frontend/public/fonts/` (aus DataForge), `_fonts.scss` mit `@font-face` + `.material-icons`/
      `mat-icon`-Regel. Google-Fonts-Links (Inter + Material Icons) aus `index.html` gelöscht.
      `--font`/`--mono` + Material-Typo auf DM Sans/Mono. Build lädt Fonts aus `/fonts/`; grep über
      `src/` findet **keine** externen Font/CDN-Referenzen mehr.

Noch offen in WS3b (nächste Schritte):
- [ ] Feinschliff pro Feature-Modul im Browser sichten (Light/Dark-Durchklick), Randfälle nachziehen.

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

**Alle Workstreams (WS1–WS5) im Code abgeschlossen.** Das Django-Monorepo ersetzt Supabase+FastAPI
vollständig: Backend (26 Endpunkte, Audit-Logging), Frontend (REST, Material-DataForge-Style, CDN-frei),
Deployment (3 Images + Compose), CI/CD (Trivy-Gate), Security-Gate bestanden.

**Verbleibend (Deploy-Zeit, brauchen Netz/Docker — nicht in dieser Umgebung machbar):**
1. GitHub Actions per **SHA pinnen** (§11).
2. **Realer Docker-Build + `docker compose up`** E2E-Durchklick (Registrierung→Zähler→Ablesung+Foto→
   Dashboard→CSV/PDF), Images bauen/Trivy-scannen. **Dabei mit offener Console prüfen:** HEIC-Foto,
   Zuschneide-Werkzeug, Zählerstand-Erkennung (die nginx-CSP ist dort von Anfang an scharf).
3. WS3b: optische Light/Dark-Sichtung pro Feature-Modul im Browser.
4. Optional: S3/MinIO-Media als CDN-Offload (Foto-Zugriff ist bereits authentifiziert abgesichert).
5. **Entscheidung offen:** Wird die Docker-Variante (`main`) öffentlich betrieben, braucht sie ebenfalls
   Impressum/Datenschutz und ggf. Umami (aus `supabase` übernehmbar: `features/legal/`,
   `config/analytics.config.ts`, `core/services/page-view-tracker.ts`). Stand 2026-10-05: wird
   **nicht öffentlich** betrieben → bleibt ohne Rechtsseiten/Umami.

**Bekannte technische Schulden (Stand 2026-10-05):**
- **i18n:** Die neuen Templates (Rechtsseiten-Links, `photo-crop`, Foto-/OCR-Hinweise im Formular)
  nutzen wie der Altbestand `i18n="@@…"`-Attribute statt des vorgesehenen Runtime-`LocaleService`.
  Beim Umbau auf `LocaleService` mitnehmen.
- **Zählerstand-Erkennung bei der ersten Ablesung** eines Zählers: ohne Vorstand kein Plausibilitäts-
  abgleich, die Kommaposition ist geraten (bei m³ fest 3 Stellen). Idee: Kommaposition aus früheren
  Ablesungen desselben Zählers übernehmen.
- Die Rechtsseiten sind nur deutsch (auch bei englischer Oberfläche).

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
  kanonische Apple-Tokens Light/Dark (`_design-tokens.scss`, kein CDN), Basis-Klassen `.df-*` +
  Standalone-Komponenten `app-button`/`app-icon` (Angular-22-Signal-Inputs, Inline-SVG), 5 Vitest grün.
- (WS3b, Regeländerung) **Material bleibt, DataForge-artig gethemt** statt raus: `define-theme`
  azure/green + System-Typo + Density -1. Build grün. Entscheidung #6 im Blueprint aktualisiert.
- (WS3b/Isabel) **Apple-Feinschliff**: token-getriebene Material-Overrides (Buttons/Cards/Form-Fields/
  Selects/Dialog/Snackbar/Toggle/Tabs) + **Fonts self-hosted** (DM Sans/Mono/Material-Icons WOFF2),
  **CDN-Font-Links aus index.html entfernt** (Kein-CDN-Regel). Build grün, 5 Vitest grün, kein
  externer Font/CDN-Ref mehr in `src/`.
- (WS3/Kilian, Schritt A) **REST-Fundament**: `ApiService` (camelCase, signaturgleich zu Supabase),
  `credentialsInterceptor` (Cookies + 401-Refresh), `apiUrl`-Environments + `proxy.conf.json`, in
  `app.config` verdrahtet. Build grün, Supabase koexistiert.
- (WS3/Kilian, Schritt B) **Supabase → REST vollzogen**: 11 Konsumenten umgestellt, Foto-Flow invertiert
  (`readingId`), CO₂-camelCase-Mapping, Loader-Fehler abgefangen, `supabase.service`+`@supabase/supabase-js`
  +Env-Felder entfernt, Component-Specs gemockt. **WS3 done — Build + 60 Vitest grün, keine Supabase/CDN-Refs.**
- (WS4/Niko, Schritt 1) **Deployment-Artefakte**: 3 Dockerfiles (fullstack/backend/frontend) + nginx
  (CSP-Nonce, Rate-Limits) + supervisor + entrypoints + 2 Compose-Files (Postgres/Redis) + `.dockerignore`.
  Backend deploy-ready: gunicorn/whitenoise/redis, Redis-Cache, `pip install .`-fähig. check/mypy/lint/38
  Tests grün. Docker in dieser Umgebung nicht verfügbar → Builds noch nicht real getestet. CI = Schritt 2.
- (WS4/Niko, Schritt 2) **CI/CD**: 3 GitHub-Actions-Workflows (test-backend, test-frontend, build-and-push
  mit Trivy-Gate → GHCR). CI-Backend-Kommandos lokal grün; Frontend einmal komplett prettier-formatiert
  (Build+60 Vitest grün). Offen: Actions per SHA pinnen (§11, WS5). **WS4 done.**
- (WS5/Elena+Lukas) **Security-Gate bestanden**: `docs/SECURITY_REVIEW.md` (OWASP-Tabelle, §12-Checkliste),
  **Audit-Logging (SOX §5) implementiert** (AuditLog + record_audit, Auth/Meter/Reading/CO₂, 2 Tests),
  Scans clean (Secrets/`.env`/localStorage/CVEs/Deploy-Check). Backend-Gate grün (ruff/black/mypy/bandit/
  40 Tests). **WS5 done.**
- (WS5/Elena, Follow-up) **§4 Media-Finding behoben**: authentifizierter, ownership-geprüfter Foto-Endpunkt
  `GET /readings/{id}/photo/` (fremd → 404) statt öffentlichem `/media/`; Storage-Key statt Public-URL;
  nginx-`/media/`-Block entfernt; SECURITY_REVIEW aktualisiert. **41 Backend-Tests grün.** Zusätzlich
  Finding 3 (toter `storage.service.ts`) entfernt (Build grün). Alle 3 Review-Findings resolved.
- (WS3/Finn) **Frontend-Service-Tests** ergänzt: `api.service.spec` (Auth, camelCase/Decimal-Mapping,
  ISO-Datum, Foto-Upload, CO₂) + `credentials.interceptor.spec` (withCredentials, 401→Refresh-Retry,
  kein Refresh auf Auth-Endpunkten) gegen `HttpClientTesting`. **69 Vitest grün** (20 Files).
- (Abschluss) **Foto-Entfernen-Endpunkt** `DELETE /readings/{id}/photo/` (ownership, Audit) + Test +
  Frontend-Verdrahtung (readings-form Edit-Modus). **Release-Kandidat** dokumentiert:
  `docs/RELEASE_CANDIDATE.md`. Voller `/verify`: Backend 42 Tests, Frontend 69 Tests, alle Gates grün.
- (Import-Fixes) Frontend-Import über `/import/` (statt per-Zähler `addMeter`); Backend: linked-Meter
  reihenfolge-unabhängig (Zwei-Pass), Zahlenfelder `FloatField` (Float-Rauschen), `allow_blank` auf
  Text-Felder. Echte Export-JSON (4 Zähler/76 Ablesungen) importiert sauber. Backend 44 Tests.
- (Design/Isabel) **Apple-Politur wirkt jetzt wirklich**: Ursache war, dass die Komponenten das alte
  MeterFlow-Farbsystem nutzten und die DataForge-Tokens kaum. Fix: Legacy-Variablen (`--apple-blue`,
  `--text-primary/secondary`, `--bg-surface`, `--border-color`, `--hover-bg`) in `styles.scss` auf die
  DataForge-Tokens umgebogen → Palette app-weit vereinheitlicht. Plus globaler Pass: gestufte
  `--shadow-*` auf `.card`/Shell, Token-Radien, Frosted-Glass via `--blur`/`--bg-nav`, **Ambient-Glow**
  (`.app-shell::before`), **Pill-Nav-Aktivstate** (`--accent-glow`). Kein Layout-Umbau, Material bleibt.
  Build + 69 Vitest + prettier grün.
- (Feature/Kostenvorschau) **Monatliche Abschläge pro Kalenderjahr** gespeichert: neues JSON-Feld
  `meters.advance_payments` (`[{year, estimatedConsumption, payments:[{month, amount|null}]}]`,
  Migration `0002`), serverseitig validiert (`AdvancePaymentsField`: Monat 1–12, eindeutig, 1–12
  Abschläge, Betrag ≥ 0, Verbrauch > 0, Jahre eindeutig, max. 50). Verlinktes Gartenwasser → 400.
  Import übernimmt das Feld. Frontend: Zähler-Tab „Kostenvorschau“ mit Jahresauswahl, Anzahl
  Abschläge, Monat/Betrag je Zeile, Speichern; Vorschau erscheint automatisch aus dem gespeicherten
  Stand (`core/utils/cost-preview.calc.ts`, reine Funktion). Dashboard-Card „Geschätzte Erstattung /
  Nachzahlung“ nach Gesamtkosten (Summe aller Zähler, `sumCostForecast`). Tab für verlinktes
  Gartenwasser ausgeblendet. Backend 60 Tests, Frontend 81 Vitest, Build grün.
- (Review/Standards) Abschlags-Feature gegen `.claude/skills/*-standards.md` geprüft und angepasst:
  Formular auf **Signal Forms** (`form`/`FormField`/`min`/`validate`, statt `FormsModule`),
  `AdvancePaymentService` mit **`@Service()`**, keine `i18n="@@…"`-Attribute in neuem Code
  (Runtime-i18n/`LocaleService` existiert noch nicht → Altbestand: 10 Templates mit `i18n`-Attributen
  offen), Gartenwasser-Regel in **`apps/meters/services.py`** (Service-Layer). Security-Re-Check
  sauber (bandit clean). Backend 60 Tests (meters-Coverage ≥ 96 %), Frontend 83 Vitest, Build grün.
- (Deps) Backend-Pakete auf latest: lokale `backend/.venv` neu gebaut (alte war von anderem Rechner
  kopiert, Python 3.13 fehlte hier) mit **Python 3.14**; `requirements.lock` neu aufgelöst für das
  Docker-Python 3.13 (u.a. Django 6.1.1, DRF 3.18.1, psycopg 3.3.6, gunicorn 26.2.0). Bewusst
  zurückgehalten durch Upstream-Constraints: mypy 2.3.x (django-stubs), pydantic-core 2.46.5 (pydantic).
  check/migrations/60 Tests/ruff/black/bandit grün, pip-audit ohne Befund.
- (Runtime) **Python 3.13 → 3.14** (CLAUDE.md-Vorgabe): `python:3.14-slim` in `Dockerfile.backend`
  + `Dockerfile.fullstack`, CI `setup-python` 3.14, `pyproject` (`requires-python >=3.14`,
  black/ruff/mypy-Target 3.14), README. Vorab geprüft: alle Binär-Deps haben cp314-Wheels
  (cffi, psycopg-binary, pydantic-core, argon2-cffi-bindings), `djangorestframework-camel-case` ist
  reines Python (sdist). `requirements.lock` für 3.14 aufgelöst (identische Versionen). Black hat 4
  Dateien auf PEP-758-`except A, B:` umformatiert. 60 Tests/ruff/black/bandit/pip-audit grün.
  Frontend gegen Angular 22.2.1 erneut verifiziert: 83 Vitest + Build grün.
- (Feature/Kostenvorschau) Monatsauswahl umgebaut: statt Dropdown pro Zeile ein Feld **„Erster
  Abschlag“**; die Termine laufen davon fortlaufend bis höchstens Dezember. Neu: **Zahlungsrhythmus**
  monatlich/vierteljährlich (z.B. Wasser ab Februar → Feb, Mai, Aug, Nov). `interval` (1|3) wird im
  Jahres-Eintrag mitgespeichert (fehlt = monatlich, keine Migration); Backend prüft, dass die Monate
  zum Rhythmus passen. Backend 65 Tests, Frontend 89 Vitest, Build grün.
- (Fix/Kostenvorschau) **Abwasser fehlte** bei Wasserzählern: Prognose rechnet jetzt wie die
  Dashboard-Wasserabrechnung (`stats.service.ts` `waterBillStats`): Frischwasser × Arbeitspreis +
  (Verbrauch − Gartenwasser) × Abwasserpreis + Grundgebühr. Neues optionales Feld „Davon Gartenwasser“
  (nur Wasserzähler mit verknüpftem Gartenwasserzähler), pro Jahr als `estimatedGardenConsumption`
  gespeichert; Backend prüft ≥ 0 und ≤ Jahresverbrauch. Periodenkarte zeigt „Abwasser“; die
  Dashboard-Card übernimmt es automatisch. Backend 68 Tests, Frontend 94 Vitest, Build grün.
- (Lukas/Pia/Kilian) **Branch `supabase` angelegt** (von `main`): `ApiService` auf supabase-js
  (Auth, CRUD, CO₂, Storage-Fotos mit signierten URLs, Import mit id-Erhalt, Abschlags-Validierung
  aus dem Django-Serializer portiert), alte Migrationen übernommen + Delta-Migration
  (`connected_load_kw`, `advance_payments`, FK-Indizes, Ownership-Trigger, 10-MiB-Fotolimit).
  `backend/`/`deploy/` bleiben auf dem Branch unverändert liegen (keine modify/delete-Konflikte
  beim Merge). Build + 102 Vitest grün; Migration mangels lokalem Postgres noch nicht ausgeführt.
- (2026-10-04, `supabase`, Lukas/Ole/Elena) **Rechtliches + Besucherstatistik**: Seiten `/impressum`
  (§ 5 DDG) und `/datenschutz` ohne Login und ohne App-Shell, verlinkt auf Login-Seite, in der Sidebar
  und in den Einstellungen. Datenschutzerklärung gegen Code und Schema abgeglichen: Konto, Gastzugang
  (24 h), Zählerdaten, private Fotos, Supabase Frankfurt (eu-central-1), Browser-Speicher, Umami/
  Cloudflare, ULD Schleswig-Holstein. **Umami** über `ngx-umami` mit `autoTrack: false` und
  `PageViewTracker` (IDs in URLs → `:id`, nie Konto-zuordenbare IDs). Eigenes Favicon/Apple-Touch-Icon.
- (2026-10-05, `supabase`, Kilian/Finn) **Fix Umami:** Mit `autoTrack: false` hookt Umami 3 kein
  `pushState`, `props.url` blieb die Einstiegs-URL. Tracker nimmt die URL jetzt vom Router (+ Test).
- (2026-10-05, `supabase`, Elena/Niko) **Sicherheits-Header** in `frontend/public/.htaccess`
  (X-Frame-Options, nosniff, Referrer-, Permissions-Policy; HSTS kommt vom netcup-Proxy). CSP erst als
  Report-Only ausgerollt, ohne Verstöße getestet, dann scharf geschaltet. Auf dem Webspace gibt es kein
  Nonce → `inlineCritical: false`, damit der Build kein Inline-Script enthält.
- (2026-10-05, `supabase` + `main`/`production`, Kilian/Finn) **Drei Altfehler behoben**, beim CSP-Test
  aufgefallen: `heic-to` falsch aufgerufen (kein default-Export, Options-Objekt; durch `as any`
  verdeckt) → `heic-to/csp`; `tesseract.js` (CommonJS) im Bundle nur unter `default` („t is not a
  function“); Foto-Upload-Fehler wurden verschluckt und trotzdem „gespeichert“ gemeldet. Neu: HEIC wird
  direkt bei der Auswahl in JPEG umgewandelt (Vorschau in allen Browsern, gespeichert wird JPEG).
  `main`: nginx-CSP `worker-src`/`img-src` um `blob:` ergänzt.
- (2026-10-05, `supabase` + `main`/`production`, Kilian/Finn) **Zählerstand-Erkennung neu**: Vorher
  „größte Zahl gewinnt“ (las z. B. „EN 1359:2017“). Jetzt Zuschneide-Werkzeug `shared/components/
  photo-crop` (Touch/Maus/Tastatur), Canvas-Vorverarbeitung (Graustufen, Kontrast, Invertieren,
  4 Schwellwerte), `core/services/meter-reading-parser.ts` (Rollen-Lücken, Abgleich mit Vor-/Folgestand,
  Mehrheitsentscheid; m³ fest 3 Nachkommastellen, jede Stelle einzeln abgestimmt), Alternativ-Werte,
  „Gelesene Ziffern“. Tests mit echten OCR-Ausgaben eines Gaszählers (02217,589 m³ → 2217,58x).
  Frontend: `supabase` 141 Vitest, `main` 113 Vitest, Builds grün.
- (2026-10-05, `main`/`production`, Kilian/Niko) **Favicon/Apple-Touch-Icon** aus `supabase` übernommen.
  **`build-and-push.yml` mit Pfad-Filter**: Docker-Build nur noch bei Änderungen an `frontend/`,
  `backend/`, `deploy/` oder am Workflow selbst; Doku/README/Blueprint lösen keinen Build mehr aus
  (Tags `v*` und manueller Start bauen weiterhin). `ftp-deploy.yml` (`supabase`) war bereits auf
  `frontend/**` gefiltert.
