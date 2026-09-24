package com.mightystrong.walletfun

import okhttp3.HttpUrl
import okhttp3.HttpUrl.Companion.toHttpUrl
import okhttp3.HttpUrl.Companion.toHttpUrlOrNull

object AppConfiguration {
    /**
     * Base URL of the WalletFun API. Baked in at build time from the
     * `walletFunApiBaseUrl` Gradle property, mirroring the iOS Info.plist key.
     */
    val walletFunApiBaseUrl: HttpUrl =
        BuildConfig.WALLETFUN_API_BASE_URL.trim().toHttpUrlOrNull()
            ?: "https://walletfun.onrender.com".toHttpUrl()
}
