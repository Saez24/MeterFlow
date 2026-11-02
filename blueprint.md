# MeterFlow-Mono — Blueprint

> Lebendes Projektdokument. **Nach jedem abgeschlossenen Schritt aktualisieren** (Regel aus CLAUDE.md
> + Projekt-Constraint). Enthält Kontext, Entscheidungen, Stand und nächsten Schritt, damit in einem
> **frischen Chat in diesem Repo** ohne das alte Projekt weitergearbeitet werden kann.

> Ältere erledigte Abschnitte stehen unverändert in [blueprint-archiv.md](blueprint-archiv.md). Verweise wie „siehe Eintrag oben“ können dorthin zeigen. Dort nur gezielt suchen, nicht die ganze Datei lesen.

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

### Audit 2026-11-02 – offene Findings

Audit durch Max, Elena, Kai, Finn, Robin, nur gelesen; **kein kritischer Fund**. Elena verweigert die
Deploy-Freigabe, bis H1–H3 erledigt sind. Die Funde sind **nicht am Code gegengeprüft**. Grenzen: Finn ohne
Test-/Build-Lauf, Elena ohne `.env`-Zugriff und ohne gitleaks/trivy/pip-audit, Kai ohne Testlauf.
**Regel:** pro Fix ein kleiner Commit je Bereich (Frontend/Backend/CI getrennt), Regressionstest zuerst,
Elena prüft nach Sicherheitsfixes erneut.

**HOCH**
- [ ] H1 – Rate-Limits `key="ip"` greifen auf Proxy-IP, alle Nutzer teilen ein Limit (`accounts/views.py:47,82,121,149`; `common/data_import.py:223`; `deploy/nginx.*`: `limit_req` ohne realip; `audit.py` nimmt nur einen XFF-Hop) – Niko/Dario/Elena
- [ ] H2 – Logout widerruft Refresh-Token nicht, Cookie-Path `/api/v1/auth/refresh` wird nicht an `/logout` gesendet (`accounts/views.py:163`, `cookies.py`) – Dario
- [ ] H3 – Compose-Defaults: repo-bekannter `DJANGO_SECRET_KEY` passiert Prod-Guard, `JWT_SIGNING_KEY` fällt darauf zurück (`docker-compose.fullstack.yml:13`, `docker-compose.yml:15`, `prod.py`, `base.py:147`); `docker-compose.yml` setzt `DJANGO_ENV=development`, Image erzwingt aber `config.settings.prod` → SSL-Redirect/Secure-Cookies über HTTP – Niko
- [ ] H4 – Admin speichert Passwörter im Klartext, `UserAdmin` erbt von `ModelAdmin` (`accounts/admin.py:9`) – Dario
- [ ] H5 – Inaktive User können sich einloggen und Tokens erneuern, `is_active` fehlt in Login und `rotate_refresh_token` (`accounts/views.py:95`, `tokens.py`) – Dario
- [ ] H6 – Ungültige `meter_id` führt zu HTTP 500 statt 400 (`readings/views.py:65,83-89,147-151`) – Dario
- [ ] H7 – Datum um einen Tag verschoben in UTC+: `isoDate` nutzt `toISOString` (`api.service.ts:26,145,155`; `date-input.util.ts:13`); Backend-Verarbeitung nicht geprüft – Kilian/Finn
- [ ] H8 – Registrierung läuft bei abweichenden Passwörtern weiter, `return` fehlt (`features/auth/auth.ts:49-55`) – Kilian
- [ ] H9 – Datenimport mit N+1 Queries, bis >100.000 Queries bei 50.000 Readings (`common/data_import.py:125-201`) – Dario/Malte
- [ ] H10 – Kosten-/Statistiklogik doppelt in Frontend und Backend, Backend-Endpoints `stats/*` ungenutzt; Entscheidung nötig, welche Seite Quelle ist (`stats/urls.py`, `stats.service.ts`, `dashboard-state.service.ts`, `reading.service.ts`) – Max (Entscheidung)
- [ ] H11 – Geschäftslogik in Views statt Service-Layer, `common` importiert Domain-Apps (`readings/views.py:77-248`, `common/data_import.py`) – Dario
- [ ] H12 – Keine `config/settings/test.py`, Tests laufen gegen `.env`-Datenbank (`pyproject.toml`, `tests/conftest.py`) – Robin
- [ ] H13 – Ownership/IDOR- und Auth-Negativtests fehlen (Readings, CO2, Stats, Import, manipulierte/abgelaufene Tokens, deaktivierte User, Cookie-Flags gegen Prod-Werte, Logout-dann-Refresh) – Robin
- [ ] H14 – Berechnungen Fernwärme/Wasser ungetestet; Gartenwasser-Parameter in `compute_reading` toter Code (`readings/services.py:64-135`) – Robin/Dario
- [ ] H15 – CI ohne Coverage-Schwelle, Image-Build/Push unabhängig von Tests (`test-backend.yml:56`, `build-and-push.yml:9`) – Niko
- [ ] H16 – Frontend: 11 Component-Specs nur „should create“ (Dashboard/Auth rendern nicht), zentrale Services und `auth.guard` ohne Spec (`reading.service`, `dashboard-state`, `csv-import`, `tariff`, `date-input.util` …) – Finn

