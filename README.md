# WalletFun

WalletFun is a public-safe monorepo for two application surfaces and a small backend:

- `iOS`: Tuist-generated SwiftUI app for collecting first/last name and requesting WalletFun passes from the API.
- `server`: Node/TypeScript API for pass creation, Apple Wallet update registration endpoints, and persistence.
- `web`: Next.js admin surface for reviewing passes and triggering pass updates.

The code is currently under Mighty Strong LLC. Do not commit secrets, certificates, private keys, provisioning profiles, or real Apple Wallet signing assets. Use environment variables and local ignored files.

## Local Setup

```sh
cd server
cp .env.example .env
npm install
npm run dev
```

```sh
cd web
cp .env.example .env.local
npm install
npm run dev
```

```sh
cd iOS
tuist generate
```

## Deployment

Use Render for the Node API and Vercel for the web admin. See `docs/deployment.md` for exact setup steps and required environment variables.

## Persistence Boundary

All persistence access is behind a `ContentProvider` abstraction:

- `server/src/content/ContentProvider.ts`
- `server/src/content/SupabaseContentProvider.ts`
- `web/src/content/AdminContentProvider.ts`

The initial implementations make Supabase replaceable without changing routes or UI code.

## Secret Handling

Keep these out of Git:

- Supabase service role keys and anon keys
- Apple Wallet pass certificates, keys, WWDR certs, and generated `.pkpass` files
- Provisioning profiles and signing exports
- `.env`, `.env.local`, and derived build artifacts
