import ProjectDescription

let project = Project(
    name: "WalletFun",
    organizationName: "Mighty Strong LLC",
    targets: [
        .target(
            name: "WalletFun",
            destinations: .iOS,
            product: .app,
            bundleId: "com.mightystrong.walletfun",
            deploymentTargets: .iOS("17.0"),
            infoPlist: .extendingDefault(with: [
                "UILaunchScreen": [:],
                "WALLETFUN_API_BASE_URL": "https://walletfun.onrender.com",
                "NSAppTransportSecurity": [
                    "NSAllowsArbitraryLoads": false
                ]
            ]),
            sources: ["WalletFun/Sources/**"],
            resources: ["WalletFun/Resources/**"]
        )
    ]
)