**MITTEL**
- [ ] M1 – Frontend-CVEs: `npm audit` 1 critical/1 high (dompurify via jspdf, zod via @angular/forms), `test-frontend.yml` schlägt an – Niko/Kilian
- [ ] M2 – gitleaks fehlt in allen Workflows – Niko
- [ ] M3 – `build-and-push.yml`: `packages: write` global statt `permissions: {}`; `:latest` via `workflow_dispatch` von jedem Branch; veralteter Kommentar Zeile 4-6 – Niko
- [ ] M4 – pip-audit prüft offene Ranges, Image nutzt `requirements.lock`; Trivy `ignore-unfixed` – Niko
- [ ] M5 – Container als root (`Dockerfile.fullstack`, `supervisord.conf`, `entrypoint.sh`, `Dockerfile.frontend`), keine Compose-Härtung – Niko
- [ ] M6 – Audit-Trail unvollständig: Import ohne Eintrag, Updates ohne old/new, AuditLog nur im Admin read-only, keine Retention – Dario/Malte
- [ ] M7 – `recalculate` kappt bei >10.000 Readings die ältesten (Sortierung `-date`), nicht atomar, ohne Audit (`readings/views.py:156`) – Dario
- [ ] M8 – Reading-Update/-Delete/Einfügen rechnet abgeleitete Werte nicht neu (`readings/views.py:125-142`) – Dario
- [ ] M9 – `tariff_history`/`budget` unvalidiertes JSON → 500 bei Fehlformat; `Meter.type`/`energy_type` freie Strings; Beträge teils FloatField – Malte/Dario
- [ ] M10 – Refresh-Rotation nicht atomar (kein `select_for_update`); abgelaufene Refresh-Tokens nie bereinigt, kein Index `expires_at` (`tokens.py`, `models.py`) – Dario/Malte
- [ ] M11 – Login per Timing unterscheidbar, E-Mail case-sensitiv, Register 409 verrät Konten; `AUTH_PASSWORD_VALIDATORS` nie aufgerufen (`accounts/views.py`, `serializers.py`) – Dario
- [ ] M12 – Foto-Upload: keine Magic-Byte-Prüfung, EXIF bleibt, altes Foto wird vor Speichern gelöscht, Waisen im Storage bei Löschen (`readings/views.py:134,205-248`) – Dario/Elena
- [ ] M13 – Pagination/Filter eigenbau, Cursor nur `date__lt` verliert Einträge bei gleichem Datum, ungültige Eingaben still ignoriert; `date__year` nicht indexfreundlich; kein UniqueConstraint (meter,date) – Dario/Malte
- [ ] M14 – CO2-Faktor ignoriert `valid_from` (`co2/services.py:20`) – Dario
- [ ] M15 – `_RATE_LIMITED` geteiltes Response-Singleton (`accounts/views.py:35`) – Kai
- [ ] M16 – Migrationen bei jedem Container-Start, Race bei mehreren Replikas; `/health` nur Liveness; CI ohne Postgres und ohne `makemigrations --check` / `check --deploy` – Niko
- [ ] M17 – Frontend alle Routen eager, kein Lazy Loading; Chart.js-Registrierung nur in `reports.ts` (bricht mit Lazy Loading); `meter-chart.ts` MutationObserver/Timeouts ohne Cleanup – Kilian
- [ ] M18 – `readings-form.ts`: `isSaving` bleibt nach Early-Return hängen (Zeile 345-350), Komponente zu groß (441+362 Zeilen), Fehler still verschluckt/`console.error` – Kilian
- [ ] M19 – OCR: Worker pro Aufruf, `ngsw-config` deckt `/tesseract` und `/tessdata` nicht ab (Offline), Preprocessing im Main-Thread – Kilian/Finn
- [ ] M20 – Frontend-Standardabweichungen: `$localize`/`i18n@@` statt Runtime-i18n (bekannte Schuld, Entscheidung Max/Jelena), `FormsModule` statt Signal Forms, `*ngIf`, `CommonModule`, OnPush fehlt in ~22 Dateien (Angular-22-Default gegen context7 prüfen), Interceptor mit Modulzustand, doppelte CostPreview-Komponenten (eine vermutlich tot) – Kilian/Max
- [ ] M21 – Weitere Testlücken: Foto-Upload, Stats-Randfälle, Import-Randfälle, health/ConfigView/audit-XFF, keine Unit-Tests, schwache Assertions, Allure nicht hochgeladen – Robin

