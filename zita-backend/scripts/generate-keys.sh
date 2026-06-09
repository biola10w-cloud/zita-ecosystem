#!/usr/bin/env bash
set -euo pipefail
echo "🔑 Generating ZITA RSA key pair..."
mkdir -p keys
openssl genrsa -out keys/private.pem 2048
openssl rsa -in keys/private.pem -pubout -out keys/public.pem
chmod 600 keys/private.pem
echo "✅ Keys generated:"
echo "   Private: keys/private.pem (keep secret!)"
echo "   Public:  keys/public.pem"
echo ""
echo "Public key fingerprint (SHA-256):"
openssl pkey -pubin -in keys/public.pem -outform DER | openssl dgst -sha256 -hex | awk '{print $2}'
echo ""
echo "⚠  In production, upload to AWS Secrets Manager:"
echo "   aws secretsmanager put-secret-value --secret-id zita/jwt-private-key --secret-string file://keys/private.pem"
