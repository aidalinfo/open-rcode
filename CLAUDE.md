# CLAUDE.md - Guide pour Claude Code

Ce fichier fournit des conseils à Claude Code lors du travail sur la codebase open-rcode.

## Vue d'ensemble du projet

Open-rcode est une plateforme web containerisée qui permet aux développeurs d'exécuter des tâches de programmation assistées par IA dans des conteneurs isolés (Docker ou Kubernetes), créant automatiquement des Pull Requests GitHub. La plateforme est construite avec :
- **Frontend** : Nuxt 4 avec UI Pro
- **Backend** : API Nitro (Nuxt server)
- **Base de données** : MongoDB
- **Orchestration** : Docker et Kubernetes
- **IA** : Claude API, Claude Code OAuth, Gemini CLI

## Architecture et workflow principal

### Flux de travail complet
1. **User** → Soumet une tâche via l'interface web
2. **TaskContainerManager** → Crée un conteneur/pod isolé
3. **ClaudeExecutor** → Exécute les commandes IA dans le conteneur
4. **PullRequestCreator** → Commit les changements et crée une PR GitHub
5. **Cleanup** → Nettoie automatiquement le conteneur après exécution

### Structure du projet
```
/
├── app/
│   ├── docs/                  # Documentation (projet séparé)
│   └── open-rcode/           # Application principale
│       ├── app/              # Frontend Nuxt
│       ├── server/           # Backend API
│       │   ├── api/         # Endpoints HTTP
│       │   ├── models/      # Modèles MongoDB
│       │   └── utils/       # Logique métier
│       └── shared/          # Types partagés
├── Image/                    # Docker image du worker
└── docker-compose.yml        # Configuration locale
```

## Commandes de développement essentielles

```bash
# Navigation
cd app/open-rcode              # Aller dans l'application principale

# Développement
pnpm install                   # Installer les dépendances
pnpm dev                      # Démarrer le serveur de développement (http://localhost:3000)
pnpm build                    # Build de production
pnpm preview                  # Prévisualiser le build de production

# Qualité du code (TOUJOURS exécuter avant de créer une PR)
pnpm lint                     # Vérification ESLint
pnpm typecheck               # Validation TypeScript

# Base de données locale
docker-compose up -d mongodb  # Démarrer MongoDB localement

# Conteneurs
docker ps -f name=ccweb-task  # Lister les conteneurs de tâches actifs
kubectl get pods -l ccweb.managed=true  # Lister les pods Kubernetes
```

## Composants backend critiques

### Orchestration des conteneurs (`server/utils/`)
- **task-container.ts** : Orchestrateur principal du workflow des tâches
- **container-setup.ts** : Configure les environnements de conteneurs avec les dépendances
- **claude-executor.ts** : Exécute les commandes Claude/Gemini avec streaming en temps réel
- **pull-request-creator.ts** : Gère les opérations Git et la création de PR GitHub
- **repository-cloner.ts** : Clone les repos avec authentification GitHub App

### Gestion multi-conteneurs (`server/utils/container/`)
- **container-manager-factory.ts** : Factory pattern pour Docker/Kubernetes
- **base-container-manager.ts** : Interface abstraite pour les opérations
- **docker-adapter.ts** : Implémentation Docker via Dockerode
- **kubernetes-adapter.ts** : Implémentation Kubernetes via kubectl
- **kubernetes/kubernetes-manager.ts** : Opérations natives Kubernetes

