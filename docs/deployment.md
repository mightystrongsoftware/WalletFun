# Deployment

## API on Render

The repo supports two Render setup paths.

### Blueprint Node service

The root `render.yaml` defines one Node web service:

- Service name: `walletfun-api`
- Root directory: `server`
- Build command: `npm ci && npm run build`
- Start command: `npm start`
- Health check: `/health`

Create a new Render Blueprint from the GitHub repo. Render will ask for values marked `sync: false`; set them in the Render dashboard, not in Git.

### Existing Docker service

If the Render service was created as Docker, keep it and use the root `Dockerfile`. It builds only `server/` and starts the Express API with `npm start`.

Use these Docker settings:

```text
Dockerfile Path: ./Dockerfile
Docker Build Context Directory: .
Health Check Path: /health
```

Required production values:

```text
CONTENT_PROVIDER=supabase
PUBLIC_API_BASE_URL=https://<your-render-service>.onrender.com
WEB_ORIGIN=https://<your-vercel-admin>.vercel.app,http://127.0.0.1:3001
SUPABASE_URL=<your-supabase-project-url>
SUPABASE_SERVICE_ROLE_KEY=<your-supabase-service-role-key>
```

Apple Wallet values can stay empty until signed pass generation is implemented:

```text
APPLE_PASS_TYPE_IDENTIFIER=
APPLE_TEAM_IDENTIFIER=
APPLE_WWDR_CERT_PATH=
APPLE_PASS_CERT_PATH=
APPLE_PASS_CERT_PASSWORD=
```

Do not commit Apple certificates, private keys, provisioning profiles, generated `.pkpass` files, Supabase service keys, or `.env` files.

## Web Admin on Vercel

Deploy the web admin with the Vercel CLI from the `web` directory. This does not require Vercel Git integration.

First link the local `web` folder to a Vercel project:

```sh
cd web
npx vercel link
```

Set the production environment variable in Vercel:

```text
VITE_WALLETFUN_API_BASE_URL=https://<your-render-service>.onrender.com
```

Then deploy:

```sh
npm ci
npm run vercel:pull
npm run vercel:build
npm run vercel:deploy
```

The generated `.vercel/` directory stays local and ignored by Git. GitHub Actions deploys with the same CLI flow using `VERCEL_TOKEN`, `VERCEL_ORG_ID`, and `VERCEL_PROJECT_ID` secrets.

After the Vercel URL exists, update Render's `WEB_ORIGIN` to that URL and redeploy the API.

## GitHub Actions

CI runs on pull requests and pushes to `main` for:

- `server`: install, typecheck, build, audit
- `web`: install, build, audit
- `iOS`: Tuist generate and unsigned Xcode build

Deployments run on pushes to `main` and manual workflow dispatch. See `docs/ci-secrets.md` for the required GitHub secrets.

## Supabase

Create a Supabase project and run `server/supabase-schema.sql` in the SQL editor. Use the project URL and service role key only in Render environment variables.

The same schema is also available as a Supabase CLI migration:

```sh
supabase link --project-ref xidkemohkwtyasvorjtt
supabase db push
```
