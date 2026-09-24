package com.mightystrong.walletfun.ui

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.AddCircle
import androidx.compose.material.icons.filled.Share
import androidx.compose.material3.Button
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.ModalBottomSheet
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.material3.rememberModalBottomSheetState
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.res.painterResource
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import com.mightystrong.walletfun.CreatePassResponse
import com.mightystrong.walletfun.GoogleWalletClient
import com.mightystrong.walletfun.R
import com.mightystrong.walletfun.SavedPass
import com.mightystrong.walletfun.SavedPassStore
import com.mightystrong.walletfun.WalletFunApiClient
import kotlinx.coroutines.launch

/**
 * Sheet shown after a pass is created or updated. The Google Wallet JWT is only
 * fetched from the API when the user chooses to add the pass; sharing sends the
 * server's save link instead.
 */
@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun PassActionsSheet(
    response: CreatePassResponse,
    holderName: String,
    apiClient: WalletFunApiClient,
    googleWalletClient: GoogleWalletClient,
    savedPassStore: SavedPassStore,
    onDismiss: () -> Unit
) {
    val context = LocalContext.current
    val scope = rememberCoroutineScope()
    val sheetState = rememberModalBottomSheetState(skipPartiallyExpanded = true)

    var statusMessage by rememberSaveable { mutableStateOf("") }
    var isAdding by remember { mutableStateOf(false) }

    fun addToGoogleWallet() {
        scope.launch {
            isAdding = true
            statusMessage = ""
            try {
                val payload = apiClient.fetchGoogleWalletPass(response.googleWalletUrl)

                if (!googleWalletClient.canSavePasses()) {
                    // Google's recommended fallback: the same JWT works as a
                    // web save link, e.g. on devices without Google Wallet.
                    openLink(context, payload.saveUrl)
                    statusMessage = context.getString(R.string.status_wallet_unavailable)
                    return@launch
                }

                when (val result = googleWalletClient.savePass(payload.saveJwt)) {
                    GoogleWalletClient.SaveResult.Saved -> {
                        savedPassStore.save(
                            SavedPass(
                                serialNumber = response.serialNumber,
                                objectId = payload.objectId,
                                holderName = holderName,
                                saveUrl = payload.saveUrl,
                                googleWalletSaveUrl = response.googleWalletSaveUrl,
                                savedAt = System.currentTimeMillis()
                            )
                        )
                        statusMessage = context.getString(R.string.status_added_to_wallet)
                    }
                    GoogleWalletClient.SaveResult.Canceled ->
                        statusMessage = context.getString(R.string.status_add_canceled)
                    is GoogleWalletClient.SaveResult.Failed ->
                        statusMessage = context.getString(
                            R.string.status_add_failed,
                            result.message ?: context.getString(R.string.error_request_failed)
                        )
                }
            } catch (error: Exception) {
                statusMessage = context.getString(
                    R.string.status_fetch_failed,
                    error.message ?: context.getString(R.string.error_request_failed)
                )
            } finally {
                isAdding = false
            }
        }
    }

    ModalBottomSheet(onDismissRequest = onDismiss, sheetState = sheetState) {
        Column(
            modifier = Modifier
                .fillMaxWidth()
                .padding(horizontal = 24.dp)
                .padding(bottom = 32.dp),
            horizontalAlignment = Alignment.CenterHorizontally,
            verticalArrangement = Arrangement.spacedBy(20.dp)
        ) {
            Icon(
                painter = painterResource(R.drawable.ic_wallet_pass),
                contentDescription = null,
                tint = MaterialTheme.colorScheme.primary,
                modifier = Modifier.size(56.dp)
            )

            Column(horizontalAlignment = Alignment.CenterHorizontally) {
                Text(
                    stringResource(if (response.updated == true) R.string.pass_updated else R.string.pass_created),
                    style = MaterialTheme.typography.headlineSmall,
                    fontWeight = FontWeight.Bold
                )
                Text(
                    response.serialNumber,
                    style = MaterialTheme.typography.bodySmall,
                    fontFamily = FontFamily.Monospace,
                    color = MaterialTheme.colorScheme.onSurfaceVariant
                )
            }

            Column(verticalArrangement = Arrangement.spacedBy(12.dp), modifier = Modifier.fillMaxWidth()) {
                Button(
                    onClick = ::addToGoogleWallet,
                    enabled = !isAdding,
                    modifier = Modifier.fillMaxWidth()
                ) {
                    if (isAdding) {
                        CircularProgressIndicator(
                            modifier = Modifier.size(20.dp),
                            strokeWidth = 2.dp,
                            color = MaterialTheme.colorScheme.onPrimary
                        )
                    } else {
                        Icon(Icons.Default.AddCircle, contentDescription = null)
                        Spacer(Modifier.size(8.dp))
                        Text(stringResource(R.string.action_add_to_google_wallet))
                    }
                }

                OutlinedButton(
                    onClick = { shareWalletFunLink(context, response.googleWalletSaveUrl) },
                    modifier = Modifier.fillMaxWidth()
                ) {
                    Icon(Icons.Default.Share, contentDescription = null)
                    Spacer(Modifier.size(8.dp))
                    Text(stringResource(R.string.action_share_pass))
                }
            }

            if (statusMessage.isNotEmpty()) {
                Text(
                    statusMessage,
                    style = MaterialTheme.typography.bodySmall,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                    textAlign = TextAlign.Center
                )
            }

            TextButton(onClick = onDismiss) {
                Text(stringResource(R.string.action_done))
            }

            Spacer(Modifier.height(8.dp))
        }
    }
}