### Modèles de données (`server/models/`)
```typescript
// Task : Tâche d'exécution avec état
Task {
  userId: string               // ID GitHub de l'utilisateur
  environmentId: string        // Configuration de l'environnement
  status: 'pending' | 'running' | 'completed' | 'failed'
  dockerId?: string           // ID du conteneur/pod
  pr?: string                 // URL de la PR créée
  planMode?: boolean          // Mode plan activé
  messages: Message[]         // Historique (legacy)
}

// TaskMessage : Stockage principal des conversations
TaskMessage {
  taskId: string              // Référence à Task
  role: 'user' | 'assistant'
  content: string             // Contenu du message
  type?: string               // Type spécial (pr_link, etc.)
}

// Environment : Configuration par repository
Environment {
  repositoryFullName: string   // Format owner/repo
  runtime: 'node' | 'python' | 'php'
  aiProvider: 'anthropic-api' | 'claude-oauth' | 'gemini-cli' | 'admin-gemini'
  model: 'opus' | 'sonnet'
  defaultBranch: string        // Branche de base pour les PR
  environmentVariables: []     // Variables d'environnement custom
  configurationScript?: string // Script de setup pré-exécution
}

// User : Profil utilisateur avec clés API cryptées
User {
  githubId: string
  githubAppInstallationIds: string[]  // IDs des installations GitHub App
  anthropicKey?: string               // Crypté avec ENCRYPTION_KEY
  claudeOAuthToken?: string           // Crypté
  geminiApiKey?: string               // Crypté
  role: 'basic' | 'premium' | 'admin'
}
```

## Configuration des providers IA

La plateforme supporte plusieurs providers IA configurables par environnement :

1. **anthropic-api** : Utilise la clé API Anthropic de l'utilisateur
2. **claude-oauth** : Utilise le token OAuth Claude Code de l'utilisateur
3. **gemini-cli** : Utilise la clé API Gemini de l'utilisateur
4. **admin-gemini** : Utilise la clé Gemini admin du système (ADMIN_GOOGLE_API_KEY)

### Détection automatique des titres de PR
Le système utilise automatiquement Gemini Admin pour suggérer des titres de PR basés sur le git diff des modifications.

## Détails d'implémentation critiques

### 1. Système de stockage dual des messages
```typescript
// IMPORTANT : Toujours sauvegarder dans les DEUX modèles
// Task.messages[] : Pour la compatibilité legacy
// TaskMessageModel : Stockage principal pour le threading
```

### 2. Mode Plan (--permission-mode plan)
- Active un workflow en deux phases pour Claude
- Phase 1 : Génération du plan avec ExitPlanMode
- Phase 2 : Exécution du plan généré
- Non supporté pour Gemini

### 3. Streaming en temps réel
- Les tool calls de Claude sont sauvegardés en temps réel pendant l'exécution
- Support du streaming pour Kubernetes via spawn process
- Timeout de 30 minutes pour les commandes longues

### 4. Gestion des conteneurs/pods
- **Docker** : Les conteneurs persistent après exécution (nettoyage manuel requis)
- **Kubernetes** : Auto-cleanup après l'exécution de la tâche
- Workspace unique par tâche : `/tmp/workspace-{timestamp}-{taskId}/`

### 5. Authentification GitHub
- OAuth pour l'authentification utilisateur
- GitHub Apps pour l'accès aux repositories
- Tokens d'installation générés dynamiquement par repo

## Variables d'environnement requises

```bash
# Base de données
DATABASE_URL=mongodb://localhost:27017/ccweb

# Mode conteneur
CONTAINER_MODE=docker              # ou "kubernetes"

# GitHub (REQUIS)
GITHUB_APP_ID=123456
GITHUB_PRIVATE_KEY=-----BEGIN RSA PRIVATE KEY-----...
GITHUB_CLIENT_ID=Iv1.xxxxxxxxxxxx
GITHUB_CLIENT_SECRET=xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx

# Sécurité (REQUIS)
ENCRYPTION_KEY=32_caracteres_exactement_requis!!  # Pour crypter les API keys
SESSION_SECRET=votre_secret_de_session

# Kubernetes (si CONTAINER_MODE=kubernetes)
KUBERNETES_NAMESPACE=default       # Optionnel
KUBECONFIG=/path/to/kubeconfig     # Optionnel
KUBERNETES_CONTEXT=my-context      # Optionnel

# Admin (optionnel)
ADMIN_GOOGLE_API_KEY=AIza...       # Pour suggestions Gemini automatiques
BASE_ROLE=basic                    # Rôle par défaut des nouveaux users

# UI Pro (REQUIS pour le build)
NUXT_UI_PRO_LICENSE=xxxx-xxxx-xxxx-xxxx
```

## Problèmes courants et solutions

### 1. "No space left on device" (Docker)
```bash
# Nettoyer les conteneurs de tâches
docker stop $(docker ps -q -f name=ccweb-task)
docker rm $(docker ps -aq -f name=ccweb-task)
docker system prune -f
```

