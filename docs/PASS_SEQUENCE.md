# WalletFun Pass Sequence

## Apple Wallet (iOS)

```mermaid
sequenceDiagram
  autonumber
  actor User
  participant IOS as iOS App
  participant API as Server Backend
  participant Provider as Content Provider
  participant DB as Supabase
  participant PassKit as PassKit / Wallet APIs
  participant Wallet as Apple Wallet
  participant Admin as Web Admin
  participant APNs as APNs

  User->>IOS: Enter first and last name
  IOS->>API: POST /api/passes
  API->>Provider: createPass(firstName, lastName)
  Provider->>DB: Insert wallet_passes row
  DB-->>Provider: Pass record
  Provider-->>API: Pass record
  API-->>IOS: Pass id, serial number, download URL

  IOS->>API: GET /api/passes/{serialNumber}/download
  API->>Provider: getPassBySerialNumber(serialNumber)
  Provider->>DB: Select wallet_passes row
  DB-->>Provider: Pass record
  Provider-->>API: Pass record
  API-->>IOS: Signed .pkpass

  IOS->>PassKit: Present add-pass UI
  PassKit->>Wallet: Add pass
  Wallet->>API: POST /v1/devices/{deviceLibraryIdentifier}/registrations/{passTypeIdentifier}/{serialNumber}
  API->>Provider: registerDevice(deviceLibraryIdentifier, passTypeIdentifier, serialNumber, pushToken)
  Provider->>DB: Upsert device_registrations row
  DB-->>Provider: Registration saved
  Provider-->>API: Success
  API-->>Wallet: 201 Created

  Admin->>API: PATCH /api/admin/passes/{passId}/name
  API->>Provider: updatePassName(passId, firstName, lastName)
  Provider->>DB: Update wallet_passes row
  DB-->>Provider: Updated pass record
  Provider-->>API: Updated pass record

  API->>Provider: listDeviceRegistrationsForPass(passTypeIdentifier, serialNumber)
  Provider->>DB: Select matching device_registrations rows
  DB-->>Provider: Registered push tokens
  Provider-->>API: Device registrations
  API->>APNs: Send pass update push
  APNs-->>Wallet: Wake pass update check
  API-->>Admin: Updated pass and push result

  Wallet->>API: GET /v1/devices/{deviceLibraryIdentifier}/registrations/{passTypeIdentifier}?passesUpdatedSince={lastUpdated}
  API->>Provider: listUpdatedPassSerials(deviceLibraryIdentifier, passTypeIdentifier, lastUpdated)
  Provider->>DB: Select updated registered passes
  DB-->>Provider: Changed serial numbers
  Provider-->>API: serialNumbers and lastUpdated
  API-->>Wallet: Changed serial numbers

  Wallet->>API: GET /v1/passes/{passTypeIdentifier}/{serialNumber}
  API->>Provider: getPassBySerialNumber(serialNumber)
  Provider->>DB: Select updated wallet_passes row
  DB-->>Provider: Updated pass record
  Provider-->>API: Updated pass record
  API-->>Wallet: Updated signed .pkpass
  Wallet->>User: Show updated pass and changeMessage notification
```

## Google Wallet (Android)

Google Wallet has no device registration or push token step. The server owns the pass as a Generic Object in the Wallet Objects API, and Google syncs object changes to every wallet holding it.

```mermaid
sequenceDiagram
  autonumber
  actor User
  participant Android as Android App
  participant API as Server Backend
  participant Provider as Content Provider
  participant DB as Supabase
  participant Objects as Google Wallet Objects API
  participant Pay as Google Pay client
  participant GWallet as Google Wallet
  participant Admin as Web Admin

  User->>Android: Enter first and last name
  Android->>API: POST /api/passes
  API->>Provider: createPass(firstName, lastName)
  Provider->>DB: Insert wallet_passes row
  DB-->>Provider: Pass record
  Provider-->>API: Pass record
  API-->>Android: Pass id, serial number, googleWalletUrl, googleWalletSaveUrl

  User->>Android: Tap Add to Google Wallet
  Android->>API: GET /api/passes/{serialNumber}/google-wallet
  API->>Provider: getPassBySerialNumber(serialNumber)
  Provider->>DB: Select wallet_passes row
  DB-->>Provider: Pass record
  Provider-->>API: Pass record
  API->>Objects: GET genericClass/{issuerId}.walletfun (insert if missing)
  API->>Objects: GET genericObject/{issuerId}.{serialNumber}
  Objects-->>API: 404 or existing object
  API->>Objects: POST genericObject (or PUT to replace)
  Objects-->>API: Object saved
  API-->>Android: objectId, saveJwt, saveUrl

  Android->>Pay: savePassesJwt(saveJwt)
  Pay->>GWallet: Present save sheet
  User->>GWallet: Confirm
  GWallet-->>Android: RESULT_OK via onActivityResult
  Android->>Android: Record pass in local saved list

  Admin->>API: PATCH /api/admin/passes/{passId}/name
  API->>Provider: updatePassName(passId, firstName, lastName)
  Provider->>DB: Update wallet_passes row
  DB-->>Provider: Updated pass record
  Provider-->>API: Updated pass record

  API->>Objects: GET genericObject/{issuerId}.{serialNumber}
  Objects-->>API: Existing object
  API->>Objects: PATCH genericObject (new header, status, update message)
  API->>Objects: POST genericObject/.../addMessage (TEXT_AND_NOTIFY)
  Objects-->>API: Updated
  API-->>Admin: Updated pass, push result, googleWallet result

  Objects-->>GWallet: Sync updated object
  GWallet->>User: Show updated pass and message notification
```
