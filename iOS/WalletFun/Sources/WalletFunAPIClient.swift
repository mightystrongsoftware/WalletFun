import Foundation
import PassKit

struct WalletFunAPIClient {
    private let baseURL: URL

    init(baseURL: URL = AppConfiguration.walletFunAPIBaseURL) {
        self.baseURL = baseURL
    }

    func createPass(firstName: String, lastName: String) async throws -> CreatePassResponse {
        let url = baseURL.appending(path: "/api/passes")
        var request = URLRequest(url: url)
        request.httpMethod = "POST"
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        request.httpBody = try JSONEncoder().encode(CreatePassRequest(firstName: firstName, lastName: lastName))

        let (data, response) = try await URLSession.shared.data(for: request)
        guard let httpResponse = response as? HTTPURLResponse, (200..<300).contains(httpResponse.statusCode) else {
            throw WalletFunAPIError.requestFailed
        }

        return try JSONDecoder().decode(CreatePassResponse.self, from: data)
    }

    func downloadPass(from url: URL) async throws -> PKPass {
        let (data, response) = try await URLSession.shared.data(from: url)
        guard let httpResponse = response as? HTTPURLResponse else {
            throw WalletFunAPIError.requestFailed
        }

        guard (200..<300).contains(httpResponse.statusCode) else {
            if let apiError = try? JSONDecoder().decode(APIErrorResponse.self, from: data) {
                throw WalletFunAPIError.serverMessage(apiError.message)
            }

            throw WalletFunAPIError.requestFailed
        }

        return try PKPass(data: data)
    }
}

struct CreatePassRequest: Encodable {
    let firstName: String
    let lastName: String
}

struct CreatePassResponse: Decodable {
    let id: String
    let serialNumber: String
    let downloadUrl: URL
}

enum WalletFunAPIError: LocalizedError {
    case requestFailed
    case serverMessage(String)

    var errorDescription: String? {
        switch self {
        case .requestFailed:
            "The WalletFun server returned an error."
        case .serverMessage(let message):
            message
        }
    }
}

private struct APIErrorResponse: Decodable {
    let message: String
}
