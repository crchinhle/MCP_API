plugins {
    id("com.android.application")
    id("org.jetbrains.kotlin.plugin.compose")
}
android {
    namespace = "vn.emukey.licensedemo"
    compileSdk = 36
    defaultConfig {
        applicationId = "vn.emukey.licensedemo"
        minSdk = 26
        targetSdk = 36
        versionCode = 1
        versionName = "1.0"
    }
    buildFeatures { compose = true; buildConfig = true }
    compileOptions { sourceCompatibility = JavaVersion.VERSION_17; targetCompatibility = JavaVersion.VERSION_17 }
    packaging { resources.excludes += setOf("META-INF/DEPENDENCIES", "META-INF/LICENSE*", "META-INF/NOTICE*") }
    providers.gradleProperty("emukeyTestSources").orNull?.let { sourceSets.getByName("test").kotlin.directories.add(it) }
}
dependencies {
    implementation(platform("androidx.compose:compose-bom:2025.08.01"))
    implementation("androidx.activity:activity-compose:1.13.0")
    implementation("androidx.compose.material3:material3")
    // Only EIP-191/ECKeyPair/Keys/Numeric are used. Exclude transaction/wallet/native KZG dependencies.
    implementation("org.web3j:crypto:4.12.3") { isTransitive = false }
    implementation("org.web3j:utils:4.12.3") { isTransitive = false }
    implementation("org.bouncycastle:bcprov-jdk18on:1.86")
    testImplementation("junit:junit:4.13.2")
}
