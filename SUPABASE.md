# Supabase-Variante (Branch `supabase`)

Der Branch `supabase` ist dasselbe Angular-Frontend wie `main`. Es spricht aber direkt mit
**Supabase** (Auth, Postgres mit RLS, Storage) statt mit dem Django-Backend. Er ersetzt das alte
Repo `Saez24/MeterFlow`, damit nur noch ein Frontend gepflegt werden muss.

| Branch       | Backend                     | Deploy                                   |
| ------------ | --------------------------- | ---------------------------------------- |
| `main`       | Django/DRF (`backend/`)     | `production` → 3 Images (siehe README)   |
| `supabase`   | Supabase (`supabase/`)      | noch keiner (nur Frontend-CI)            |

## Was auf diesem Branch anders ist

Absichtlich **nur die Datenschicht**. Komponenten, Templates, SCSS und Feature-Services sind
identisch mit `main`.

| Datei                                                     | Unterschied zu `main`                                   |
| --------------------------------------------------------- | ------------------------------------------------------- |
| `frontend/src/app/core/services/api.service.ts`           | Supabase-Implementierung, **gleiche öffentliche API**   |
| `frontend/src/app/core/services/api.service.spec.ts`      | Tests gegen einen Fake-Supabase-Client                  |
| `frontend/src/app/core/services/supabase.client.ts`       | neu: `SUPABASE_CLIENT`-Token                            |
| `frontend/src/environments/*.ts`                          | `supabaseUrl`/`supabaseKey` statt `apiUrl`              |
| `frontend/src/app/app.config.ts`, `angular.json`          | kein Credentials-Interceptor, kein Dev-Proxy            |
| `frontend/package.json` (+ lock)                          | `@supabase/supabase-js`                                 |
| `supabase/migrations/`                                    | Schema + RLS + Storage                                  |
| `.github/workflows/test-frontend-supabase.yml`            | Frontend-CI für diesen Branch                           |
| `.github/workflows/ftp-deploy.yml`, `frontend/public/.htaccess` | Deploy auf den Webspace                           |
| `frontend/src/app/core/services/api.service.mock.ts`      | + `isGuest`, `signInAsGuest`                            |
| `frontend/src/app/core/services/demo-data.ts` (+ spec)    | neu: Demo-Daten für Gäste                               |
| `frontend/src/app/shared/components/guest-*/`             | neu: Gast-Login-Button + Gast-Banner                    |
| `auth.html`/`.ts`, `app.html`/`.ts`, `readings-form.html`/`.ts` | **nur** Einbinde-Zeilen für die Gast-Komponenten |

`backend/`, `deploy/` und die Compose-Dateien bleiben **unverändert** liegen. Hier werden sie nicht
genutzt. Sie zu löschen würde aber bei jedem `git merge main` modify/delete-Konflikte erzeugen.

Verhalten gegenüber `main`:

- **Verbrauch/Kosten** berechnet `ReadingService` im Client (wie auf `main`). Der Supabase-
  `ApiService` speichert die Werte so, wie sie kommen. `recalculateReadings` liest nur.
- **Abschläge** werden vor dem Speichern in `validateAdvancePayments` geprüft (Port des Django-
  `AdvancePaymentsField`). Die DB prüft zusätzlich, dass es ein JSON-Array ist.
- **Import** behält ids, verknüpft Gartenwasser in einem zweiten Durchlauf und übernimmt nie
  Fotopfade. Der Import ist **keine** Transaktion. Nach einem Fehler einfach wiederholen, schon
  importierte Zeilen werden übersprungen.
- **Fotos** liegen im privaten Bucket `meter-photos` unter `<userId>/<uuid>.<ext>` (max. 10 MiB,
  JPG/PNG/WebP/HEIC) und werden über signierte URLs (1 h) angezeigt.
- **Registrierung** mit aktiver E-Mail-Bestätigung zeigt „Bitte bestätige zuerst deine E-Mail".

