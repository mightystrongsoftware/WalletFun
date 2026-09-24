package com.mightystrong.walletfun

import android.content.Intent
import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.activity.enableEdgeToEdge
import com.mightystrong.walletfun.ui.CreatePassScreen
import com.mightystrong.walletfun.ui.WalletFunTheme

class MainActivity : ComponentActivity() {
    private lateinit var googleWalletClient: GoogleWalletClient

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        enableEdgeToEdge()

        googleWalletClient = GoogleWalletClient(this)
        val apiClient = WalletFunApiClient()
        val savedPassStore = SavedPassStore(applicationContext)

        setContent {
            WalletFunTheme {
                CreatePassScreen(
                    apiClient = apiClient,
                    savedPassStore = savedPassStore,
                    googleWalletClient = googleWalletClient
                )
            }
        }
    }

    // The Pay client still reports save-passes results through the classic
    // callback, so this deprecated override is required.
    @Deprecated("Google Wallet's PayClient delivers save results via onActivityResult.")
    override fun onActivityResult(requestCode: Int, resultCode: Int, data: Intent?) {
        @Suppress("DEPRECATION")
        super.onActivityResult(requestCode, resultCode, data)
        googleWalletClient.onActivityResult(requestCode, resultCode, data)
    }
}
