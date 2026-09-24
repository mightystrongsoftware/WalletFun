# CI Secrets

GitHub Actions is configured in `.github/workflows`.

## Required Secrets

API deployment to Render:

```sh
gh secret set RENDER_DEPLOY_HOOK_URL --body "https://api.render.com/deploy/srv-..."
```

Web deployment to Vercel:

```sh
gh secret set VERCEL_TOKEN --body "<vercel-token>"
gh secret set VERCEL_ORG_ID --body "<vercel-team-or-user-id>"
gh secret set VERCEL_PROJECT_ID --body "<vercel-project-id>"
gh secret set VITE_WALLETFUN_API_BASE_URL --body "https://<your-render-service>.onrender.com"
```

You can get `VERCEL_ORG_ID` and `VERCEL_PROJECT_ID` after running `npx vercel link` in `web/`; they are written to `web/.vercel/project.json`. Keep `.vercel/` out of Git.

The deploy workflow skips API or web deployment when the corresponding secrets are missing.

## Host-Level Environment Variables

Do not put Supabase service keys, Apple Wallet signing materials, or the Google Wallet service account key in GitHub Actions unless a workflow truly needs them. The Android CI job only builds an unsigned debug APK and needs no secrets.

For this prototype, store these directly in Render:

```text
CONTENT_PROVIDER=supabase
PUBLIC_API_BASE_URL=https://<your-render-service>.onrender.com
WEB_ORIGIN=https://<your-vercel-admin>.vercel.app
SUPABASE_URL=<your-supabase-url>
SUPABASE_SERVICE_ROLE_KEY=<your-service-role-key>
GOOGLE_WALLET_ISSUER_ID=<your-google-wallet-issuer-id>
GOOGLE_SERVICE_ACCOUNT_PATH=/etc/secrets/google-wallet-service-account.json
```

Store `VITE_WALLETFUN_API_BASE_URL` in Vercel and GitHub Actions.
