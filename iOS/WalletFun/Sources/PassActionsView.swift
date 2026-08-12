import SwiftUI
import PassKit

/// Intermediate page shown after a pass is created or updated. The pass is
/// only downloaded from the API when the user chooses to add it to Wallet;
/// sharing sends the download link instead.
struct PassActionsView: View {
    let response: CreatePassResponse
    let apiClient: WalletFunAPIClient

    @State private var statusMessage = ""
    @State private var isDownloading = false
    @State private var addPassSheet: AddPassSheet?
    @Environment(\.dismiss) private var dismiss

    var body: some View {
        NavigationStack {
            VStack(spacing: 24) {
                Image(systemName: "wallet.pass")
                    .font(.system(size: 56))
                    .foregroundStyle(.tint)

                VStack(spacing: 4) {
                    Text(response.updated == true ? "Pass updated" : "Pass created")
                        .font(.title2.bold())
                    Text(response.serialNumber)
                        .font(.footnote.monospaced())
                        .foregroundStyle(.secondary)
                }

                VStack(spacing: 12) {
                    Button {
                        Task { await addToWallet() }
                    } label: {
                        if isDownloading {
                            ProgressView()
                                .frame(maxWidth: .infinity)
                        } else {
                            Label("Add to Wallet", systemImage: "plus.circle.fill")
                                .frame(maxWidth: .infinity)
                        }
                    }
                    .buttonStyle(.borderedProminent)
                    .controlSize(.large)
                    .disabled(isDownloading)

                    ShareLink(
                        item: response.downloadUrl,
                        subject: Text("A WalletFun pass"),
                        message: Text("you might like this")
                    ) {
                        Label("Share Pass", systemImage: "square.and.arrow.up")
                            .frame(maxWidth: .infinity)
                    }
                    .buttonStyle(.bordered)
                    .controlSize(.large)
                }
                .padding(.horizontal)

                if !statusMessage.isEmpty {
                    Text(statusMessage)
                        .font(.footnote)
                        .foregroundStyle(.secondary)
                        .multilineTextAlignment(.center)
                        .padding(.horizontal)
                }
            }
            .padding()
            .toolbar {
                ToolbarItem(placement: .topBarTrailing) {
                    Button("Done") { dismiss() }
                }
            }
            .sheet(item: $addPassSheet) { sheet in
                AddPassView(pass: sheet.pass)
            }
        }
        .presentationDetents([.medium])
    }

    private func addToWallet() async {
        isDownloading = true
        statusMessage = ""

        do {
            let pass = try await apiClient.downloadPass(from: response.downloadUrl)

            if PKAddPassesViewController.canAddPasses() {
                addPassSheet = AddPassSheet(pass: pass)
            } else {
                statusMessage = "This device cannot add Wallet passes."
            }
        } catch {
            statusMessage = "Could not download pass: \(error.localizedDescription)"
        }

        isDownloading = false
    }
}

struct AddPassSheet: Identifiable {
    let id = UUID()
    let pass: PKPass
}

struct AddPassView: UIViewControllerRepresentable {
    let pass: PKPass

    func makeUIViewController(context: Context) -> PKAddPassesViewController {
        PKAddPassesViewController(pass: pass)!
    }

    func updateUIViewController(_ uiViewController: PKAddPassesViewController, context: Context) {}
}

#Preview {
    PassActionsView(
        response: CreatePassResponse(
            id: "preview",
            serialNumber: "wf-preview12345",
            downloadUrl: URL(string: "https://walletfun.onrender.com/api/passes/wf-preview12345/download")!,
            updated: false
        ),
        apiClient: WalletFunAPIClient()
    )
}
