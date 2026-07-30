# WalletFun API Architecture

WalletFun has one public server backend. The iOS app, Web Admin, and Apple Wallet all talk to the Render-hosted Node API. The API owns persistence through the `ContentProvider` abstraction and currently stores data in Supabase.

## Surfaces

| Surface | Host | Purpose |
| --- | --- | --- |
| iOS app | Native app | Creates a WalletFun pass and presents the Apple add-pass UI. |
| Web Admin | Vercel | Lists passes and triggers pass updates. |
| Server Backend | Render | Creates passes, signs `.pkpass` files, stores state, serves Wallet web service endpoints, and sends APNs update pushes. |
| Apple Wallet | iOS system app | Registers installed passes for updates, polls changed serials, and downloads updated passes. |
| Apple Ecosystem APIs | Apple APNs / PassKit | APNs wakes Wallet; PassKit/Wallet install and update signed passes. |

## Endpoint Groups

| Audience | Prefix | Route Module | Notes |
| --- | --- | --- | --- |
| iOS-facing | `/api/passes` | `server/src/routes/passRoutes.ts` | Used by the WalletFun iOS app. |
| Admin-facing | `/api/admin` | `server/src/routes/adminRoutes.ts` | Used by the Vercel Web Admin. |
| Apple Wallet-facing | `/v1` | `server/src/routes/appleWalletRoutes.ts` | Wallet web service endpoints called by `passd` on device. |
| Apple Wallet compatibility | `/v1/v1` | `server/src/index.ts` | Temporary compatibility for passes that were generated with an old `webServiceURL` containing `/v1`. |
| Apple ecosystem outbound | APNs | `server/src/wallet/PassPushNotificationService.ts` | Server sends pass update pushes to Apple APNs. This is outbound, not an inbound HTTP endpoint. |

## Client-to-Endpoint Security Matrix

| Client | Endpoint or Integration | Direction | Security Construct | Current State | Hardening Needed |
| --- | --- | --- | --- | --- | --- |
| iOS app | `POST /api/passes` | Client to server | Public HTTPS API with body validation. CORS does not protect native clients. | No user authentication. Input is validated with Zod. | Add app/user authentication before allowing real customer data, abuse-sensitive pass creation, or rate-sensitive operations. Add rate limiting. |
| iOS app | `GET /api/passes/:serialNumber/download` | Client to server | Public HTTPS download URL. Pass package itself is Apple-signed. | No requester authentication. Any party with the serial number can request the `.pkpass`. | Add a short-lived download token or require authenticated app session. Avoid exposing predictable serials. |
| Web Admin | `GET /api/admin/passes` | Web admin to server | Browser HTTPS request restricted by configured CORS origin. | No real admin authentication in the API. CORS only limits normal browser calls from other origins. | Add admin auth, such as Supabase Auth, Vercel-protected admin auth, or server-validated JWT with role checks. |
| Web Admin | `GET /api/admin/passes/:passId/wallet-metadata` | Web admin to server | Browser HTTPS request restricted by configured CORS origin. Does not expose the pass auth token value. | Diagnostic endpoint has no server-side admin auth. | Put behind admin auth or remove before production if not needed. |
| Web Admin | `PATCH /api/admin/passes/:passId/name` | Web admin to server | Browser HTTPS request restricted by configured CORS origin; body validation with Zod. | No real admin authentication. Triggers persisted mutation and APNs update push. | Require admin auth and authorization. Consider audit logs and rate limiting. |
| Web Admin | `POST /api/admin/passes/:passId/updates` | Web admin to server | Browser HTTPS request restricted by configured CORS origin; body validation with Zod. | No real admin authentication. Triggers persisted mutation and APNs update push. | Require admin auth and authorization. Consider audit logs and rate limiting. |
| Apple Wallet | `POST /v1/devices/:deviceLibraryIdentifier/registrations/:passTypeIdentifier/:serialNumber` | Wallet to server | Apple Wallet pass web service auth: `Authorization: ApplePass <authenticationToken>`. Token is embedded inside the signed pass. | Validates pass exists, pass type matches configured Pass Type ID, and token equals the pass authentication token. New passes use a dedicated 256-bit random token. | Consider rotating/revoking tokens when passes are voided. |
| Apple Wallet | `DELETE /v1/devices/:deviceLibraryIdentifier/registrations/:passTypeIdentifier/:serialNumber` | Wallet to server | Same `ApplePass` authorization token as registration. | Validates pass exists, pass type matches, and token matches before deleting registration. | Same as registration. |
| Apple Wallet | `GET /v1/devices/:deviceLibraryIdentifier/registrations/:passTypeIdentifier` | Wallet to server | Apple Wallet update polling endpoint. | Currently validates only Pass Type ID. Does not require `ApplePass` because this endpoint returns only serial numbers for that device library and pass type. | Confirm against Apple production expectations. Consider whether additional validation is possible without breaking Wallet behavior. |
| Apple Wallet | `GET /v1/passes/:passTypeIdentifier/:serialNumber` | Wallet to server | `ApplePass` authorization token plus signed `.pkpass` response. | Validates pass exists, pass type matches, and token matches before serving updated pass. | Consider token rotation and pass revocation behavior. |
| Apple Wallet | `POST /v1/log` | Wallet to server | Apple Wallet diagnostic callback. | Accepts logs without auth. Logs body for diagnostics. | Sanitize/limit logs. Consider disabling or rate limiting if abused. |
| Apple Wallet legacy pass | `/v1/v1/*` compatibility routes | Wallet to server | Same security as `/v1/*`. | Mounted only to support passes generated with the earlier `webServiceURL` value. | Remove once old passes are gone or reissued. |
| Server Backend | Supabase | Server to database | Supabase service role key stored in Render environment variables. | Service role key is not committed and is only used server-side. | Keep service role key out of web/iOS clients. Add RLS policies if clients ever access Supabase directly. Rotate key if exposed. |
| Server Backend | APNs | Server to Apple | Apple Pass Type ID certificate/private key loaded from Render environment variables or secret files. APNs topic is the Pass Type ID. | Sends silent background APNs payload to registered Wallet push tokens. Certs and private keys are not committed. | Monitor APNs failures. Rotate certs before expiration. Keep private key out of source and client apps. |
| Render | `GET /health` | Platform to server | Public health check endpoint. | Returns `{ "ok": true }`; no auth. | Keep response non-sensitive. |

