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
  "authenticationTokenLength": 21,
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

- The `authenticationToken` is embedded in the signed pass and currently maps to the internal pass id.

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

## Security Notes

- Apple certificates, private keys, Supabase keys, `.env` files, and generated `.pkpass` files must not be committed.
- Admin endpoints are currently intended for the private Web Admin deployment and should get explicit admin authentication before production use.
- Wallet endpoints use pass-level `ApplePass` authorization tokens.
- Logs fingerprint push tokens instead of printing full tokens.
