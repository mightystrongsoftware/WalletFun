import Foundation

struct WalletFunAPIClient {
    private let baseURL: URL

    init(baseURL: URL = URL(string: "http://127.0.0.1:3000")!) {
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

    var errorDescription: String? {
        "The WalletFun server returned an error."
    }
}

