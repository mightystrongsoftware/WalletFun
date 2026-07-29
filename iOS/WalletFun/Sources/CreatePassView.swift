import SwiftUI

struct CreatePassView: View {
    @State private var firstName = ""
    @State private var lastName = ""
    @State private var statusMessage = ""
    @State private var isSubmitting = false

    let apiClient: WalletFunAPIClient

    var body: some View {
        NavigationStack {
            Form {
                Section("Pass holder") {
                    TextField("First name", text: $firstName)
                        .textContentType(.givenName)
                    TextField("Last name", text: $lastName)
                        .textContentType(.familyName)
                }

                Section {
                    Button {
                        Task { await createPass() }
                    } label: {
                        if isSubmitting {
                            ProgressView()
                        } else {
                            Text("Create WalletFun Pass")
                        }
                    }
                    .disabled(isSubmitting || firstName.trimmingCharacters(in: .whitespaces).isEmpty || lastName.trimmingCharacters(in: .whitespaces).isEmpty)
                }

                if !statusMessage.isEmpty {
                    Section("Status") {
                        Text(statusMessage)
                    }
                }
            }
            .navigationTitle("WalletFun")
        }
    }

    private func createPass() async {
        isSubmitting = true
        statusMessage = ""

        do {
            let response = try await apiClient.createPass(firstName: firstName, lastName: lastName)
            statusMessage = "Pass \(response.serialNumber) created. Download URL: \(response.downloadUrl.absoluteString)"
        } catch {
            statusMessage = "Could not create pass: \(error.localizedDescription)"
        }

        isSubmitting = false
    }
}

#Preview {
    CreatePassView(apiClient: WalletFunAPIClient())
}

