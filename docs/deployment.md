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

Apple Wallet values can stay empty during early API/admin prototyping. Pass download endpoints return 503 until signing is configured:

```text
APPLE_PASS_TYPE_IDENTIFIER=
APPLE_TEAM_IDENTIFIER=
APPLE_WWDR_CERT_PATH=
APPLE_WWDR_CERT_PEM=
APPLE_PASS_CERT_PATH=
APPLE_PASS_CERT_PEM=
APPLE_PASS_KEY_PATH=
APPLE_PASS_KEY_PEM=
APPLE_PASS_CERT_PASSWORD=
APPLE_PUSH_UPDATES_ENABLED=true
APPLE_APNS_PRODUCTION=true
```

Google Wallet values can also stay empty. The Google endpoints return 503 and wallet updates report `skippedReason` until an issuer and service account are configured:

```text
GOOGLE_WALLET_ISSUER_ID=
GOOGLE_WALLET_CLASS_SUFFIX=walletfun
GOOGLE_SERVICE_ACCOUNT_JSON=
GOOGLE_SERVICE_ACCOUNT_PATH=
GOOGLE_WALLET_ORIGINS=
GOOGLE_WALLET_UPDATES_ENABLED=true
```

Do not commit Apple certificates, private keys, provisioning profiles, generated `.pkpass` files, Google service account keys, Supabase service keys, or `.env` files.

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
- `android`: Gradle `assembleDebug` with Temurin JDK 17

Deployments run on pushes to `main` and manual workflow dispatch. See `docs/ci-secrets.md` for the required GitHub secrets.

## Supabase

Create a Supabase project and run `server/supabase-schema.sql` in the SQL editor. Use the project URL and service role key only in Render environment variables.

The same schema is also available as a Supabase CLI migration:

```sh
supabase link --project-ref xidkemohkwtyasvorjtt
supabase db push
```

Run migrations before deploying server code that depends on new columns. Existing Apple Wallet passes are preserved by the `apple_authentication_token` migration, which backfills existing rows to the previous pass id token while new passes receive a dedicated random token from the server.

## iOS API URL

The iOS app reads `WALLETFUN_API_BASE_URL` from its generated Info.plist. The checked-in prototype default is:

```text
https://walletfun.onrender.com
```

Update `iOS/Project.swift` if the API host changes, then run `tuist generate`.

## Android API URL

The Android app reads `WALLETFUN_API_BASE_URL` from `BuildConfig`, generated from the `walletFunApiBaseUrl` Gradle property in `android/gradle.properties`. The checked-in prototype default is the same Render URL.

Override it per build without editing the file:

```sh
cd android
./gradlew assembleDebug -PwalletFunApiBaseUrl=http://10.0.2.2:3000
```

Debug builds allow plain HTTP only to `10.0.2.2`, `127.0.0.1`, and `localhost` so an emulator can reach a local API. Release builds require HTTPS.

## Apple Wallet Pass Signing

The API can generate `.pkpass` files from `GET /api/passes/:serialNumber/download` and `GET /v1/passes/:passTypeIdentifier/:serialNumber` after signing material is configured in Render.

Required Render environment variables:

```text
APPLE_PASS_TYPE_IDENTIFIER=pass.<your-pass-type-id>
APPLE_TEAM_IDENTIFIER=<your-apple-team-id>
APPLE_PASS_CERT_PASSWORD=<private-key-passphrase-if-any>
APPLE_PUSH_UPDATES_ENABLED=true
APPLE_APNS_PRODUCTION=true
```

Then provide either file paths mounted with Render Secret Files:

```text
APPLE_WWDR_CERT_PATH=/etc/secrets/wwdr.pem
APPLE_PASS_CERT_PATH=/etc/secrets/pass-cert.pem
APPLE_PASS_KEY_PATH=/etc/secrets/pass-key.pem
```

Or PEM contents as environment variables:

```text
APPLE_WWDR_CERT_PEM=<wwdr pem>
APPLE_PASS_CERT_PEM=<pass certificate pem>
APPLE_PASS_KEY_PEM=<pass private key pem>
```

Do not commit Apple certificates, private keys, pass signing passwords, or generated `.pkpass` files.

Wallet pass updates use the same Pass Type ID certificate and key as pass signing. After an installed pass registers with the API, admin edits send an APNs push to that device token. Wallet then calls `/v1/devices/:deviceLibraryIdentifier/registrations/:passTypeIdentifier` to get changed serial numbers and downloads the updated pass from `/v1/passes/:passTypeIdentifier/:serialNumber`.

## Google Wallet Issuer Setup

The API can return Save to Google Wallet JWTs from `GET /api/passes/:serialNumber/google-wallet` and push object updates after a Google Wallet issuer is configured in Render.

One-time setup in Google Cloud and the Google Pay & Wallet Console:

1. Create a Google Cloud project and enable the Google Wallet API.
2. Create a service account in that project and download a JSON key.
3. In the Google Pay & Wallet Console, create (or open) the issuer account and note the numeric Issuer ID.
4. Under the issuer's Users, add the service account email with Developer access so it can create classes and objects.
5. Until Google approves the issuer for production, only test accounts listed in the console can save passes.

Required Render environment variables:

```text
GOOGLE_WALLET_ISSUER_ID=<numeric issuer id>
GOOGLE_WALLET_CLASS_SUFFIX=walletfun
GOOGLE_WALLET_UPDATES_ENABLED=true
```

Then provide the service account key either as a Render Secret File:

```text
GOOGLE_SERVICE_ACCOUNT_PATH=/etc/secrets/google-wallet-service-account.json
```

Or as the JSON contents in an environment variable:

```text
GOOGLE_SERVICE_ACCOUNT_JSON={"type":"service_account","client_email":"...","private_key":"-----BEGIN PRIVATE KEY-----\n...","...":"..."}
```

`GOOGLE_WALLET_ORIGINS` is only needed if the save link is embedded on a web page; leave it empty for the Android app and shared links.

The server creates the generic pass class `<issuerId>.<GOOGLE_WALLET_CLASS_SUFFIX>` automatically on first use. Each pass becomes the generic object `<issuerId>.<serialNumber>`. Admin edits patch that object and post a Wallet message; Google syncs the change to every device holding the pass, so no push token or device registration is stored for Google Wallet.

Do not commit the service account JSON key.
