# kotlinx.serialization generated serializers are looked up reflectively by
# name; keep the model classes intact if minification is ever enabled.
-keepclassmembers class com.mightystrong.walletfun.** {
    *** Companion;
}
-keepclasseswithmembers class com.mightystrong.walletfun.** {
    kotlinx.serialization.KSerializer serializer(...);
}
