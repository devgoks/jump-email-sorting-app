# Jump AI Email Sorting App

This repo contains a Next.js app that:

- Signs in with Google (OAuth) and requests Gmail scopes (`gmail.modify`)
- Lets you create **custom categories** (name + description)
- **Syncs NEW inbox emails**, uses AI to **classify + summarize**, then **archives** them in Gmail
- Lets you browse by category, read originals, and run bulk actions (**delete** / **unsubscribe**)

The app lives in `jump-email-sorting-app/`.

## Local dev

1. Install deps

```bash
cd jump-email-sorting-app
npm install
```

2. Create env file

- Copy `jump-email-sorting-app/env.example` to `jump-email-sorting-app/.env.local`
- Fill in values (Google OAuth, OpenAI, etc.)

3. Create DB + run migrations

```bash
cd jump-email-sorting-app
```

4. Run the app

```bash
cd jump-email-sorting-app
npm run dev
```

## Google OAuth setup (important)

In Google Cloud Console:

- **OAuth consent screen**: add **`webshookeng@gmail.com`** as an OAuth **test user**
- **Scopes**: include at least `https://www.googleapis.com/auth/gmail.modify`
- **Authorized redirect URIs**:
  - For NextAuth sign-in: `https://YOUR_HOST/api/auth/callback/google`
  - For “Connect another inbox”: `https://YOUR_HOST/api/gmail/callback`

## Syncing emails (import + archive)

- In the UI: click **“Sync now (import + archive)”**
- For production: call the cron endpoint periodically:
  - `POST /api/cron/sync` with header `Authorization: Bearer $CRON_SECRET`

## Deployment (Render)

This repo includes a Render Blueprint at `render.yaml` that:

- Deploys the Next.js app
- Attaches a persistent disk at `/var/data`
- Uses SQLite at `file:/var/data/app.db`

You still need to set these env vars in Render:

- `NEXTAUTH_URL` (e.g. `https://YOUR-SERVICE.onrender.com`)
- `NEXTAUTH_SECRET`
- `GOOGLE_CLIENT_ID`
- `GOOGLE_CLIENT_SECRET`
- `OPENAI_API_KEY`
- `CRON_SECRET`

Then create a Render Cron Job (in the dashboard) that runs something like:

```bash
curl -fsSL -X POST "https://YOUR-SERVICE.onrender.com/api/cron/sync" \
  -H "Authorization: Bearer $CRON_SECRET"
```

## Deployment (Fly.io)

This app uses **SQLite** (Prisma datasource `sqlite`). On Fly, you should attach a **Fly Volume** and point `DATABASE_URL` to a file under that mount.

### 1) Install and login

```bash
brew install flyctl
fly auth login
```

### 2) Create the app + volume

Run from the app directory:

```bash
cd jump-email-sorting-app
fly launch --no-deploy
```

Create a persistent volume for SQLite (matches `fly.toml` mount `source = "data"`):

```bash
fly volumes create data --size 1
```

### 3) Set required secrets

```bash
fly secrets set \
  NEXTAUTH_URL="https://jump-email-sorting-app.fly.dev" \
  NEXTAUTH_SECRET="replace-me" \
  GOOGLE_CLIENT_ID="replace-me.apps.googleusercontent.com" \
  GOOGLE_CLIENT_SECRET="replace-me" \
  GOOGLE_OAUTH_REDIRECT_URL="https://jump-email-sorting-app.fly.dev/api/gmail/callback" \
  OPENAI_API_KEY="replace-me" \
  OPENAI_MODEL="gpt-4o-mini" \
  CRON_SECRET="replace-me" \
  INTERNAL_SYNC_CRON_ENABLED="false" \
  INTERNAL_SYNC_CRON_INTERVAL_MS="5000" \
  INTERNAL_SYNC_CRON_MAX_PER_INBOX="10"
```

### 4) Deploy

```bash
fly deploy
```

### Notes

- `DATABASE_URL` is set in `fly.toml` to `file:/data/app.db` (SQLite on the mounted volume at `/data`).
- The app runs `npx prisma migrate deploy` automatically on each deploy (see `fly.toml` `release_command`).
- Cron: Fly doesn’t automatically schedule HTTP calls for you. Keep using an external scheduler (e.g. GitHub Actions, cron-job.org) to `POST /api/cron/sync` with `Authorization: Bearer $CRON_SECRET`, or enable the internal cron and keep at least one machine always running.

## Tests

```bash
cd jump-email-sorting-app
npm test
```


