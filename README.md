# WalletFun

WalletFun is a public-safe monorepo for a minimal Apple Wallet and Google Wallet pass prototype under Mighty Strong LLC.

The system has four application surfaces:

- `iOS`: Tuist-generated SwiftUI app. It collects a first and last name, creates a WalletFun pass through the API, downloads the signed `.pkpass`, and presents the Apple add-pass UI.
- `android`: Gradle/Jetpack Compose app. The Android port of the iOS app: same create-or-update form, but it fetches a signed Save to Google Wallet JWT and presents the Google Wallet add-pass sheet instead.
- `server`: Node/TypeScript API. It creates passes, signs `.pkpass` files, manages Google Wallet generic pass objects, stores state through a persistence abstraction, implements the Apple Wallet web service endpoints, and pushes updates to both wallets.
- `web`: Vite/React admin app. It lists generated passes, updates pass holder names, creates update messages, and triggers Wallet pass updates through the API.

The deployed prototype uses:

- Render for the Node API: `https://walletfun.onrender.com`
- Vercel for the Web Admin
- Supabase for persistence
- Apple PassKit / Wallet web service APIs for installed pass updates
- APNs for pass update wakeups
- Google Wallet Objects API for Android passes and their updates

No secrets, certificates, private keys, service account keys, provisioning profiles, or generated pass packages should be committed to this repo.

## Documentation

Detailed docs live in `docs/`:

- [API_ARCHITECTURE.md](docs/API_ARCHITECTURE.md): endpoint inventory, client-to-endpoint mapping, security constructs, persistence boundary, and APNs integration.
- [PASS_FLOW.md](docs/PASS_FLOW.md): Mermaid architecture flow diagram across iOS, Android, Web Admin, Server, Supabase, Apple Wallet, and Google Wallet.
- [PASS_SEQUENCE.md](docs/PASS_SEQUENCE.md): Mermaid sequence diagrams for Apple Wallet (pass creation, registration, APNs push, refresh) and Google Wallet (save JWT, object patch).
- [deployment.md](docs/deployment.md): Render, Vercel, Supabase, iOS and Android API URLs, Apple Wallet signing, and Google Wallet issuer setup.
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

## Google Wallet Flow

Google Wallet works differently from Apple Wallet: the pass lives as a Generic Object in Google's Wallet Objects API and there is no device registration or push token. The Android app mirrors the iOS app on top of that model:

1. The Android app calls `POST /api/passes` with first and last name (same endpoint as iOS).
2. When the user taps Add to Google Wallet, the app calls `GET /api/passes/:serialNumber/google-wallet`. The server ensures the pass class and object exist in the Wallet Objects API and returns a signed Save to Google Wallet JWT.
3. The app hands the JWT to the Google Pay `PayClient.savePassesJwt` API, which presents the Google Wallet add-pass sheet. Devices without Google Wallet fall back to the `https://pay.google.com/gp/v/save/...` link in a browser.
4. Sharing sends `GET /api/passes/:serialNumber/google-wallet/save`, a short link that redirects into the same save flow.
5. When the Web Admin, or a create request with an existing serial number, updates the pass, the server patches the Google Wallet object and posts an update message. Google refreshes every wallet holding the pass; no APNs-style push is needed.

Google Wallet has no API for apps to list saved passes, so the Android "Saved to Google Wallet" list is a local record of passes added from that device. Swiping a row away only forgets it locally; removing a pass from Google Wallet is done in the Wallet app.

Google Wallet save sheets need Google Play services, so validate the add-pass flow on a physical Android device or a Play-enabled emulator image.

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

Android:

```sh
cd android
./gradlew assembleDebug
```

Open `android/` in Android Studio to run on a device or emulator. Point a debug build at a local API with `-PwalletFunApiBaseUrl=http://10.0.2.2:3000`; debug builds allow plain HTTP only to the emulator host.

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
- Google Wallet: `GOOGLE_WALLET_ISSUER_ID`, `GOOGLE_WALLET_CLASS_SUFFIX`, `GOOGLE_SERVICE_ACCOUNT_JSON` or `GOOGLE_SERVICE_ACCOUNT_PATH`, `GOOGLE_WALLET_ORIGINS`, `GOOGLE_WALLET_UPDATES_ENABLED`

## API Surfaces

The current API groups are:

- iOS- and Android-facing: `/api/passes/*` (`/download` serves Apple, `/google-wallet` serves Google)
- Admin-facing: `/api/admin/*`
- Apple Wallet-facing: `/v1/*`
- Legacy Wallet compatibility: `/v1/v1/*`
- Render health check: `/health`
- Apple ecosystem outbound: APNs pass update pushes
- Google ecosystem outbound: Wallet Objects API class/object upserts and update messages

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
- Google Wallet service account JSON keys
- Provisioning profiles and signing exports
- `.env`, `.env.local`, Vercel local metadata, and derived build artifacts

Current prototype security gaps are documented in [docs/API_ARCHITECTURE.md](docs/API_ARCHITECTURE.md). The main production hardening items are:

- Add real admin authentication for `/api/admin/*`.
- Add app/user authentication or short-lived download tokens for pass creation and download.
- Rotate or revoke dedicated Wallet `authenticationToken` values when passes are voided or compromised.
- Keep Apple signing material, the Google service account key, and Supabase service keys only in server-side deployment secrets.
