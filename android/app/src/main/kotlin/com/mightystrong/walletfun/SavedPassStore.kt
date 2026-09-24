package com.mightystrong.walletfun

import android.content.Context
import android.content.SharedPreferences
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.update
import kotlinx.serialization.Serializable
import kotlinx.serialization.json.Json

@Serializable
data class SavedPass(
    val serialNumber: String,
    val objectId: String,
    val holderName: String,
    /** Direct pay.google.com link with the signed JWT; opens the pass in Google Wallet. */
    val saveUrl: String,
    /** Short server link that redirects into the save flow; used for sharing. */
    val googleWalletSaveUrl: String,
    val savedAt: Long
)

/**
 * Local record of passes added to Google Wallet from this device.
 *
 * On iOS the "In your Wallet" list comes from `PKPassLibrary`. Google Wallet
 * has no equivalent API for apps to enumerate saved passes, so the app keeps
 * its own list, recorded whenever the save sheet reports success.
 */
class SavedPassStore(context: Context) {
    private val preferences: SharedPreferences =
        context.getSharedPreferences("walletfun.saved_passes", Context.MODE_PRIVATE)
    private val json = Json { ignoreUnknownKeys = true }

    private val state = MutableStateFlow(load())
    val passes: StateFlow<List<SavedPass>> = state.asStateFlow()

    fun save(pass: SavedPass) {
        state.update { current ->
            (current.filterNot { it.serialNumber == pass.serialNumber } + pass)
                .sortedBy { it.serialNumber }
                .also(::persist)
        }
    }

    fun remove(serialNumber: String) {
        state.update { current ->
            current.filterNot { it.serialNumber == serialNumber }.also(::persist)
        }
    }

    private fun load(): List<SavedPass> {
        val raw = preferences.getString(KEY_PASSES, null) ?: return emptyList()
        return runCatching { json.decodeFromString<List<SavedPass>>(raw) }
            .getOrDefault(emptyList())
            .sortedBy { it.serialNumber }
    }

    private fun persist(passes: List<SavedPass>) {
        preferences.edit().putString(KEY_PASSES, json.encodeToString(passes)).apply()
    }

    private companion object {
        const val KEY_PASSES = "passes"
    }
}
