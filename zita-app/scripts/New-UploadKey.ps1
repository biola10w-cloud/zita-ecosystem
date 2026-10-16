param(
    [string]$OpenSsl = 'C:\Program Files\Git\usr\bin\openssl.exe'
)
$ErrorActionPreference = 'Stop'
$repository = (Resolve-Path (Join-Path $PSScriptRoot '..\..')).Path
$secretDirectory = Join-Path $repository '.release-secrets'
$keystore = Join-Path $secretDirectory 'zita-upload.p12'
$passwordFile = Join-Path $secretDirectory 'upload-password.clixml'
if ((Test-Path -LiteralPath $keystore) -or (Test-Path -LiteralPath $passwordFile)) {
    throw 'Upload signing material already exists. Refusing to replace it.'
}
if (-not (Test-Path -LiteralPath $OpenSsl)) { throw 'OpenSSL was not found.' }
New-Item -ItemType Directory -Path $secretDirectory -Force | Out-Null
$identity = [Security.Principal.WindowsIdentity]::GetCurrent().Name
$acl = Get-Acl -LiteralPath $secretDirectory
$acl.SetAccessRuleProtection($true, $false)
$acl.AddAccessRule([Security.AccessControl.FileSystemAccessRule]::new($identity, 'FullControl', 'ContainerInherit,ObjectInherit', 'None', 'Allow'))
Set-Acl -LiteralPath $secretDirectory -AclObject $acl
$random = [byte[]]::new(48)
$generator = [Security.Cryptography.RandomNumberGenerator]::Create()
try { $generator.GetBytes($random) } finally { $generator.Dispose() }
$password = [Convert]::ToBase64String($random)
ConvertTo-SecureString -String $password -AsPlainText -Force | Export-Clixml -LiteralPath $passwordFile
$env:ZITA_KEY_GENERATION_PASSWORD = $password
$privateKey = Join-Path $secretDirectory 'temporary-encrypted-key.pem'
$certificate = Join-Path $secretDirectory 'upload-certificate.pem'
$generationLog = Join-Path $secretDirectory 'key-generation.log'
try {
    # OpenSSL progress uses stderr; capture it without changing native exit handling.
    $previousPreference = $ErrorActionPreference
    $ErrorActionPreference = 'Continue'
    & $OpenSsl req -x509 -newkey rsa:4096 -sha256 -days 10000 -subj '/CN=Afuwape Abiola Chris/O=ZITA THE APP' -keyout $privateKey -out $certificate -passout env:ZITA_KEY_GENERATION_PASSWORD 2> $generationLog
    $result = $LASTEXITCODE
    $ErrorActionPreference = $previousPreference
    if ($result -ne 0) { throw 'Upload certificate generation failed; inspect the private generation log.' }
    & $OpenSsl pkcs12 -export -name upload -inkey $privateKey -in $certificate -out $keystore -passin env:ZITA_KEY_GENERATION_PASSWORD -passout env:ZITA_KEY_GENERATION_PASSWORD
    if ($LASTEXITCODE -ne 0) { throw 'Upload keystore generation failed.' }
    & $OpenSsl pkcs12 -in $keystore -passin env:ZITA_KEY_GENERATION_PASSWORD -noout
    if ($LASTEXITCODE -ne 0) { throw 'Upload keystore verification failed.' }
    Remove-Item -LiteralPath $privateKey
    Write-Output 'Created and verified the upload keystore. Password is protected by Windows DPAPI for this Windows account.'
    & $OpenSsl x509 -in $certificate -noout -subject -fingerprint -sha256
} finally {
    Remove-Item Env:ZITA_KEY_GENERATION_PASSWORD -ErrorAction SilentlyContinue
    $password = $null
}
