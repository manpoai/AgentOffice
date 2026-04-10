# Release verification checklist

Keep this short. Run it after each `agentoffice-main` release.

## 1. Clean-room bootstrap

```bash
rm -rf ~/.agentoffice
npx agentoffice-main
```

Verify:
- runtime download succeeds
- gateway starts
- shell starts
- final ready message appears

## 2. Docker path

Verify the correct branch for each case:
- no `docker` CLI -> install Docker Desktop guidance
- Docker CLI exists but daemon/Desktop unusable -> same install guidance
- Docker Desktop installed but not running -> auto-start attempt + wait + rerun guidance

## 3. Full product services

Verify both containers are healthy:
- Postgres starts and stays up
- Baserow starts and stays up
- no stale SQLite-era container config is being reused

## 4. Baserow bootstrap

Verify:
- external Postgres config works (`POSTGRESQL_*` path)
- first admin login works
- if login initially fails, first-user bootstrap path succeeds
- workspace exists or is created
- database application is created successfully

## 5. Product smoke test

After startup, verify at least once:
- can log in
- can create a doc
- can create a database/table item
- `POST /api/gateway/content-items` does not return `503`

## 6. Release asset sanity

Verify:
- bootstrap package points to the newest GitHub Release runtime URL
- GitHub Release asset exists and is downloadable
- npm published version matches the intended runtime tag

## 7. Known fragile points

If bootstrap fails, check these first:
- GitHub Release TLS/download failure
- stale Docker containers not recreated
- Baserow env drift
- wrong Baserow application-creation endpoint
- missing runtime files in the release artifact