## Security Model by Client

### iOS App

The iOS app is currently treated as a public client. It calls `/api/passes` to create a pass and `/api/passes/:serialNumber/download` to download the signed `.pkpass`.

Current security construct:

- HTTPS transport through Render.
- Zod validation for request bodies.
- Apple pass package signing protects pass integrity after download.

Current gap:

- The API does not authenticate the app or the user.
- The pass download URL is bearer-by-knowledge of the serial number.

Production direction:

- Add user/session authentication.
- Add a short-lived download token or authenticated download endpoint.
- Add rate limiting for pass creation.

### Web Admin

The Web Admin is a browser client deployed on Vercel. It calls `/api/admin/*` endpoints to list passes and trigger updates.

Current security construct:

- HTTPS transport.
- CORS allows configured `WEB_ORIGIN` values.
- Zod validation for mutation bodies.

Current gap:

- CORS is not authentication. Non-browser clients can still call the endpoints directly.
- Admin mutation endpoints currently have no server-enforced identity or role check.

Production direction:

- Add admin authentication before production use.
- Validate an admin JWT or signed session server-side.
- Add audit logging for mutations.

### Apple Wallet

Apple Wallet calls the `/v1/*` web service endpoints from `passd` on device.

Current security construct:

- Pass-specific endpoints require `Authorization: ApplePass <authenticationToken>`.
- The token is embedded in the signed pass.
- The server validates Pass Type ID, serial number, and token before registration deletion or pass download.

Current implementation:

- New passes get a dedicated 256-bit random base64url token from `crypto.randomBytes(32)`.
- Existing rows are backfilled to use the previous pass id value so already-installed passes remain valid after the migration.

Production direction:

- Keep the token out of admin list responses.
- Support pass voiding/revocation semantics.

### Apple Ecosystem APIs

The server talks outbound to APNs to wake Wallet when a pass changes.

Current security construct:

- APNs certificate authentication uses the Apple Pass Type ID certificate and private key.
- Signing material is loaded from Render environment variables or secret files.
- Push tokens are stored in Supabase and fingerprinted in logs.

Current gap:

- APNs cert rotation is manual.

Production direction:

- Track certificate expiration.
- Add operational alerting around APNs failures.
- Keep certificate/private key management outside Git.

## iOS-Facing Endpoints

### `POST /api/passes`

Creates a WalletFun pass record.

Audience: iOS app.

Request body:

```json
{
  "firstName": "Ada",
  "lastName": "Lovelace"
}
```

Response: `201 Created`

```json
{
  "id": "pass-record-id",
  "serialNumber": "wf-example",
  "downloadUrl": "https://walletfun.onrender.com/api/passes/wf-example/download"
}
```

Persistence:

- Inserts a row into `wallet_passes`.
- Generates a unique serial number with the `wf-` prefix.

### `GET /api/passes/:serialNumber/download`

Downloads the signed `.pkpass` package for a pass.

Audience: iOS app.

Response:

- `200 OK` with `Content-Type: application/vnd.apple.pkpass`
- `404 Not Found` when the serial number does not exist
- `503 Service Unavailable` when Apple pass signing material is not configured

