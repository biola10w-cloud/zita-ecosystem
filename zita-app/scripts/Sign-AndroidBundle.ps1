param(
    [Parameter(Mandatory = $true)][string]$Bundle,
    [Parameter(Mandatory = $true)][string]$JavaHome,
    [string]$Version = '1.0.0-1'
)
$ErrorActionPreference = 'Stop'
$repository = (Resolve-Path (Join-Path $PSScriptRoot '..\..')).Path
$bundlePath = (Resolve-Path -LiteralPath $Bundle).Path
$keystore = Join-Path $repository '.release-secrets\zita-upload.p12'
$passwordFile = Join-Path $repository '.release-secrets\upload-password.clixml'
$jarsigner = Join-Path $JavaHome 'bin\jarsigner.exe'
$keytool = Join-Path $JavaHome 'bin\keytool.exe'
foreach ($required in @($keystore, $passwordFile, $jarsigner, $keytool)) {
    if (-not (Test-Path -LiteralPath $required -PathType Leaf)) { throw "Required signing file is missing: $required" }
}
if ($Version -notmatch '^[0-9A-Za-z.-]+$') { throw 'Version must contain only letters, numbers, dots, and hyphens.' }
$outputDirectory = Join-Path $repository "release-artifacts\android\$Version"
New-Item -ItemType Directory -Path $outputDirectory -Force | Out-Null
$signedBundle = Join-Path $outputDirectory "ZITA-THE-APP-$Version.aab"
if (Test-Path -LiteralPath $signedBundle) { throw 'Signed bundle already exists. Refusing to overwrite it.' }
Add-Type -AssemblyName System.IO.Compression.FileSystem
$archive = [IO.Compression.ZipFile]::OpenRead($bundlePath)
try {
    if (-not $archive.GetEntry('BundleConfig.pb')) { throw 'Input is not an Android App Bundle.' }
    if ($archive.Entries.FullName | Where-Object { $_ -match '^META-INF/.*\.(RSA|DSA|EC|SF)$' }) {
        throw 'Input must be the unsigned CI bundle, not a previously signed bundle.'
    }
} finally { $archive.Dispose() }
$password = Import-Clixml -LiteralPath $passwordFile
$env:ZITA_LOCAL_SIGNING_PASSWORD = ([PSCredential]::new('upload', $password)).GetNetworkCredential().Password
try {
    & $jarsigner -keystore $keystore -storetype PKCS12 -storepass:env ZITA_LOCAL_SIGNING_PASSWORD -keypass:env ZITA_LOCAL_SIGNING_PASSWORD -digestalg SHA-256 -sigalg SHA256withRSA -signedjar $signedBundle $bundlePath upload
    if ($LASTEXITCODE -ne 0) { throw 'Signing failed.' }
    $verification = & $jarsigner -verify -strict -verbose -certs -keystore $keystore -storetype PKCS12 -storepass:env ZITA_LOCAL_SIGNING_PASSWORD $signedBundle
    if ($LASTEXITCODE -ne 0 -or -not ($verification -match 'jar verified\.')) { throw 'Strict signature verification failed.' }
    $verification | Set-Content -LiteralPath (Join-Path $outputDirectory 'signature-verification.txt') -Encoding utf8
    & $keytool -exportcert -rfc -keystore $keystore -storetype PKCS12 -storepass:env ZITA_LOCAL_SIGNING_PASSWORD -alias upload -file (Join-Path $outputDirectory 'upload-certificate.pem')
    if ($LASTEXITCODE -ne 0) { throw 'Certificate export failed.' }
    $certificate = & $keytool -printcert -jarfile $signedBundle
    if ($LASTEXITCODE -ne 0 -or ($certificate -match 'CN=Android Debug')) { throw 'Bundle certificate verification failed.' }
    $certificate | Set-Content -LiteralPath (Join-Path $outputDirectory 'bundle-certificate.txt') -Encoding utf8
    $hash = (Get-FileHash -LiteralPath $signedBundle -Algorithm SHA256).Hash.ToLowerInvariant()
    "$hash  $([IO.Path]::GetFileName($signedBundle))" | Set-Content -LiteralPath (Join-Path $outputDirectory 'SHA256SUMS.txt') -Encoding ascii
    Write-Output "Signed and verified: $signedBundle"
    Write-Output "SHA256: $hash"
} finally {
    Remove-Item Env:ZITA_LOCAL_SIGNING_PASSWORD -ErrorAction SilentlyContinue
}
