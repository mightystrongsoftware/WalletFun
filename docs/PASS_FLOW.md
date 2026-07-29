# WalletFun Pass Flow

```mermaid
flowchart LR
  subgraph User["User Device"]
    IOS["iOS App\nWalletFun"]
    WALLET["Apple Wallet App"]
  end

  subgraph Apple["Apple Ecosystem"]
    PASSKIT["PassKit / Wallet APIs"]
    APNS["APNs\nApple Push Notification service"]
  end

  subgraph WalletFun["WalletFun Platform"]
    WEB["Web Admin\nVercel"]
    API["Server Backend\nRender Node API"]
    PROVIDER["Content Provider\nPersistence Abstraction"]
    DB["Supabase\nwallet_passes\npass_updates\ndevice_registrations"]
  end

  IOS -->|"Create pass request\nfirstName, lastName"| API
  API --> PROVIDER
  PROVIDER --> DB

  API -->|"Signed .pkpass"| IOS
  IOS -->|"Present add pass UI"| PASSKIT
  PASSKIT --> WALLET

  WALLET -->|"Register for updates\nPOST /v1/devices/.../registrations/..."| API
  API -->|"Store deviceLibraryIdentifier + pushToken"| PROVIDER

  WEB -->|"List passes / update name / create update"| API
  API -->|"Update pass state"| PROVIDER
  PROVIDER --> DB

  API -->|"Pass update push\npass type cert + push token"| APNS
  APNS -->|"Wake Wallet"| WALLET

  WALLET -->|"Ask what changed\nGET /v1/devices/.../registrations/..."| API
  API -->|"Changed serialNumbers + lastUpdated"| WALLET

  WALLET -->|"Fetch updated pass\nGET /v1/passes/{passTypeIdentifier}/{serialNumber}"| API
  API -->|"Updated signed .pkpass\nwith changeMessage fields"| WALLET

  WALLET -->|"Displays updated pass\nand change notification"| User
```
