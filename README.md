# WalletFun

WalletFun is a public-safe monorepo for a minimal Apple Wallet pass prototype under Mighty Strong LLC.

The system has three application surfaces:

- `iOS`: Tuist-generated SwiftUI app. It collects a first and last name, creates a WalletFun pass through the API, downloads the signed `.pkpass`, and presents the Apple add-pass UI.
- `server`: Node/TypeScript API. It creates passes, signs `.pkpass` files, stores state through a persistence abstraction, implements the Apple Wallet web service endpoints, and sends APNs pass update pushes.
- `web`: Vite/React admin app. It lists generated passes, updates pass holder names, creates update messages, and triggers Wallet pass updates through the API.

The deployed prototype uses:

- Render for the Node API: `https://walletfun.onrender.com`
- Vercel for the Web Admin
- Supabase for persistence
- Apple PassKit / Wallet web service APIs for installed pass updates
- APNs for pass update wakeups

No secrets, certificates, private keys, provisioning profiles, or generated pass packages should be committed to this repo.

## Documentation

Detailed docs live in `docs/`:

- [API_ARCHITECTURE.md](docs/API_ARCHITECTURE.md): endpoint inventory, client-to-endpoint mapping, security constructs, persistence boundary, and APNs integration.
- [PASS_FLOW.md](docs/PASS_FLOW.md): Mermaid architecture flow diagram across iOS, Web Admin, Server, Supabase, Wallet, and Apple APIs.
- [PASS_SEQUENCE.md](docs/PASS_SEQUENCE.md): Mermaid sequence diagram for pass creation, Wallet registration, admin update, APNs push, and Wallet refresh.
- [deployment.md](docs/deployment.md): Render, Vercel, Supabase, iOS API URL, and Apple Wallet signing setup.
- [ci-secrets.md](docs/ci-secrets.md): GitHub Actions secret requirements.

## Pass Update Flow

At a high level:

1. The iOS app calls `POST /api/passes` with first and last name.
2. The iOS app downloads the signed pass from `GET /api/passes/:serialNumber/download`.
3. The user adds the pass through PassKit / Apple Wallet.
4. Apple Wallet registers the installed pass by calling `POST /v1/devices/.../registrations/...`.
5. The Web Admin updates the pass through `/api/admin/*`.
6. The server stores the change and sends an APNs pass update push.
7. Wallet wakes up, asks `GET /v1/devices/.../registrations/...` what changed, then downloads the updated pass from `GET /v1/passes/:passTypeIdentifier/:serialNumber`.
8. Wallet applies the signed update and can show `changeMessage` notification text for changed fields.

The iOS Simulator is useful for basic app work, but Wallet pass update pushes must be validated on a physical iPhone because simulator Wallet does not reliably register for pass update push notifications.

## Local Setup

Server:

```sh
cd server
cp .env.example .env
npm install
npm run dev
```

Web Admin:

```sh
cd web
cp .env.example .env.local
npm install
npm run dev
```

iOS:

```sh
cd iOS
tuist generate
```

The iOS app icon is stored in:

```text
iOS/WalletFun/Resources/Assets.xcassets/AppIcon.appiconset
```

## Deployment

Use Render for the Node API and Vercel for the Web Admin. See [docs/deployment.md](docs/deployment.md) for exact setup steps and required environment variables.

Important server environment groups:

- Public routing: `PUBLIC_API_BASE_URL`, `WEB_ORIGIN`
- Persistence: `CONTENT_PROVIDER`, `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`
- Apple pass signing: `APPLE_PASS_TYPE_IDENTIFIER`, `APPLE_TEAM_IDENTIFIER`, `APPLE_WWDR_CERT_PEM`, `APPLE_PASS_CERT_PEM`, `APPLE_PASS_KEY_PEM`
- Apple pass update pushes: `APPLE_PUSH_UPDATES_ENABLED`, `APPLE_APNS_PRODUCTION`

## API Surfaces

The current API groups are:

- iOS-facing: `/api/passes/*`
- Admin-facing: `/api/admin/*`
- Apple Wallet-facing: `/v1/*`
- Legacy Wallet compatibility: `/v1/v1/*`
- Render health check: `/health`
- Apple ecosystem outbound: APNs pass update pushes

See [docs/API_ARCHITECTURE.md](docs/API_ARCHITECTURE.md) for endpoint-level request/response and security details.

## Persistence Boundary

All server persistence access is behind `ContentProvider`:

- `server/src/content/ContentProvider.ts`
- `server/src/content/InMemoryContentProvider.ts`
- `server/src/content/SupabaseContentProvider.ts`

Current Supabase tables:

- `wallet_passes`
- `pass_updates`
- `device_registrations`

This keeps Supabase replaceable without changing route handlers or app-facing API contracts.

## Security Notes

Keep these out of Git:

- Supabase service role keys and anon keys
- Apple Wallet pass certificates, private keys, WWDR certs, and generated `.pkpass` files
- Provisioning profiles and signing exports
- `.env`, `.env.local`, Vercel local metadata, and derived build artifacts

Current prototype security gaps are documented in [docs/API_ARCHITECTURE.md](docs/API_ARCHITECTURE.md). The main production hardening items are:

- Add real admin authentication for `/api/admin/*`.
- Add app/user authentication or short-lived download tokens for pass creation and download.
- Use a dedicated random Wallet `authenticationToken` per pass instead of the internal pass id.
- Keep Apple signing material and Supabase service keys only in server-side deployment secrets.