**NIEDRIG** (je Gruppe eine Zeile)
- [ ] L1 – Basisimages ohne Digest, keine `dependabot.yml` – Niko
- [ ] L2 – HSTS kürzer als Standard; innerer nginx überschreibt `X-Forwarded-Proto`; `/admin/` in Modus B ungeschützt – Niko/Elena
- [ ] L3 – `wsgi`/`asgi`/`manage.py` Default `development`; `ConfigView` hartkodiert postgresql/0.1.0; pydantic-settings ungenutzt – Dario
- [ ] L4 – Import 403 statt 404; `source_url` ohne URL-Validierung; `date.today()` statt `timezone.localdate()` (`stats/views.py:51,101`) – Dario
- [ ] L5 – Redundante `db_index` auf FKs; wenige Logger – Malte/Dario
- [ ] L6 – Interne IP + `changeme` in Git-Historie/`README:173-174` (echtes DB-Passwort ≠ `changeme` prüfen) – Elena
- [ ] L7 – 3× `any`, Foto-Modal nicht barrierefrei, tote Supabase-Stubs (`deletePhoto`/`getSignedPhotoUrl`) – Kilian/Isabel
- [ ] L8 – `conftest` mutiert `settings` global, nicht eingesetzte pytest-Marker – Robin

**Empfohlene Reihenfolge:** H1–H3 (Deploy-Blocker), dann H7/H8 mit Regressionstest, H10-Entscheidung vor
weiterer Kosten-/Stats-Arbeit, H12/H13 zur Absicherung, M1/M2 für die CI-Gates.

## 8. Referenz-Quellen (aus den Altprojekten)

- Domäne/Models: `../MeterFlow-Fullstack/backend/src/meterflow/models/`
- Auth-Logik: `../MeterFlow-Fullstack/backend/src/meterflow/auth/service.py`
- Endpunkte: `../MeterFlow-Fullstack/backend/src/meterflow/routers/`
- REST-Client + Cookie-Interceptor: `../MeterFlow-Fullstack/frontend/src/app/core/{services/api.service.ts,interceptors/credentials.interceptor.ts}`
- DB-Schema-Kontrakt (UI-Quelle): `../MeterFlow/supabase/migrations/*.sql`
- Design-Tokens + Theme: `../DataForge/src/styles.scss`, `../DataForge/src/app/core/services/app-state.service.ts`

## 9. Future Release – Android-App (Flutter) und neues Release-Modell

> **Status: geplant, nicht begonnen** (Stand 2026-11-02). Start erst, wenn die Findings aus „Audit
> 2026-11-02" umgesetzt sind (Voraussetzungen siehe 9.6). Vorbild ist **Finoro** (`../Finoro`:
> `mobile/`, `docs/releases.md`, `.github/workflows/{mobile,backend,frontend}.yml`). Abweichungen von
> Finoro sind unten ausdrücklich markiert. Entwurf von Teamlead, noch nicht von Max/Elena geprüft.

