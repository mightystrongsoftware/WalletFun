package com.mightystrong.walletfun

import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import kotlinx.serialization.Serializable
import kotlinx.serialization.json.Json
import okhttp3.HttpUrl
import okhttp3.MediaType.Companion.toMediaType
import okhttp3.OkHttpClient
import okhttp3.Request
import okhttp3.RequestBody.Companion.toRequestBody
import java.io.IOException

class WalletFunApiClient(
    private val baseUrl: HttpUrl = AppConfiguration.walletFunApiBaseUrl,
    private val httpClient: OkHttpClient = OkHttpClient()
) {
    private val json = Json {
        ignoreUnknownKeys = true
        explicitNulls = false
    }

    suspend fun createPass(firstName: String, lastName: String, serialNumber: String? = null): CreatePassResponse =
        withContext(Dispatchers.IO) {
            val url = baseUrl.newBuilder().addPathSegments("api/passes").build()
            val body = json.encodeToString(CreatePassRequest(firstName, lastName, serialNumber))
            val request = Request.Builder()
                .url(url)
                .post(body.toRequestBody(JSON_MEDIA_TYPE))
                .build()

            httpClient.newCall(request).execute().use { response ->
                val payload = response.body?.string().orEmpty()
                if (!response.isSuccessful) {
                    throw errorFrom(payload)
                }
                json.decodeFromString<CreatePassResponse>(payload)
            }
        }

    /**
     * Fetches the signed "Save to Google Wallet" JWT for a pass. The Android
     * counterpart of downloading the `.pkpass` on iOS: the pass is only
     * materialised in Google Wallet when the user chooses to add it.
     */
    suspend fun fetchGoogleWalletPass(googleWalletUrl: String): GoogleWalletSavePayload =
        withContext(Dispatchers.IO) {
            val request = Request.Builder().url(googleWalletUrl).get().build()

            httpClient.newCall(request).execute().use { response ->
                val payload = response.body?.string().orEmpty()
                if (!response.isSuccessful) {
                    throw errorFrom(payload)
                }
                json.decodeFromString<GoogleWalletSavePayload>(payload)
            }
        }

    private fun errorFrom(payload: String): WalletFunApiException {
        val message = runCatching { json.decodeFromString<ApiErrorResponse>(payload).message }.getOrNull()
        return if (message.isNullOrBlank()) WalletFunApiException.RequestFailed else WalletFunApiException.ServerMessage(message)
    }

    private companion object {
        val JSON_MEDIA_TYPE = "application/json; charset=utf-8".toMediaType()
    }
}

@Serializable
data class CreatePassRequest(
    val firstName: String,
    val lastName: String,
    val serialNumber: String? = null
)

@Serializable
data class CreatePassResponse(
    val id: String,
    val serialNumber: String,
    /** Apple Wallet `.pkpass` download. Unused on Android but part of the API contract. */
    val downloadUrl: String,
    /** Endpoint that returns the Save to Google Wallet JWT. */
    val googleWalletUrl: String,
    /** Shareable link that redirects into the Google Wallet save flow. */
    val googleWalletSaveUrl: String,
    val updated: Boolean? = null
)

@Serializable
data class GoogleWalletSavePayload(
    val objectId: String,
    val saveJwt: String,
    val saveUrl: String
)

@Serializable
private data class ApiErrorResponse(val message: String)

sealed class WalletFunApiException(message: String) : IOException(message) {
    data object RequestFailed : WalletFunApiException("The WalletFun server returned an error.") {
        private fun readResolve(): Any = RequestFailed
    }

    class ServerMessage(message: String) : WalletFunApiException(message)
}
