package com.mightystrong.walletfun.ui

import android.content.Context
import android.content.Intent
import androidx.core.net.toUri
import com.mightystrong.walletfun.R

/** Android stand-in for SwiftUI's `ShareLink`: shares a pass link with subject and message. */
fun shareWalletFunLink(context: Context, url: String) {
    val subject = context.getString(R.string.share_subject)
    val message = context.getString(R.string.share_message)
    val intent = Intent(Intent.ACTION_SEND).apply {
        type = "text/plain"
        putExtra(Intent.EXTRA_SUBJECT, subject)
        putExtra(Intent.EXTRA_TEXT, "$message\n$url")
    }
    context.startActivity(Intent.createChooser(intent, subject))
}

fun openLink(context: Context, url: String) {
    context.startActivity(Intent(Intent.ACTION_VIEW, url.toUri()))
}
