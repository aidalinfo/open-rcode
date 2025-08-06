#!/bin/bash --login

set -euo pipefail

CODEX_ENV_PYTHON_VERSION=${CODEX_ENV_PYTHON_VERSION:-}
CODEX_ENV_NODE_VERSION=${CODEX_ENV_NODE_VERSION:-}
CODEX_ENV_RUST_VERSION=${CODEX_ENV_RUST_VERSION:-}
CODEX_ENV_GO_VERSION=${CODEX_ENV_GO_VERSION:-}
CODEX_ENV_SWIFT_VERSION=${CODEX_ENV_SWIFT_VERSION:-}

echo "Configuring language runtimes..."

# For Python and Node, always run the install commands so we can install
# global libraries for linting and formatting. This just switches the version.

# For others (e.g. rust), to save some time on bootup we only install other language toolchains
# if the versions differ.

# if [ -n "${CODEX_ENV_PYTHON_VERSION}" ]; then
#     echo "# Python: ${CODEX_ENV_PYTHON_VERSION}"
#     pyenv global "${CODEX_ENV_PYTHON_VERSION}"
# fi

if [ -n "${CODEX_ENV_NODE_VERSION}" ]; then
    echo "# Node.js: ${CODEX_ENV_NODE_VERSION}"
    source /root/.nvm/nvm.sh
    nvm alias default "${CODEX_ENV_NODE_VERSION}"
    nvm use "${CODEX_ENV_NODE_VERSION}"
    corepack enable
    corepack install -g yarn pnpm npm
    
    # S'assurer que NVM est disponible dans tous les shells
    echo 'export NVM_DIR="/root/.nvm"' >> /root/.bashrc
    echo '[ -s "$NVM_DIR/nvm.sh" ] && \. "$NVM_DIR/nvm.sh"' >> /root/.bashrc
    echo '[ -s "$NVM_DIR/bash_completion" ] && \. "$NVM_DIR/bash_completion"' >> /root/.bashrc
    # Activer Node par défaut dans le PATH global
    NODE_PATH=$(nvm which "${CODEX_ENV_NODE_VERSION}")
    NODE_BIN_DIR=$(dirname "${NODE_PATH}")
    echo "export PATH=\"${NODE_BIN_DIR}:\$PATH\"" >> /etc/profile
    echo "export PATH=\"${NODE_BIN_DIR}:\$PATH\"" >> /root/.bashrc
fi

# if [ -n "${CODEX_ENV_RUST_VERSION}" ]; then
#     current=$(rustc --version | awk '{print $2}')   # ==> 1.86.0
#     echo "# Rust: ${CODEX_ENV_RUST_VERSION} (default: ${current})"
#     if [ "${current}" != "${CODEX_ENV_RUST_VERSION}" ]; then
#         rustup toolchain install --no-self-update "${CODEX_ENV_RUST_VERSION}"
#         rustup default "${CODEX_ENV_RUST_VERSION}"
#         # Pre-install common linters/formatters
#         # clippy is already installed
#     fi
# fi

# if [ -n "${CODEX_ENV_GO_VERSION}" ]; then
#     current=$(go version | awk '{print $3}')   # ==> go1.23.8
#     echo "# Go: go${CODEX_ENV_GO_VERSION} (default: ${current})"
#     if [ "${current}" != "go${CODEX_ENV_GO_VERSION}" ]; then
#         go install "golang.org/dl/go${CODEX_ENV_GO_VERSION}@latest"
#         "go${CODEX_ENV_GO_VERSION}" download
#         # Place new go first in PATH
#         echo "export PATH=$("go${CODEX_ENV_GO_VERSION}" env GOROOT)/bin:\$PATH" >> /etc/profile
#         # Pre-install common linters/formatters
#         golangci-lint --version # Already installed in base image, save us some bootup time
#     fi
# fi

# if [ -n "${CODEX_ENV_SWIFT_VERSION}" ]; then
#     current=$(swift --version | awk -F'version ' '{print $2}' | awk '{print $1}')   # ==> 6.1
#     echo "# Swift: ${CODEX_ENV_SWIFT_VERSION} (default: ${current})"
#     if [ "${current}" != "${CODEX_ENV_SWIFT_VERSION}" ]; then
#         swiftly install --use "${CODEX_ENV_SWIFT_VERSION}"
#     fi
# fi

# Source NVM and install Claude Code
echo "Installing Claude Code..."
source /root/.nvm/nvm.sh

# S'assurer que nous utilisons la bonne version de Node
if [ -n "${CODEX_ENV_NODE_VERSION}" ]; then
    nvm use "${CODEX_ENV_NODE_VERSION}"
fi

npm install -g @anthropic-ai/claude-code
npm install -g @google/gemini-cli
# Configure Claude Code with proper settings
mkdir -p /root/.claude

# Create settings.local.json with proper configuration
cat > /root/.claude/settings.json << EOF
{
  "permissions": {
    "allow": [
      "Bash(*)",
      "Edit(*)", 
      "MultiEdit(*)",
      "Write(*)",
      "Read(*)",
      "WebFetch(*)",
      "Glob(*)",
      "Grep(*)",
      "LS(*)",
      "NotebookEdit(*)",
      "NotebookRead(*)",
      "Task(*)",
      "TodoWrite(*)",
      "WebSearch(*)",
      "mcp(*)"
    ],
    "defaultMode": "acceptEdits"
  },
  "includeCoAuthoredBy": false,
  "cleanupPeriodDays": 7
}
EOF

echo "Claude Code installed and configured with full permissions"

# S'assurer que tous les outils sont dans le PATH pour les connexions interactives
echo 'source /etc/profile' >> /root/.bashrc

# Forcer le rechargement du profile pour la session courante
source /etc/profile

echo "Environment ready. Dropping you into a bash shell."

# Si des arguments sont passés, les exécuter, sinon garder le conteneur actif
if [ $# -eq 0 ]; then
    # Pas d'arguments, garder le conteneur actif
    exec tail -f /dev/null
else
    # Exécuter les arguments passés
    exec "$@"
fi
