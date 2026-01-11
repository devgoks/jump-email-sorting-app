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

## Tests

```bash
cd jump-email-sorting-app
npm test
```


