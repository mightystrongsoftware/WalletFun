package com.mightystrong.walletfun.ui

import androidx.compose.foundation.isSystemInDarkTheme
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.darkColorScheme
import androidx.compose.material3.lightColorScheme
import androidx.compose.runtime.Composable
import androidx.compose.ui.graphics.Color

/** WalletFun teal, matching the pass background colour on both wallets. */
private val WalletFunTeal = Color(0xFF0F766E)
private val WalletFunTealLight = Color(0xFF5EEAD4)
private val WalletFunMint = Color(0xFFD1FAE5)

private val LightColors = lightColorScheme(
    primary = WalletFunTeal,
    onPrimary = Color.White,
    primaryContainer = WalletFunMint,
    onPrimaryContainer = Color(0xFF042F2E)
)

private val DarkColors = darkColorScheme(
    primary = WalletFunTealLight,
    onPrimary = Color(0xFF042F2E),
    primaryContainer = WalletFunTeal,
    onPrimaryContainer = WalletFunMint
)

@Composable
fun WalletFunTheme(content: @Composable () -> Unit) {
    MaterialTheme(
        colorScheme = if (isSystemInDarkTheme()) DarkColors else LightColors,
        content = content
    )
}