### 2. Pod "ImagePullBackOff" (Kubernetes)
- Vérifier que l'image `ghcr.io/aidalinfo/open-rcoder-worker:latest` est accessible
- Vérifier les secrets d'image pull si registre privé
- Tester : `kubectl run test --image=ghcr.io/aidalinfo/open-rcoder-worker:latest`

### 3. Claude Command Failed (Exit Code 128)
- Vérifier la validité du token OAuth/API key
- S'assurer que Claude Code est installé : visible dans entrypoint.sh
- Vérifier les variables d'environnement dans le conteneur

### 4. Messages non trouvés dans l'UI
- Vérifier que les messages sont sauvés dans TaskMessageModel
- Ne pas se fier uniquement à Task.messages[] (legacy)

### 5. PR non créée automatiquement
- Vérifier que la GitHub App est installée sur le repository
- Vérifier les permissions de l'installation
- S'assurer que l'utilisateur a au moins un githubAppInstallationId

## Conventions et pratiques de code

### 1. Structure des API Nitro
```typescript
// Utiliser defineEventHandler pour tous les endpoints
export default defineEventHandler(async (event) => {
  // Authentification via session cookie
  const sessionToken = getCookie(event, 'session')
  // Validation et logique
  // Retourner un objet JSON
})
```

### 2. Gestion des erreurs
```typescript
// Toujours utiliser createError de Nitro
throw createError({
  statusCode: 404,
  statusMessage: 'Resource not found'
})
```

### 3. Modèles MongoDB
- Utiliser des index pour optimiser les requêtes fréquentes
- Toujours mettre à jour `updatedAt` dans les pre-save hooks
- Préférer les IDs string (githubId) aux ObjectId pour les références utilisateur

### 4. Sécurité
- Ne JAMAIS logger ou exposer les clés API
- Toujours crypter les données sensibles avec la fonction `encrypt()`
- Valider l'appartenance des ressources avant l'accès

### 5. Conteneurs
- Utiliser des noms uniques : `ccweb-task-{taskId}-{timestamp}`
- Toujours taguer avec `ccweb.managed=true` pour le tracking
- Implémenter le cleanup automatique après exécution

## Notes spécifiques pour Claude Code

### À faire systématiquement
1. **Avant toute modification** : Lire le fichier existant avec Read
2. **Après les modifications** : Exécuter `pnpm lint` et `pnpm typecheck`
3. **Pour les nouvelles features** : Vérifier les patterns existants dans le code
4. **Pour les bugs** : Chercher dans TaskMessageModel pour les erreurs

### Patterns importants
- Le dual storage des messages est CRITIQUE - toujours sauver dans les deux
- Les conteneurs Docker persistent, les pods Kubernetes sont auto-nettoyés
- L'authentification GitHub App est par installation, pas globale
- Le mode plan nécessite une gestion spéciale du workflow Claude

### Points d'attention
- Les workspaces sont uniques par tâche pour éviter les conflits
- Le streaming en temps réel nécessite des callbacks spéciaux
- Les timeouts sont de 30 minutes pour les commandes longues
- Gemini Admin est utilisé automatiquement pour les titres de PR

### Structure des commandes IA
```bash
# Claude API/OAuth avec streaming JSON
claude --verbose --output-format stream-json --model sonnet -p "prompt"

# Claude en mode plan
claude --verbose --output-format stream-json --permission-mode plan --model sonnet -p "prompt"

# Gemini CLI (pas de streaming JSON)
gemini --model gemini-2.0-flash -p "prompt"
```

## Debugging et logs

### Activer les logs détaillés
- Les composants loggent avec des emojis pour faciliter le suivi
- 🐳 Docker / ☸️ Kubernetes / 🤖 Claude / 🚀 Execution
- Vérifier les logs des conteneurs pour les erreurs d'exécution

### Points de vérification
1. MongoDB : `docker-compose logs mongodb`
2. Conteneurs de tâches : `docker logs ccweb-task-*`
3. Pods Kubernetes : `kubectl logs -l ccweb.managed=true`
4. Application : Console du navigateur et logs serveur Nuxt