Notes:

- This endpoint is how the iOS app gets the pass before presenting `PKAddPassesViewController`.
- The generated `pass.json` includes `webServiceURL`, `authenticationToken`, `passTypeIdentifier`, `teamIdentifier`, and field `changeMessage` values.

## Admin-Facing Endpoints

### `GET /api/admin/passes`

Lists all pass records for the Web Admin.

Audience: Web Admin.

Response:

```json
{
  "passes": [
    {
      "id": "pass-record-id",
      "serialNumber": "wf-example",
      "firstName": "Ada",
      "lastName": "Lovelace",
      "status": "created",
      "updateMessage": "No updates yet.",
      "createdAt": "2026-07-29T00:00:00.000Z",
      "updatedAt": "2026-07-29T00:00:00.000Z"
    }
  ]
}
```

### `GET /api/admin/passes/:passId/wallet-metadata`

Returns non-secret Wallet metadata for debugging installed pass behavior.

Audience: Web Admin / developer diagnostics.

Response:

```json
{
  "passId": "pass-record-id",
  "serialNumber": "wf-example",
  "passTypeIdentifier": "pass.mightystrong.walletfun",
  "teamIdentifierConfigured": true,
  "webServiceURL": "https://walletfun.onrender.com",
  "authenticationTokenConfigured": true,
  "authenticationTokenLength": 43,
  "updatedAt": "2026-07-29T00:00:00.000Z"
}
```

Notes:

- This does not expose the pass authentication token value.
- Use this when Wallet does not register for updates.

### `PATCH /api/admin/passes/:passId/name`

Updates the first and last name on an existing pass, then attempts to push a Wallet update.

Audience: Web Admin.

Request body:

```json
{
  "firstName": "Grace",
  "lastName": "Hopper"
}
```

Response:

```json
{
  "pass": {
    "id": "pass-record-id",
    "serialNumber": "wf-example",
    "firstName": "Grace",
    "lastName": "Hopper",
    "status": "updated",
    "updateMessage": "Name updated to Grace Hopper",
    "createdAt": "2026-07-29T00:00:00.000Z",
    "updatedAt": "2026-07-29T00:01:00.000Z"
  },
  "push": {
    "attempted": true,
    "sent": 1,
    "failed": 0
  }
}
```

Persistence:

- Updates `wallet_passes.first_name`, `wallet_passes.last_name`, `wallet_passes.status`, `wallet_passes.update_message`, and `wallet_passes.updated_at`.
- Reads `device_registrations` for the pass serial number.

Side effects:

- Sends an APNs pass update push for each registered device token.

### `POST /api/admin/passes/:passId/updates`

Creates an admin update message for an existing pass, then attempts to push a Wallet update.

Audience: Web Admin.

Request body:

```json
{
  "message": "Your WalletFun pass changed."
}
```

Response:

```json
{
  "update": {
    "id": "update-id",
    "passId": "pass-record-id",
    "message": "Your WalletFun pass changed.",
    "createdAt": "2026-07-29T00:01:00.000Z"
  },
  "push": {
    "attempted": true,
    "sent": 1,
    "failed": 0
  }
}
```

Persistence:

- Inserts into `pass_updates`.
- Updates the parent `wallet_passes` row with status `updated`, the new update message, and a fresh `updated_at`.

Side effects:

- Sends an APNs pass update push for each registered device token.

## Apple Wallet-Facing Endpoints

These endpoints implement the Apple Wallet pass web service contract. Wallet calls them directly from the device. The user agent usually appears as `passd/...`.

Authentication:

- Most pass-specific endpoints require:

```text
Authorization: ApplePass <authenticationToken>
```

- The `authenticationToken` is embedded in the signed pass. New passes use a dedicated random token stored in `wallet_passes.apple_authentication_token`.

### `POST /v1/devices/:deviceLibraryIdentifier/registrations/:passTypeIdentifier/:serialNumber`

Registers an installed pass for future updates.

Audience: Apple Wallet.

Request body:

```json
{
  "pushToken": "device-push-token"
}
```

Response:

- `201 Created` when the registration is stored
- `401 Unauthorized` when the ApplePass token does not match
- `404 Not Found` when the pass or pass type does not match

Persistence:

- Upserts into `device_registrations`.

Expected logs:

- `wallet.registration.saved`
- `wallet.registration.rejected`
- `wallet.web_service.request`

### `DELETE /v1/devices/:deviceLibraryIdentifier/registrations/:passTypeIdentifier/:serialNumber`

Unregisters a pass from future updates.

Audience: Apple Wallet.

Response:

- `200 OK` when removed
- `401 Unauthorized` when the ApplePass token does not match
- `404 Not Found` when the pass or pass type does not match