## Gastzugang (Demo)

Auf der Login-Seite gibt es **„Als Gast testen"**:

- Supabase legt einen **anonymen Account** an (`signInAnonymously`). Der Client importiert dafür
  frische Demo-Daten (`demo-data.ts`): 5 Zähler, 24 Monate Verlauf, Tarifwechsel, Abschläge.
- Gäste sehen nur ihre eigenen Daten (RLS). Ein Banner weist auf den Gastmodus hin.
- **Keine Foto-Uploads** (restriktive Storage-Policy + Prüfung im `ApiService`). Die
  Zählerstand-Erkennung per Foto funktioniert trotzdem, weil sie lokal im Browser läuft.
- **Limits:** 20 Zähler / 2.000 Ablesungen pro Gast (Trigger `guest_row_limit`).
- **Aufräumen:** Der pg_cron-Job `cleanup-guest-users` läuft stündlich um :15 und löscht anonyme
  Accounts, die älter als 24 h sind. Ihre Zeilen in `meters`/`readings`/`co2_factors` verschwinden
  per Cascade mit.

Einmalig im Dashboard: Authentication → Sign In / Providers → **Allow anonymous sign-ins**
aktivieren, dann `supabase/migrations/20261005000000_guest_access.sql` ausführen.

Prüfen:

```sql
select jobname, schedule, active from cron.job;
select status, return_message, start_time from cron.job_run_details
  order by start_time desc limit 5;
select count(*) from auth.users where is_anonymous;
```

Bei Merges von `main`: Konflikte in `auth.html`, `app.html` oder `readings-form.html` so auflösen,
dass die Einbinde-Zeile (`<app-guest-login />`, `<app-guest-banner />`, Gast-Hinweis) erhalten
bleibt. Der Diff zu `main` in `features/` und `shared/` besteht nur aus diesen Zeilen und den
neuen `guest-*`-Komponenten.

## Setup

```bash
# Schema einspielen (lokal oder ins verknüpfte Projekt)
supabase start && supabase db reset        # lokal
supabase link --project-ref <ref> && supabase db push   # Cloud-Projekt

cd frontend && npm ci
# environment.development.ts: supabaseUrl + anon key (`supabase status` zeigt den lokalen Key)
npm start
```

Der **anon key** ist öffentlich, die Daten schützt RLS. Der **service_role key** gehört nie ins
Frontend und nie ins Repo. Für CI/Hosting die Environment-Dateien aus Secrets erzeugen (wie früher
im alten Repo).

Beim Hosting mit CSP `connect-src` und `img-src` um die Supabase-Origin erweitern
(`https://<ref>.supabase.co`), sonst blockt der Browser API und signierte Foto-URLs.

## Neue Features von `main` übernehmen

```bash
git switch supabase
git merge main
```

Konflikte entstehen nur in den Dateien aus der Tabelle oben. Zusätzlich gilt:

1. **Neues Feld oder neue Tabelle im Django-Model** → auf `supabase` eine **neue** Migration in
   `supabase/migrations/` (nie eine angewendete ändern) und Mapper bzw. Spaltenliste in
   `api.service.ts` ergänzen (`METER_COLUMNS`, `METER_COLUMN_BY_FIELD`, `mapMeter`, …).
2. **Neue Methode im REST-`ApiService`** → dieselbe Signatur hier implementieren. Sonst bricht
   der Build. `api.service.mock.ts` kommt unverändert von `main`.
3. **Neue serverseitige Validierung oder Berechnung in Django** → im Supabase-`ApiService`
   nachziehen oder als DB-Constraint bzw. Trigger abbilden.
4. Danach: `npx ng build` + `npx ng test --watch=false`.

Gegenprobe, dass Komponenten gleich geblieben sind (nur Gast-Dateien und Einbinde-Zeilen):

```bash
git diff main supabase --stat -- frontend/src/app/features frontend/src/app/shared
```
