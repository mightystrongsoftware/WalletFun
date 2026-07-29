# Deployment

## API on Render

The root `render.yaml` defines one Node web service:

- Service name: `walletfun-api`
- Root directory: `server`
- Build command: `npm ci && npm run build`
- Start command: `npm start`
- Health check: `/health`

Create a new Render Blueprint from the GitHub repo. Render will ask for values marked `sync: false`; set them in the Render dashboard, not in Git.

Required production values:

```text
CONTENT_PROVIDER=supabase
PUBLIC_API_BASE_URL=https://<your-render-service>.onrender.com
WEB_ORIGIN=https://<your-vercel-admin>.vercel.app
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

Create a Vercel project from the same GitHub repo and set the project root directory to `web`.

Use:

```text
Build Command: npm run build
Output Directory: dist
Install Command: npm ci
```

Set this Vercel environment variable:

```text
VITE_WALLETFUN_API_BASE_URL=https://<your-render-service>.onrender.com
```

After the Vercel URL exists, update Render's `WEB_ORIGIN` to that URL and redeploy the API.

## GitHub Actions

CI runs on pull requests and pushes to `main` for:

- `server`: install, typecheck, build, audit
- `web`: install, build, audit
- `iOS`: Tuist generate and unsigned Xcode build

Deployments run on pushes to `main` and manual workflow dispatch. See `docs/ci-secrets.md` for the required GitHub secrets.

## Supabase

Create a Supabase project and run `server/supabase-schema.sql` in the SQL editor. Use the project URL and service role key only in Render environment variables.
