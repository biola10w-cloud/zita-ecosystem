import java.util.Properties

plugins {
    id("com.android.application")
    // The Flutter Gradle Plugin must be applied after the Android and Kotlin Gradle plugins.
    id("dev.flutter.flutter-gradle-plugin")
}

val uploadProperties = Properties()
val uploadPropertiesFile = rootProject.file("key.properties")
if (uploadPropertiesFile.exists()) {
    uploadPropertiesFile.inputStream().use { uploadProperties.load(it) }
}
fun uploadSetting(property: String, environment: String): String? =
    System.getenv(environment)?.takeIf { it.isNotBlank() }
        ?: uploadProperties.getProperty(property)?.takeIf { it.isNotBlank() }

val uploadStore = uploadSetting("storeFile", "ZITA_UPLOAD_STORE_FILE")
val uploadStorePassword = uploadSetting("storePassword", "ZITA_UPLOAD_STORE_PASSWORD")
val uploadAlias = uploadSetting("keyAlias", "ZITA_UPLOAD_KEY_ALIAS")
val uploadKeyPassword = uploadSetting("keyPassword", "ZITA_UPLOAD_KEY_PASSWORD")
// CI compiles an explicitly unsigned intermediate for signing on the owner's computer.
val unsignedIntermediate = System.getenv("ZITA_BUILD_UNSIGNED") == "true"

if (!unsignedIntermediate && gradle.startParameter.taskNames.any { it.contains("release", ignoreCase = true) }) {
    require(listOf(uploadStore, uploadStorePassword, uploadAlias, uploadKeyPassword).all { it != null }) {
        "Release signing is required. Configure ZITA_UPLOAD_* variables or android/key.properties. Debug signing is never used for release builds."
    }
    require(file(uploadStore!!).isFile) { "The configured release upload keystore does not exist." }
}

android {
    namespace = "com.zita.zita_app"
    compileSdk = flutter.compileSdkVersion
    ndkVersion = flutter.ndkVersion

    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_17
        targetCompatibility = JavaVersion.VERSION_17
    }

    defaultConfig {
        // Preserve this identifier for all updates once the first bundle is uploaded.
        applicationId = "com.zita.zita_app"
        // You can update the following values to match your application needs.
        // For more information, see: https://flutter.dev/to/review-gradle-config.
        minSdk = flutter.minSdkVersion
        targetSdk = flutter.targetSdkVersion
        // Uses the version code from pubspec.yaml. When using split APKs, 1000 * ABI_VERSION
        // is added automatically by Flutter. (https://developer.android.com/studio/build/configure-apk-splits#configure-APK-versions)
        // You can force using the value of versionCode by specifying the `-P force-version-code-ignoring-abi=true`
        // flag during build.
        versionCode = flutter.versionCode
        versionName = flutter.versionName
    }

    signingConfigs {
        create("release") {
            storeFile = uploadStore?.let { file(it) }
            storePassword = uploadStorePassword
            keyAlias = uploadAlias
            keyPassword = uploadKeyPassword
        }
    }

    buildTypes {
        release {
            signingConfig = if (unsignedIntermediate) null else signingConfigs.getByName("release")
        }
    }
}

kotlin {
    compilerOptions {
        jvmTarget = org.jetbrains.kotlin.gradle.dsl.JvmTarget.JVM_17
    }
}

flutter {
    source = "../.."
}
