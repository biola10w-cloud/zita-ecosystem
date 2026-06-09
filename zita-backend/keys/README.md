# Keys Directory

This directory stores RSA key pair files used for JWT signing.

**These files are git-ignored and must NEVER be committed.**

## Generate keys
```bash
bash scripts/generate-keys.sh
```

This creates:
- `private.pem` — RS256 private key (sign JWTs)
- `public.pem`  — RS256 public key  (verify JWTs)

## Production
In production, store keys in AWS Secrets Manager and load at runtime.
Do NOT bake keys into Docker images.
