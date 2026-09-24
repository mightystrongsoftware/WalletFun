package com.mightystrong.walletfun.ui

import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Delete
import androidx.compose.material.icons.filled.Share
import androidx.compose.material3.Button
import androidx.compose.material3.Card
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Scaffold
import androidx.compose.material3.SwipeToDismissBox
import androidx.compose.material3.SwipeToDismissBoxValue
import androidx.compose.material3.Text
import androidx.compose.material3.TopAppBar
import androidx.compose.material3.rememberSwipeToDismissBoxState
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.saveable.Saver
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.input.KeyboardCapitalization
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.unit.dp
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import com.mightystrong.walletfun.CreatePassResponse
import com.mightystrong.walletfun.GoogleWalletClient
import com.mightystrong.walletfun.R
import com.mightystrong.walletfun.SavedPass
import com.mightystrong.walletfun.SavedPassStore
import com.mightystrong.walletfun.WalletFunApiClient
import kotlinx.coroutines.launch
import kotlinx.serialization.json.Json

/** Keeps the created-pass sheet open across configuration changes. */
private val CreatePassResponseSaver = Saver<CreatePassResponse?, String>(
    save = { response -> response?.let(Json::encodeToString) ?: "" },
    restore = { raw -> raw.takeIf { it.isNotEmpty() }?.let(Json::decodeFromString) }
)

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun CreatePassScreen(
    apiClient: WalletFunApiClient,
    savedPassStore: SavedPassStore,
    googleWalletClient: GoogleWalletClient
) {
    val context = LocalContext.current
    val scope = rememberCoroutineScope()

    var firstName by rememberSaveable { mutableStateOf("") }
    var lastName by rememberSaveable { mutableStateOf("") }
    var serialNumber by rememberSaveable { mutableStateOf("") }
    var statusMessage by rememberSaveable { mutableStateOf("") }
    var isSubmitting by remember { mutableStateOf(false) }
    var createdPass by rememberSaveable(stateSaver = CreatePassResponseSaver) { mutableStateOf(null) }

    val savedPasses by savedPassStore.passes.collectAsStateWithLifecycle()

    val canSubmit = !isSubmitting && firstName.isNotBlank() && lastName.isNotBlank()

    fun createPass() {
        scope.launch {
            isSubmitting = true
            statusMessage = ""
            try {
                val requestedSerial = serialNumber.trim()
                val response = apiClient.createPass(
                    firstName = firstName.trim(),
                    lastName = lastName.trim(),
                    serialNumber = requestedSerial.ifEmpty { null }
                )
                createdPass = response
                statusMessage = if (response.updated == true) {
                    context.getString(R.string.status_pass_updated, response.serialNumber)
                } else {
                    context.getString(R.string.status_pass_ready, response.serialNumber)
                }
            } catch (error: Exception) {
                statusMessage = context.getString(
                    R.string.status_create_failed,
                    error.message ?: context.getString(R.string.error_request_failed)
                )
            } finally {
                isSubmitting = false
            }
        }
    }

    Scaffold(
        topBar = { TopAppBar(title = { Text(stringResource(R.string.app_name)) }) }
    ) { innerPadding ->
        LazyColumn(
            modifier = Modifier
                .fillMaxSize()
                .padding(innerPadding),
            contentPadding = androidx.compose.foundation.layout.PaddingValues(16.dp),
            verticalArrangement = Arrangement.spacedBy(16.dp)
        ) {
            item {
                FormSection(title = stringResource(R.string.section_pass_holder)) {
                    OutlinedTextField(
                        value = firstName,
                        onValueChange = { firstName = it },
                        label = { Text(stringResource(R.string.field_first_name)) },
                        singleLine = true,
                        keyboardOptions = KeyboardOptions(capitalization = KeyboardCapitalization.Words),
                        modifier = Modifier.fillMaxWidth()
                    )
                    OutlinedTextField(
                        value = lastName,
                        onValueChange = { lastName = it },
                        label = { Text(stringResource(R.string.field_last_name)) },
                        singleLine = true,
                        keyboardOptions = KeyboardOptions(capitalization = KeyboardCapitalization.Words),
                        modifier = Modifier.fillMaxWidth()
                    )
                }
            }

            item {
                FormSection(footer = stringResource(R.string.field_serial_number_footer)) {
                    OutlinedTextField(
                        value = serialNumber,
                        onValueChange = { serialNumber = it },
                        label = { Text(stringResource(R.string.field_serial_number)) },
                        singleLine = true,
                        keyboardOptions = KeyboardOptions(
                            capitalization = KeyboardCapitalization.None,
                            autoCorrectEnabled = false,
                            keyboardType = KeyboardType.Ascii
                        ),
                        modifier = Modifier.fillMaxWidth()
                    )
                }
            }

            item {
                Button(
                    onClick = ::createPass,
                    enabled = canSubmit,
                    modifier = Modifier.fillMaxWidth()
                ) {
                    if (isSubmitting) {
                        CircularProgressIndicator(
                            modifier = Modifier.size(20.dp),
                            strokeWidth = 2.dp,
                            color = MaterialTheme.colorScheme.onPrimary
                        )
                    } else {
                        Text(stringResource(R.string.action_create_pass))
                    }
                }
            }

            if (statusMessage.isNotEmpty()) {
                item {
                    FormSection(title = stringResource(R.string.section_status)) {
                        Text(statusMessage, style = MaterialTheme.typography.bodyMedium)
                    }
                }
            }

            if (savedPasses.isNotEmpty()) {
                item {
                    FormSection(
                        title = stringResource(R.string.section_in_your_wallet),
                        footer = stringResource(R.string.section_in_your_wallet_footer),
                        contentSpacing = 0.dp
                    ) {
                        savedPasses.forEachIndexed { index, pass ->
                            SavedPassRow(
                                pass = pass,
                                onOpen = { openLink(context, pass.saveUrl) },
                                onShare = { shareWalletFunLink(context, pass.googleWalletSaveUrl) },
                                onForget = { savedPassStore.remove(pass.serialNumber) }
                            )
                            if (index < savedPasses.lastIndex) HorizontalDivider()
                        }
                    }
                }
            }
        }
    }

    createdPass?.let { response ->
        PassActionsSheet(
            response = response,
            holderName = "${firstName.trim()} ${lastName.trim()}".trim(),
            apiClient = apiClient,
            googleWalletClient = googleWalletClient,
            savedPassStore = savedPassStore,
            onDismiss = { createdPass = null }
        )
    }
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
private fun SavedPassRow(
    pass: SavedPass,
    onOpen: () -> Unit,
    onShare: () -> Unit,
    onForget: () -> Unit
) {
    val dismissState = rememberSwipeToDismissBoxState()

    SwipeToDismissBox(
        state = dismissState,
        enableDismissFromStartToEnd = false,
        onDismiss = { value ->
            if (value == SwipeToDismissBoxValue.EndToStart) onForget()
        },
        backgroundContent = {
            Box(
                modifier = Modifier
                    .fillMaxSize()
                    .padding(horizontal = 16.dp),
                contentAlignment = Alignment.CenterEnd
            ) {
                Icon(
                    imageVector = Icons.Default.Delete,
                    contentDescription = stringResource(R.string.action_forget),
                    tint = MaterialTheme.colorScheme.error
                )
            }
        }
    ) {
        Row(
            modifier = Modifier
                .fillMaxWidth()
                .clickable(onClick = onOpen)
                .padding(vertical = 8.dp),
            verticalAlignment = Alignment.CenterVertically
        ) {
            Column(modifier = Modifier.weight(1f)) {
                Text(pass.holderName.ifBlank { stringResource(R.string.app_name) }, style = MaterialTheme.typography.bodyLarge)
                Text(
                    pass.serialNumber,
                    style = MaterialTheme.typography.bodySmall,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                    fontFamily = FontFamily.Monospace
                )
            }
            IconButton(onClick = onShare) {
                Icon(Icons.Default.Share, contentDescription = stringResource(R.string.action_share))
            }
        }
    }
}

/** Card-based stand-in for a SwiftUI `Form` section with optional header and footer. */
@Composable
private fun FormSection(
    title: String? = null,
    footer: String? = null,
    contentSpacing: androidx.compose.ui.unit.Dp = 12.dp,
    content: @Composable () -> Unit
) {
    Column {
        if (title != null) {
            Text(
                title.uppercase(),
                style = MaterialTheme.typography.labelMedium,
                color = MaterialTheme.colorScheme.onSurfaceVariant,
                modifier = Modifier.padding(start = 4.dp, bottom = 6.dp)
            )
        }
        Card(modifier = Modifier.fillMaxWidth()) {
            Column(
                modifier = Modifier.padding(horizontal = 16.dp, vertical = 12.dp),
                verticalArrangement = Arrangement.spacedBy(contentSpacing)
            ) {
                content()
            }
        }
        if (footer != null) {
            Spacer(Modifier.height(6.dp))
            Text(
                footer,
                style = MaterialTheme.typography.bodySmall,
                color = MaterialTheme.colorScheme.onSurfaceVariant,
                modifier = Modifier.padding(horizontal = 4.dp)
            )
        }
    }
}
