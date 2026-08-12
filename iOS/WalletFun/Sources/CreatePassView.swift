import SwiftUI
import PassKit

struct CreatePassView: View {
    @State private var firstName = ""
    @State private var lastName = ""
    @State private var serialNumber = ""
    @State private var statusMessage = ""
    @State private var isSubmitting = false
    @State private var createdPass: CreatePassResponse?
    @State private var installedPasses: [PKPass] = []
    @Environment(\.openURL) private var openURL

    // Kept alive for the life of the view: PassKit only posts
    // PKPassLibraryDidChange to apps holding a PKPassLibrary instance.
    private let passLibrary = PKPassLibrary()

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
                    TextField("Serial number (optional)", text: $serialNumber)
                        .autocorrectionDisabled()
                        .textInputAutocapitalization(.never)
                } footer: {
                    Text("Leave empty to create a new pass. Use an existing serial number to update that pass instead.")
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

                if !installedPasses.isEmpty {
                    Section("In your Wallet") {
                        ForEach(installedPasses, id: \.serialNumber) { pass in
                            HStack {
                                Button {
                                    if let passURL = pass.passURL {
                                        openURL(passURL)
                                    }
                                } label: {
                                    VStack(alignment: .leading) {
                                        Text(pass.localizedName)
                                        Text(pass.serialNumber)
                                            .font(.footnote)
                                            .foregroundStyle(.secondary)
                                    }
                                }
                                .tint(.primary)

                                Spacer()

                                ShareLink(
                                    item: shareItem(for: pass),
                                    subject: Text("A WalletFun pass"),
                                    message: Text("you might like this")
                                ) {
                                    Image(systemName: "square.and.arrow.up")
                                }
                            }
                            .buttonStyle(.borderless)
                            .swipeActions(edge: .trailing, allowsFullSwipe: false) {
                                Button(role: .destructive) {
                                    passLibrary.removePass(pass)
                                    refreshInstalledPasses()
                                } label: {
                                    Label("Remove from Wallet", systemImage: "trash")
                                }
                            }
                        }
                    }
                }
            }
            .navigationTitle("WalletFun")
            .sheet(item: $createdPass, onDismiss: refreshInstalledPasses) { response in
                PassActionsView(response: response, apiClient: apiClient)
            }
            .onAppear(perform: refreshInstalledPasses)
            .onReceive(NotificationCenter.default.publisher(for: Notification.Name(PKPassLibraryNotificationName.PKPassLibraryDidChange.rawValue))) { _ in
                refreshInstalledPasses()
            }
        }
    }

    private func shareItem(for pass: PKPass) -> URL {
        AppConfiguration.walletFunAPIBaseURL.appending(path: "/api/passes/\(pass.serialNumber)/download")
    }

    private func refreshInstalledPasses() {
        guard PKPassLibrary.isPassLibraryAvailable() else { return }

        // PKPassLibrary only returns passes whose pass type identifier is in
        // the app's com.apple.developer.pass-type-identifiers entitlement.
        installedPasses = passLibrary.passes()
            .sorted { $0.serialNumber < $1.serialNumber }
    }

    private func createPass() async {
        isSubmitting = true
        statusMessage = ""

        do {
            let requestedSerial = serialNumber.trimmingCharacters(in: .whitespaces)
            let response = try await apiClient.createPass(
                firstName: firstName,
                lastName: lastName,
                serialNumber: requestedSerial.isEmpty ? nil : requestedSerial
            )

            createdPass = response
            statusMessage = response.updated == true
                ? "Pass \(response.serialNumber) was updated. Installed copies will refresh automatically."
                : "Pass \(response.serialNumber) is ready."
        } catch {
            statusMessage = "Could not create pass: \(error.localizedDescription)"
        }

        isSubmitting = false
    }
}

#Preview {
    CreatePassView(apiClient: WalletFunAPIClient())
}
