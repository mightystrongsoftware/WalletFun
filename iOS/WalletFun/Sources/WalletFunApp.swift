import SwiftUI

@main
struct WalletFunApp: App {
    var body: some Scene {
        WindowGroup {
            CreatePassView(apiClient: WalletFunAPIClient())
        }
    }
}

