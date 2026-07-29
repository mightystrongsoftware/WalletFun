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

The deploy workflow skips API or web deployment when the corresponding secrets are missing.

## Host-Level Environment Variables

Do not put Supabase service keys or Apple Wallet signing materials in GitHub Actions unless a workflow truly needs them.

For this prototype, store these directly in Render:

```text
CONTENT_PROVIDER=supabase
PUBLIC_API_BASE_URL=https://<your-render-service>.onrender.com
WEB_ORIGIN=https://<your-vercel-admin>.vercel.app
SUPABASE_URL=<your-supabase-url>
SUPABASE_SERVICE_ROLE_KEY=<your-service-role-key>
```

Store `VITE_WALLETFUN_API_BASE_URL` in Vercel and GitHub Actions.