Persistence:

- Deletes from `device_registrations`.

### `GET /v1/devices/:deviceLibraryIdentifier/registrations/:passTypeIdentifier?passesUpdatedSince=:timestamp`

Returns serial numbers for installed passes that changed after the timestamp.

Audience: Apple Wallet.

Response with updates:

```json
{
  "serialNumbers": ["wf-example"],
  "lastUpdated": "2026-07-29T00:01:00.000Z"
}
```

Response with no updates:

- `204 No Content`

Persistence:

- Reads `device_registrations`.
- Reads matching `wallet_passes` rows and compares `updated_at`.

Expected logs:

- `wallet.updated_serials.found`
- `wallet.updated_serials.none`

### `GET /v1/passes/:passTypeIdentifier/:serialNumber`

Downloads the updated signed `.pkpass` after Wallet has learned that a serial number changed.

Audience: Apple Wallet.

Response:

- `200 OK` with `Content-Type: application/vnd.apple.pkpass`
- `401 Unauthorized` when the ApplePass token does not match
- `404 Not Found` when the pass or pass type does not match
- `503 Service Unavailable` when Apple pass signing material is not configured

Expected logs:

- `wallet.pass_download.served`
- `wallet.pass_download.rejected`

### `POST /v1/log`

Receives diagnostic logs from Apple Wallet.

Audience: Apple Wallet.

Response:

- `200 OK`

Expected logs:

- `wallet.device_log`

## Apple Wallet Compatibility Endpoints

The server also mounts the same Wallet web service router at `/v1/v1`.

Audience: Apple Wallet, legacy installed passes.

Reason:

- Earlier generated passes embedded `webServiceURL=https://walletfun.onrender.com/v1`.
- Apple Wallet appends its own `/v1/...` paths, producing `/v1/v1/...`.
- New passes should use `webServiceURL=https://walletfun.onrender.com`.

Compatibility routes:

- `POST /v1/v1/devices/:deviceLibraryIdentifier/registrations/:passTypeIdentifier/:serialNumber`
- `DELETE /v1/v1/devices/:deviceLibraryIdentifier/registrations/:passTypeIdentifier/:serialNumber`
- `GET /v1/v1/devices/:deviceLibraryIdentifier/registrations/:passTypeIdentifier?passesUpdatedSince=:timestamp`
- `GET /v1/v1/passes/:passTypeIdentifier/:serialNumber`
- `POST /v1/v1/log`

## Apple Ecosystem-Facing Integration

### Outbound APNs pass update push

The server sends APNs notifications from `PassPushNotificationService`.

Audience: Apple APNs.

Trigger:

- `PATCH /api/admin/passes/:passId/name`
- `POST /api/admin/passes/:passId/updates`

APNs configuration:

- `APPLE_PASS_TYPE_IDENTIFIER`
- `APPLE_TEAM_IDENTIFIER`
- `APPLE_PASS_CERT_PEM` or `APPLE_PASS_CERT_PATH`
- `APPLE_PASS_KEY_PEM` or `APPLE_PASS_KEY_PATH`
- `APPLE_PASS_CERT_PASSWORD`, when the key requires one
- `APPLE_PUSH_UPDATES_ENABLED`
- `APPLE_APNS_PRODUCTION`

Notification shape:

- APNs topic is the pass type identifier, such as `pass.mightystrong.walletfun`.
- Payload is silent background content:

```json
{
  "aps": {
    "content-available": 1
  }
}
```

Expected logs:

- `wallet.pass_push.start`
- `wallet.pass_push.registrations_loaded`
- `wallet.pass_push.complete`
- `wallet.pass_push.apns_failures`

## Health Endpoint

### `GET /health`

Returns server health for Render.

Audience: Render health checks and developer diagnostics.

Response:

```json
{
  "ok": true
}
```

## Persistence Boundary

All persistence runs through `server/src/content/ContentProvider.ts`.

Current implementations:

- `InMemoryContentProvider` for local prototyping.
- `SupabaseContentProvider` for deployed persistence.

Tables:

- `wallet_passes`
- `pass_updates`
- `device_registrations`

`wallet_passes.apple_authentication_token` is the server-side copy of the Apple Wallet bearer token embedded in `pass.json`. It is used only for Apple Wallet web service authorization and should not be returned by admin list/update endpoints.

## Security Notes

- Apple certificates, private keys, Supabase keys, `.env` files, and generated `.pkpass` files must not be committed.
- Admin endpoints are currently intended for the private Web Admin deployment and should get explicit admin authentication before production use.
- Wallet endpoints use pass-level `ApplePass` authorization tokens stored separately from the internal pass id for new passes.
- Logs fingerprint push tokens instead of printing full tokens.
