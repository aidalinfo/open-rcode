# AGENTS.md — Notes pour agents Codex

Ce dépôt utilise un exécuteur IA (« AI Executor ») pour lancer des commandes Codex dans des environnements conteneurisés (Docker/Kubernetes) et créer des PR automatiquement. Cette page résume ce qui est utile aux agents (Claude/Gemini) pour intervenir efficacement, avec un focus sur les nouveaux providers Codex disponibles.

## Providers IA pris en charge

- `anthropic-api`
  - Clé: `ANTHROPIC_API_KEY`
  - Modèles: `opus`, `sonnet`, `claude-sonnet-4`
  - Streaming: oui • Mode plan: oui • MCP: oui

- `claude-oauth`
  - Clé: `CLAUDE_CODE_OAUTH_TOKEN`
  - Modèles: `opus`, `sonnet`, `claude-sonnet-4`
  - Streaming: oui • Mode plan: oui • MCP: oui

- `gemini-cli`
  - Clé: `GEMINI_API_KEY`
  - Modèles: `gemini-2.0-flash`
  - Streaming: non • Mode plan: non • MCP: non

- `admin-gemini`
  - Clé: `ADMIN_GOOGLE_API_KEY` (système)
  - Modèles: `gemini-2.0-flash`
  - Streaming: non • Mode plan: non • MCP: non

Réglage par environnement: `Environment.aiProvider` et `Environment.model`. Voir `apps/open-rcode/server/utils/ai-providers/*` et le `ClaudeExecutor`.

## Bonnes pratiques (agents)

- Toujours exécuter `pnpm lint` et `pnpm typecheck` avant PR.
- Respecter le stockage double des messages (`Task.messages[]` legacy + `TaskMessageModel`).
- Préserver la structure existante et limiter la portée des changements.
- Ne jamais journaliser des secrets (API keys, tokens OAuth).
- Utiliser le mode plan uniquement avec les providers Claude; fallback automatique en cas d’échec.

## Variables d’environnement utiles

- `ANTHROPIC_API_KEY`, `CLAUDE_CODE_OAUTH_TOKEN`, `GEMINI_API_KEY`, `ADMIN_GOOGLE_API_KEY`
- `DATABASE_URL`, `GITHUB_*`, `ENCRYPTION_KEY`
- `CONTAINER_MODE` = `docker` ou `kubernetes`

## Commandes utiles

- Développement: `cd apps/open-rcode && pnpm install && pnpm dev`
- Build/preview: `pnpm build && pnpm preview`
- Lint/Types: `pnpm lint && pnpm typecheck`
- Docker: `docker ps -f name=openrcode-task` • K8s: `kubectl get pods -l openrcode.managed=true`

## Notes d’exécution

- MCP: support détecté automatiquement (fichiers `.mcp.json` ou `servers.json`) pour providers Claude.
- Les workspaces sont isolés par tâche: `/tmp/workspace-{timestamp}-{taskId}/`.
- `admin-gemini` est réservé aux automatisations système (ex: titres de PR).