### 9.1 Ziel

- **Android-App** mit Flutter in `mobile/` (selbes Repo).
- **Datenhaltung lokal auf dem Smartphone** (SQLite), Standardmodus ohne Konto und ohne Server.
- **Google-Drive-Backup** der lokalen Daten (manuell, optional automatisch).
- **Server-Modus** wie bei Finoro: Die App kann stattdessen gegen das Django-Backend arbeiten.
- **Kein Fullstack-Image mehr.** Ausgeliefert werden nur noch: **PWA** (statisch), **Backend** (Unraid-Container),
  **App** (signierte APKs).

### 9.2 Release-Modell

| Bereich | Version steht in | Tag | Ergebnis |
|---|---|---|---|
| **App-Release** (PWA + Android gemeinsam) | `frontend/package.json` + `appVersion` in der Frontend-Config **und** `mobile/pubspec.yaml` — alle drei identisch | `app-vX.Y.Z` | PWA-Build (`meterflow-web-X.Y.Z.zip` + `.sha256`) und APKs (`meterflow-X.Y.Z-arm64-v8a.apk`, `…-armeabi-v7a.apk`, `SHA256SUMS`) |
| **Backend** (eigene Nummer) | `backend/pyproject.toml` | `backend-vX.Y.Z` | Image `ghcr.io/saez24/meterflow-backend:X.Y.Z`, `:X.Y`, `:latest` |

- **Abweichung von Finoro:** Dort haben Web und App getrennte Tags/Versionen (`frontend-v*`, `mobile-v*`).
  Hier **ein** Tag `app-v*` für PWA und App, weil beide dieselbe Versionsnummer tragen sollen. Ein Workflow
  baut beides und bricht ab, wenn die drei Versionsstellen nicht übereinstimmen oder die Build-Nummer der App
  nicht passt (`Major·10000 + Minor·100 + Patch`, wie Finoro).
- Backend-Workflow wie Finoro: `:latest` nur aus `backend-v*`-Tag, getaggter Commit muss in `main` liegen,
  Tag-Format ohne Vorabversion. Wochenlauf mit pip-audit/trivy.
- **Kompatibilität:** `GET /api/version/` (öffentlich) liefert `api_version` und `min_client` (hier **ein**
  Wert für PWA und App, weil gleiche Version). `min_client` wird nur als Hinweis angezeigt, der Server lehnt
  alte Clients nicht ab (wie Finoro). Regel zum Erhöhen in `docs/` dokumentieren.
- Tag-Notiz (`git tag -a … -m`) ist die öffentliche Release-Notiz; Commit-Texte erscheinen dort nie.
- Release-Signatur: APK mit eigenem Release-Schlüssel, Secrets im GitHub-Environment `releases`
  (`METERFLOW_KEYSTORE_BASE64`, `…_PASSWORD`, `…_KEY_ALIAS`, `…_KEY_PASSWORD`), SHA-256 des Zertifikats im
  Workflow geprüft. Update-Hinweis in der App über GitHub-Releases (höchstens einmal am Tag).
- Der Schlüssel liegt **außerhalb des Repos** und wird zusätzlich an einem zweiten Ort gesichert.

### 9.3 Fullstack-Abbau (Niko/Max)

- Entfällt: `deploy/Dockerfile.fullstack`, `docker-compose.fullstack.yml`, `deploy/nginx.fullstack.conf`,
  `deploy/supervisord.conf`, `deploy/entrypoint.sh`, Deploy-Modus **C**, Fullstack-Teil in
  `build-and-push.yml`. Danach gelten nur **A** (PWA auf eigenem Webserver) und **B** (Backend allein).
- Das hebt den Eintrag „Container als root" (M5) für das Fullstack-Image auf; bei Backend-Image weiter offen.
- Das Backend wird eigenständig deploybar (Unraid-Template wie Finoro), CORS-Allowlist für die PWA-Origin.
- **Cookie-Falle prüfen:** Die Web-Auth nutzt `HttpOnly; SameSite=Strict`-Cookies. Liegt die PWA auf einer
  anderen *Site* als das Backend, werden die Cookies nicht mitgeschickt. PWA und API müssen unter derselben
  registrierbaren Domain laufen (z. B. `meter.example.de` und `api.example.de`) — in der Installationsdoku
  festhalten, `SameSite` nicht aufweichen.

