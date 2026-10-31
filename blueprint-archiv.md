# MeterFlow-Mono — Blueprint-Archiv

Ältere erledigte Abschnitte aus `blueprint.md`, Text unverändert.
Datei ist groß: gezielt suchen (`grep -n "Stichwort" blueprint-archiv.md`), nicht komplett lesen.

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
