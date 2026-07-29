import SwiftUI
import PassKit

struct CreatePassView: View {
    @State private var firstName = ""
    @State private var lastName = ""
    @State private var statusMessage = ""
    @State private var isSubmitting = false
    @State private var addPassSheet: AddPassSheet?

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
            .sheet(item: $addPassSheet) { sheet in
                AddPassView(pass: sheet.pass)
            }
        }
    }

    private func createPass() async {
        isSubmitting = true
        statusMessage = ""

        do {
            let response = try await apiClient.createPass(firstName: firstName, lastName: lastName)
            let pass = try await apiClient.downloadPass(from: response.downloadUrl)

            if PKAddPassesViewController.canAddPasses() {
                addPassSheet = AddPassSheet(pass: pass)
                statusMessage = "Pass \(response.serialNumber) is ready to add to Wallet."
            } else {
                statusMessage = "Pass \(response.serialNumber) was created, but this device cannot add Wallet passes."
            }
        } catch {
            statusMessage = "Could not create pass: \(error.localizedDescription)"
        }

        isSubmitting = false
    }
}

#Preview {
    CreatePassView(apiClient: WalletFunAPIClient())
}

private struct AddPassSheet: Identifiable {
    let id = UUID()
    let pass: PKPass
}

private struct AddPassView: UIViewControllerRepresentable {
    let pass: PKPass

    func makeUIViewController(context: Context) -> PKAddPassesViewController {
        PKAddPassesViewController(pass: pass)!
    }

    func updateUIViewController(_ uiViewController: PKAddPassesViewController, context: Context) {}
}