### 9.4 App-Architektur (Spiegel von Finoro)

- **Stack:** Flutter (aktuelle stable), Riverpod 3 + Freezed, `drift` + `sqlite3` für die lokale DB,
  `flutter_secure_storage` (Tokens, Server-URL), `local_auth` (Biometrie-Sperre), `share_plus`/`file_picker`
  (Export/Import), `http`, `decimal` (exakte Rechnung). Aufbau `lib/core/{database,security,server,utils,widgets}`
  und `lib/features/{auth,meters,readings,costs,co2,stats,settings,update}`.
- **Abhängigkeiten ohne Versions-Pins/Caps** (Memory-Regel „no version pinning"). Offen: Finoro pinnt Flutter im
  CI per Tag und nutzt `--enforce-lockfile`; hier mindestens `pubspec.lock` einchecken, Flutter-Version im CI
  bewusst nachziehen — Abweichung von der Pin-Regel mit dem Nutzer klären (siehe 9.7).
- **Zwei Datenmodi, nie gleichzeitig:** *Lokal* (Standard) und *Server*. Kein bidirektionaler Sync in v1.
  Moduswechsel = Export/Import (lokal→Server über den Import-Endpunkt, Server→lokal über den Export), mit
  Rückfrage und Hinweis, dass die jeweils andere Seite nicht verändert wird.
- **Fachlogik in Dart nachbauen** (Verbrauch, Kosten inkl. Tarifhistorie, Fernwärme/Wasser, CO₂ mit `valid_from`,
  Statistik). Absicherung wie Finoro Schritt 7: **gemeinsame Golden-Testfälle** (JSON), die sowohl Backend
  (pytest) als auch App (Dart) gegen dieselben Erwartungswerte laufen lassen. Setzt die Entscheidung zu **H10**
  (welche Seite ist Quelle für Kosten/Stats) und die Tests aus **H14** voraus.
- **Fotos** (Zählerfoto): im App-Dateibereich, Pfad in der DB; Kamera/Galerie, Zuschneiden. **OCR** der
  Zählerstände auf dem Gerät (z. B. ML Kit Text Recognition statt Tesseract-WASM) — Paket und Datenschutz
  (Modell-Download durch Google Play Services?) vorher mit context7/Doku prüfen, Vorgabe „kein CDN" für die PWA
  gilt dort nicht 1:1.
- **Export/Import:** CSV (und PDF-Bericht) kompatibel zu Web; Import-Format = Backend-Format.
- **Server-Modus:** Auth für Nicht-Browser-Clients (Access-/Refresh-Token im Body, Ablage in
  `flutter_secure_storage`, Rotation wie Web) als **zusätzlicher** Pfad im Backend; Cookie-Pfad für die PWA
  bleibt unverändert. Kompatibilitätshinweis über `/api/version/`.
- **Design:** Apple-clean, passend zur PWA (Isabel/Svenja), Light/Dark, Barrierefreiheit.
- `android:allowBackup="false"` und `dataExtractionRules` (kein Cloud-Backup/Geräte-Umzug durch Android) wie
  bei Finoro — das Drive-Backup ist eine **eigene, ausdrückliche** Funktion der App.

### 9.5 Google-Drive-Backup

- **Scope `drive.appdata`** (versteckter App-Ordner, kein Zugriff auf andere Drive-Dateien). Anmeldung über
  Google Sign-In (Credential Manager); OAuth-Client in der Google Cloud Console, gebunden an Paketname und
  **SHA-1 des Release-Schlüssels** (sonst kein Login in signierten APKs). Aktuelle Scope-/Verifizierungsregeln
  vor Start gegen die Google-Doku prüfen.
- **Inhalt:** konsistenter DB-Snapshot (`VACUUM INTO`) + Fotos, als ein Archiv mit Schema-Version und App-Version.
  **Nie** enthalten: Server-URL, Tokens, Biometrie-Einstellungen.
- **Verschlüsselung clientseitig** mit Passphrase (AES-GCM, Schlüsselableitung mit Argon2id/PBKDF2) —
  Pflicht oder optional: Entscheidung offen (9.7). Passphrase wird nie gespeichert; ohne sie keine Wiederherstellung
  (deutlich warnen).
- **Ablauf:** „Jetzt sichern", optional automatisch (WorkManager, z. B. wöchentlich, nur WLAN), letzte N
  Sicherungen behalten, „Wiederherstellen" mit Versions-/Schema-Prüfung und Rückfrage (überschreibt lokale Daten).
- **Im Server-Modus** ist das Drive-Backup ausgeblendet (Daten liegen auf dem Server).
- Datenschutztext der App ergänzen (Google-Anmeldung, was hochgeladen wird). Elena prüft Token-Handling.

### 9.6 Phasen und Zuständigkeit

0. **Voraussetzungen (erledigt sein müssen):** Audit-Findings H1–H16 — besonders **H2/H5** (Logout/Refresh,
   inaktive User; Basis für Token-Auth), **H9** (Import-Performance; Moduswechsel lokal→Server), **H10**
   (Rechen-Quelle), **H12–H14** (Test-Basis, Berechnungstests), **H15** (CI-Gates), **M12** (Foto-Upload).
1. **Release-Modell + Fullstack-Abbau:** neue Workflows `app.yml`, `backend.yml`, Versionen angleichen,
   `/api/version/`, Doku `docs/releases.md`, `CLAUDE.md` (Layout-Zeile Mobile, Routing Viktor/Svenja/Anton). — Niko/Max/Lukas
2. **Backend-Ergänzungen:** Token-Auth für Mobile, `/api/version/`, Export-/Import-Feinschliff, Tests. — Dario/Malte/Robin
3. **App-Gerüst:** Projekt, Theme, drift-Schema + Migrationen, App-Sperre, Navigation. — Viktor/Anton/Svenja
4. **Lokaler Modus:** Zähler, Ablesungen + Foto/OCR, Kosten/CO₂/Statistik (Golden-Tests), Export/Import. — Anton/Svenja
5. **Server-Modus + Moduswechsel.** — Anton/Viktor
6. **Drive-Backup** inkl. Verschlüsselung. — Anton/Elena
7. **Release-Pipeline, Signatur, Update-Hinweis, Sicherheits-Gate (Elena), Test auf echtem Gerät**, erstes Release
   `app-v1.0.0`. — Niko/Finn/Elena/Lukas

Regeln: ein Bereich pro Commit (Backend / Frontend / Mobile / CI getrennt), Blueprint nach jedem Schritt.

### 9.7 Offene Entscheidungen

- [ ] **Öffentliches Release-Repo** für APK-/Web-Releases und Update-Hinweise (Finoro: `Saez24/Finoro-App`)
      — neues `Saez24/MeterFlow-App` anlegen? Hängt an der Entscheidung aus §7 (Projekt nicht öffentlich
      betrieben); Alternative: Releases im privaten Repo, Update-Prüfung dann nur mit Token (nicht empfohlen).
- [ ] **Branches:** Finoro trennt `frontend`/`backend`/`mobile` und cherry-picked auf `main` zum Taggen.
      Empfehlung hier: **keine Bereichs-Branches**, alles auf `main`, Tags direkt dort (weniger Aufwand,
      `production`/`supabase` bleiben unberührt).
- [ ] **PWA-Auslieferung:** nur Release-ZIP (wie Finoro) oder weiter ein schlankes nginx-Frontend-Image?
      Empfehlung: ZIP + optional das bestehende `Dockerfile.frontend` behalten.
- [ ] **Hat die PWA einen lokalen Modus?** Annahme: **nein**, PWA bleibt Server-only; lokale Daten nur in der App.
- [ ] **Backup-Verschlüsselung:** Pflicht (Empfehlung) oder optional?
- [ ] **Startversion:** PWA 0.0.0 und Backend 0.1.0 heute — beide mit dem ersten Release auf 1.0.0?
- [ ] **Flutter-Version/Lockfile** vs. Memory-Regel „keine Versions-Pins" (siehe 9.4).
- [ ] **iOS:** außerhalb des Umfangs (nur Android), Plattformordner nicht versionieren wie bei Finoro?
- [ ] **OCR auf dem Gerät:** Paket/Datenschutz-Prüfung (9.4).
