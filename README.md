# MeterFlow-Mono

Monorepo für MeterFlow: **ein** Angular-22-Frontend + **ein** Django/DRF-Backend, getrennt oder
gemeinsam deploybar. Löst die beiden Altprojekte (`MeterFlow` mit Supabase, `MeterFlow-Fullstack`
mit FastAPI) ab.

## Struktur

```
frontend/   Angular 22 (Zoneless, Signals, Signal Forms, httpResource) — eigenes Apple-Design, kein Material
backend/    Django + Django REST Framework (Custom User, JWT-HttpOnly-Cookie-Auth)
deploy/     Dockerfiles (frontend / backend / fullstack) + nginx + supervisor
docs/       MIGRATION_PLAN.md (vollständiger Plan)
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

## Umgebungsvariablen

Alle Variablen werden vom Backend über die Prozess-Umgebung gelesen (`config/settings/`),
lokal zusätzlich aus einer `.env` im Repo-Root (`.env.example` als Vorlage). Reale Umgebungs­
variablen haben Vorrang vor der `.env`.

### Pflicht (Produktion — Container startet sonst nicht)

| Variable               | Beispiel                              | Zweck                                                                                                     |
| ---------------------- | ------------------------------------- | --------------------------------------------------------------------------------------------------------- |
| `DJANGO_ENV`           | `production`                          | aktiviert die gehärteten Prod-Settings                                                                    |
| `DJANGO_SECRET_KEY`    | _(64 Zeichen zufällig)_               | Prod bricht ab bei leer/Default. Erzeugen: `python -c "import secrets; print(secrets.token_urlsafe(64))"` |
| `DATABASE_URL`         | `postgres://user:pass@ip:5432/dbname` | Prod bricht ab wenn unset. Format `postgres://USER:PASS@HOST:PORT/DB`                                     |
| `DJANGO_ALLOWED_HOSTS` | `meterflow.example.com`               | Default `localhost,127.0.0.1` → sonst HTTP 400. Kommagetrennt                                             |

### Empfohlen

| Variable               | Beispiel                        | Default / sonst                                                                        |
| ---------------------- | ------------------------------- | -------------------------------------------------------------------------------------- |
| `REDIS_URL`            | `redis://ip:6379/0`             | ohne: lokaler In-Memory-Cache → Rate-Limiting nicht über Gunicorn-Worker geteilt       |
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

## Constraints

- **Kein CDN** — alle Assets/Fonts/Libs lokal gebündelt.
- **Auth** — JWT in HttpOnly-Cookies (SameSite=Strict, Secure) + Refresh-Rotation.
- Siehe `CLAUDE.md` (Team, Standards) und [`blueprint.md`](blueprint.md) (aktueller Stand).

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

## Status

Siehe **[blueprint.md](blueprint.md)** — wird nach jedem Schritt fortgeschrieben.
