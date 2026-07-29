import Foundation

struct AppConfiguration {
    static let walletFunAPIBaseURL: URL = {
        guard
            let value = Bundle.main.object(forInfoDictionaryKey: "WALLETFUN_API_BASE_URL") as? String,
            let url = URL(string: value.trimmingCharacters(in: .whitespacesAndNewlines))
        else {
            return URL(string: "https://walletfun.onrender.com")!
        }

        return url
    }()
}

