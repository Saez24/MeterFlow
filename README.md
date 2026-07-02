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

| Modus | Image | Beschreibung |
| --- | --- | --- |
| A | `deploy/Dockerfile.frontend` | Nur Frontend (nginx), `apiUrl` = externe Backend-URL |
| B | `deploy/Dockerfile.backend` | Nur Django-API (headless), CORS auf erlaubte Origins |
| C | `deploy/Dockerfile.fullstack` | Alles in einem Container (nginx + Django) |

## Constraints

- **Kein CDN** — alle Assets/Fonts/Libs lokal gebündelt.
- **Auth** — JWT in HttpOnly-Cookies (SameSite=Strict, Secure) + Refresh-Rotation.
- Siehe `CLAUDE.md` (Team, Standards) und [`blueprint.md`](blueprint.md) (aktueller Stand).

## Lokale Entwicklung

> Wird in WS4 (Deployment) vervollständigt.

```bash
# geplant:
docker compose up            # Postgres + Django + Angular-Dev
```

## Status

Siehe **[blueprint.md](blueprint.md)** — wird nach jedem Schritt fortgeschrieben.
