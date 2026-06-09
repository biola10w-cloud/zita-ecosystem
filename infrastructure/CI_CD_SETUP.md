# GitHub Actions CI/CD Setup

The workflow files need to be added manually because they require
the `workflow` scope on your GitHub Personal Access Token.

## How to add workflows

1. Go to your repo: https://github.com/biola10w-cloud/zita-ecosystem
2. Click **Add file** → **Create new file**
3. Name it: `.github/workflows/api.yml`
4. Paste the content from `infrastructure/workflows/api.yml`
5. Repeat for `admin.yml` and `mobile.yml`

OR generate a new token with the `workflow` scope:
1. GitHub → Settings → Developer settings → Personal access tokens
2. Create token with scopes: `repo` + `workflow`
3. Run: `git push origin main` (workflows will push automatically)

## Required GitHub Secrets

Go to: Settings → Secrets and variables → Actions

| Secret | Description |
|--------|-------------|
| `VPS_HOST` | Your Hostinger VPS IP address |
| `VPS_USER` | `zita` (your VPS deploy user) |
| `VPS_SSH_KEY` | Private SSH key for VPS access |
| `API_URL` | `https://api.yourdomain.com/api/v1` |
| `JWT_SECRET` | Same JWT secret as your backend |
