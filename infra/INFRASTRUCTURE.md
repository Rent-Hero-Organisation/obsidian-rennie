# 🏠 Rennie Auth — Infrastructure Guide

> Authentication and reverse proxy layer for the RentHero Obsidian plugin ("Ask Rennie Anything").

## Architecture

```
                   ┌─────────────────────────────────────────────┐
                   │              Cloudflare (Proxy)              │
User (Obsidian) ──→│  rennie.renthero.com — SSL termination      │
                   │  Hides EC2 IP, DDoS protection              │
                   └──────────────────┬──────────────────────────┘
                                      │ HTTP :80
                   ┌──────────────────▼──────────────────────────┐
                   │              nginx (reverse proxy)           │
                   │  - Cloudflare-only IP restriction            │
                   │  - auth_request validation                   │
                   │  Routes:                                     │
                   │    /auth/*  → Auth Service (no token needed) │
                   │    /api/*   → Gateway :18789 (token required)│
                   │    /sync/*  → Sync Server :18790 (token req) │
                   └──────────────────┬──────────────────────────┘
                                      │
              ┌───────────────┬───────┴────────┬─────────────────┐
              ▼               ▼                ▼                 ▼
        Auth Service     Gateway          Sync Server         (future)
        :18791           :18789           :18790
        GitHub OAuth     OpenClaw         Obsidian file
        JWT issuance     Chat API         sync
        Token validation
```

## Components

### 1. Cloudflare DNS
- **Record:** `A rennie → <EC2_PUBLIC_IP>` (Proxy ON / orange cloud)
- **SSL:** Full (Cloudflare terminates SSL, connects to origin on port 80)
- **Benefit:** Hides real IP, free SSL, DDoS protection

### 2. nginx (`/etc/nginx/sites-available/rennie`)
- Listens on port 80
- Rejects non-Cloudflare IPs via `geo` block
- Uses `auth_request` to validate tokens before proxying to backend services
- Injects the gateway's own bearer token so backends accept the request
- Supports SSE streaming for chat API

### 3. Auth Service (`/home/ubuntu/rennie-auth/`)
- **Port:** 18791 (localhost only)
- **systemd:** `rennie-auth.service`
- **Endpoints:**
  - `GET /auth/login` — Redirects to GitHub OAuth
  - `GET /auth/callback` — Exchanges code, verifies org membership, issues JWT
  - `GET /auth/validate` — Token validation (used by nginx `auth_request`)
  - `GET /auth/me` — Returns current user info
  - `GET /auth/health` — Health check
- **Security:**
  - GitHub OAuth verifies user is in `Rent-Hero-Organisation`
  - JWTs expire after 30 days
  - CSRF protection via state parameter
  - Rate limiting on auth endpoints
  - JWT secret persisted in `.jwt-secret` (survives restarts)

### 4. Gateway (`localhost:18789`)
- OpenClaw's chat API (`/v1/chat/completions`)
- Accessed via `/api/*` through nginx
- nginx strips `/api/` prefix before proxying

### 5. Sync Server (`localhost:18790`)
- Obsidian file sync (`/sync/list`, `/sync/read`, `/sync/write`, `/sync/status`)
- Accessed via `/sync/*` through nginx (path passed through as-is)

## Security Model

| Layer | Protection |
|-------|-----------|
| **Cloudflare** | SSL termination, IP hiding, DDoS mitigation |
| **nginx geo block** | Only Cloudflare IP ranges accepted on port 80 |
| **nginx auth_request** | Every `/api/*` and `/sync/*` request validated |
| **Auth service** | GitHub OAuth + org membership check |
| **JWT tokens** | 30-day expiry, signed with persistent secret |
| **Gateway token** | Also accepted for backward compat / internal use |
| **systemd hardening** | NoNewPrivileges, ProtectSystem=strict, PrivateTmp |

## Auth Flow (User Perspective)

1. User clicks "Login with GitHub" in Obsidian plugin
2. Browser opens → `https://rennie.renthero.com/auth/login`
3. Redirects to GitHub OAuth consent screen
4. User authorizes → GitHub redirects to `/auth/callback`
5. Backend verifies org membership, issues JWT
6. Redirects to `obsidian://rennie-auth?token=xxx`
7. Obsidian opens, plugin stores token
8. All subsequent API/sync requests use the JWT in `Authorization: Bearer <token>`

## Migration Checklist

If moving to a new server, update these:

### DNS
- [ ] Update Cloudflare A record for `rennie` to new server IP

### EC2 / Server
- [ ] Security group: open port 80 (HTTP) from `0.0.0.0/0`
- [ ] Install: `nginx`, `node` (v22+)
- [ ] Copy `/home/ubuntu/rennie-auth/` directory (includes JWT secret!)
- [ ] Copy nginx config: `/etc/nginx/sites-available/rennie`
- [ ] Symlink: `ln -s /etc/nginx/sites-available/rennie /etc/nginx/sites-enabled/rennie`
- [ ] Install systemd service: `cp rennie-auth.service /etc/systemd/system/`
- [ ] Enable + start: `systemctl enable --now rennie-auth`
- [ ] Reload nginx: `systemctl reload nginx`

### Secrets to Migrate
| Secret | Location | Notes |
|--------|----------|-------|
| JWT signing secret | `/home/ubuntu/rennie-auth/.jwt-secret` | If lost, all issued tokens become invalid |
| Gateway token | In `nginx-rennie.conf` + `server.js` | Must match OpenClaw config |
| GitHub OAuth Client ID | In `server.js` | From GitHub Org → Developer Settings |
| GitHub OAuth Secret | In `server.js` | Same |

### GitHub OAuth App
- [ ] Update callback URL if domain changes: `Settings → Developer settings → OAuth Apps → Rennie`
- [ ] Current callback: `https://rennie.renthero.com/auth/callback`

### OpenClaw Gateway
- [ ] Ensure gateway is running on `localhost:18789`
- [ ] Ensure `gateway.http.endpoints.chatCompletions.enabled: true`

### Sync Server
- [ ] Ensure sync server is running on `localhost:18790`
- [ ] systemd service: `openclaw-sync`

## Verification

```bash
# Test all endpoints through nginx
curl -s http://localhost/auth/health -H "Host: rennie.renthero.com"
# → {"ok":true,"service":"rennie-auth"}

curl -s -o /dev/null -w "%{http_code}" http://localhost/api/v1/chat/completions -H "Host: rennie.renthero.com"
# → 401 (no token)

curl -s http://localhost/sync/status -H "Host: rennie.renthero.com" -H "Authorization: Bearer <token>"
# → {"status":"ok",...}

# Test from outside (once DNS is live)
curl -s https://rennie.renthero.com/auth/health
# → {"ok":true,"service":"rennie-auth"}
```

## Logs

```bash
# Auth service
journalctl -u rennie-auth -f

# nginx
tail -f /var/log/nginx/rennie-access.log
tail -f /var/log/nginx/rennie-error.log
```

---

*Last updated: 2026-02-03*
