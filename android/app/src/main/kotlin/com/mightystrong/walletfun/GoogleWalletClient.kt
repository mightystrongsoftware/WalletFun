package com.mightystrong.walletfun

import android.app.Activity
import android.content.Intent
import androidx.activity.ComponentActivity
import com.google.android.gms.pay.Pay
import com.google.android.gms.pay.PayApiAvailabilityStatus
import com.google.android.gms.pay.PayClient
import kotlinx.coroutines.CompletableDeferred
import kotlinx.coroutines.tasks.await

/**
 * Thin wrapper over the Google Pay `PayClient` save-passes API. Plays the role
 * PassKit's `PKAddPassesViewController` has on iOS: hand it a signed pass and
 * it presents the system add-to-wallet sheet.
 *
 * The Pay client reports the outcome through `onActivityResult`, so the owning
 * activity must forward that callback to [onActivityResult].
 */
class GoogleWalletClient(private val activity: ComponentActivity) {
    private val payClient: PayClient = Pay.getClient(activity)
    private var pendingSave: CompletableDeferred<SaveResult>? = null

    sealed interface SaveResult {
        data object Saved : SaveResult
        data object Canceled : SaveResult
        data class Failed(val message: String?) : SaveResult
    }

    /** Whether Google Wallet can save passes on this device (Play services present, supported country, etc.). */
    suspend fun canSavePasses(): Boolean = runCatching {
        payClient.getPayApiAvailabilityStatus(PayClient.RequestType.SAVE_PASSES).await() ==
            PayApiAvailabilityStatus.AVAILABLE
    }.getOrDefault(false)

    /** Presents the Google Wallet save sheet for a signed JWT and suspends until the user finishes. */
    suspend fun savePass(saveJwt: String): SaveResult {
        pendingSave?.cancel()
        val deferred = CompletableDeferred<SaveResult>()
        pendingSave = deferred
        payClient.savePassesJwt(saveJwt, activity, SAVE_PASSES_REQUEST_CODE)
        return deferred.await()
    }

    /** Returns true when the result belonged to a Google Wallet save request. */
    fun onActivityResult(requestCode: Int, resultCode: Int, data: Intent?): Boolean {
        if (requestCode != SAVE_PASSES_REQUEST_CODE) return false

        val result = when (resultCode) {
            Activity.RESULT_OK -> SaveResult.Saved
            Activity.RESULT_CANCELED -> SaveResult.Canceled
            PayClient.SavePassesResult.SAVE_ERROR ->
                SaveResult.Failed(data?.getStringExtra(PayClient.EXTRA_API_ERROR_MESSAGE))
            else -> SaveResult.Failed(null)
        }

        pendingSave?.complete(result)
        pendingSave = null
        return true
    }

    private companion object {
        const val SAVE_PASSES_REQUEST_CODE = 1000
    }
}
