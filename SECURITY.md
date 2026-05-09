# Security & Secrets

## Antes de tornar o repo público

### 1. Revogar e rotacionar TODOS os secrets atualmente no `.env`

Mesmo que `.env` esteja no `.gitignore`, o ideal antes de publicar é trocar
todos os valores que já estão na sua máquina:

| Secret | Onde rotacionar |
|--------|-----------------|
| `PRIVY_APP_SECRET` | dashboard.privy.io → seu app → Settings → API → rotate |
| `FOUR_P_API_KEY` | suporte 4P solicitar nova chave |
| Google OAuth `client_secret` | console.cloud.google.com → Credentials → revoke + create new |
| Neon `DATABASE_URL` | neon.tech → projeto → Connection details → reset password |
| Helius RPC `api-key` | helius.dev → API keys → rotate |
| `DB_ENCRYPTION_KEY` | gerar nova de 32+ chars (atenção: dados criptografados ficam ilegíveis) |
| `CRON_SECRET` | gerar nova string aleatória |

### 2. Limpar arquivos sensíveis do diretório

Antes do `git init`:

```bash
# Deletar arquivos sensíveis (mover pra fora do repo se quiser guardar)
rm 4pay.txt
rm client_secret_*.apps.googleusercontent.com.json

# Verificar que .env e .next não vão entrar
git status --ignored
```

### 3. Inicializar git LIMPO (sem histórico de secrets)

```bash
git init
git add .gitignore .env.example
git commit -m "chore: initial gitignore"
git add .
git commit -m "feat: poupapp initial public release"
git remote add origin <url-do-github>
git push -u origin main
```

**Importante**: NÃO faça `git init` sem deletar 4pay.txt antes — o secret entra
no commit inicial e mesmo deletando depois fica no histórico.

### 4. Se já fez commits com secrets antes de ler isso

Use `git filter-repo` ou BFG Repo-Cleaner pra reescrever o histórico:

```bash
# Instala bfg
brew install bfg     # macOS
# ou baixa o jar de https://rtyley.github.io/bfg-repo-cleaner/

bfg --delete-files 4pay.txt
bfg --replace-text passwords.txt   # arquivo com lista de secrets pra mascarar
git reflog expire --expire=now --all && git gc --prune=now --aggressive
git push --force
```

E **revogue tudo** mesmo assim — secrets que vazaram no histórico GitHub são
indexados rapidamente por bots.

## Estrutura segura de secrets

- **Local dev**: `.env` (gitignored)
- **Production**: variáveis de ambiente do host (Vercel/Railway/PM2/systemd)
- **Compartilhar com time**: 1Password, Vault, Doppler — nunca commit, nunca Slack

## Pre-commit hook recomendado

`.husky/pre-commit`:

```bash
#!/bin/sh
# bloqueia commit se tiver secret-ish strings
if git diff --cached | grep -E "(GOCSPX-|privy_app_secret_|npg_|sk_live|api[_-]?key.*=.*[A-Za-z0-9]{20,})" > /dev/null; then
  echo "❌ Possível secret no commit. Aborte e revise."
  exit 1
fi
```

## Referências

- https://docs.github.com/en/code-security/secret-scanning/about-secret-scanning
- https://github.com/Yelp/detect-secrets — scanner de secrets em CI
- https://github.com/zricethezav/gitleaks — scanner alternativo
