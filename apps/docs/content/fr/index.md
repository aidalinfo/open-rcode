---
seo:
  title: Documentation open-rcode
  description: Open-rcode est une plateforme open source qui permet d'exécuter Claude Code, Gemini CLI et d'autres applications agentiques depuis une interface web avec création automatique de Pull Requests GitHub.
---

::u-page-hero
---
orientation: horizontal
---
  :::prose-pre
  ---
  code: wget https://raw.githubusercontent.com/aidalinfo/open-rcode/refs/heads/dev/setup/docker-compose.yaml docker-compose.yaml && docker compose up -d
  filename: Terminal
  ---
  ```bash
  # Télécharger la configuration Docker Compose
  wget https://raw.githubusercontent.com/aidalinfo/open-rcode/refs/heads/dev/setup/docker-compose.yaml
  
  # Démarrer la plateforme open-rcode
  docker compose up -d
  ```
  :::

#title
open-rcode

#description
Plateforme open source qui permet d'exécuter Claude Code, Gemini CLI et d'autres applications agentiques depuis une interface web, créant automatiquement des Pull Requests pour vos projets.

#links
  :::u-button
  ---
  size: xl
  to: /getting-started/introduction
  trailing-icon: i-lucide-arrow-right
  ---
  Commencer
  :::

  :::u-button
  ---
  color: neutral
  icon: i-simple-icons-github
  size: xl
  target: _blank
  to: https://github.com/aidalinfo/open-rcode
  variant: subtle
  ---
  Voir sur GitHub
  :::
::

::u-page-section
#title
Plateforme de développement IA tout-en-un

#links
  :::u-button
  ---
  color: neutral
  size: lg
  target: _blank
  to: https://app.open-rcode.com
  trailingIcon: i-lucide-arrow-right
  variant: subtle
  ---
  Tester la Plateforme Beta
  :::

#features
  :::u-page-feature
  ---
  icon: i-lucide-bot
  target: _blank
  to: https://claude.ai
  ---
  #title
  Intégration Claude Code

  #description
  Exécutez les commandes Claude Code avec streaming en temps réel et création automatique de PR.
  :::

  :::u-page-feature
  ---
  icon: i-simple-icons-docker
  target: _blank
  to: https://docker.com
  ---
  #title
  Exécution Conteneurisée

  #description
  Environnement d'exécution isolé utilisant Docker ou Kubernetes pour une génération de code sécurisée.
  :::

  :::u-page-feature
  ---
  icon: i-simple-icons-github
  target: _blank
  to: https://github.com
  ---
  #title
  Intégration GitHub

  #description
  Création automatique de Pull Requests avec authentification GitHub App et support multi-dépôts.
  :::

  :::u-page-feature
  ---
  icon: i-lucide-smartphone
  target: _blank
  to: https://app.open-rcode.com
  ---
  #title
  Compatible Mobile

  #description
  Exécutez des tâches de développement depuis votre appareil mobile avec une interface web responsive.
  :::

  :::u-page-feature
  ---
  icon: i-lucide-zap
  target: _blank
  to: https://gemini.google.com
  ---
  #title
  Support Multi-IA

  #description
  Compatible avec Claude Code, Gemini CLI, et extensible pour d'autres outils agentiques.
  :::

  :::u-page-feature
  ---
  icon: i-lucide-activity
  target: _blank
  to: /getting-started/introduction
  ---
  #title
  Streaming Temps Réel

  #description
  Mises à jour en direct pendant l'exécution des tâches avec suivi détaillé des progrès.
  :::
::

::u-page-section
  :::u-page-c-t-a
  ---
  links:
    - label: Tester la Plateforme Beta
      to: https://app.open-rcode.com
      target: _blank
      icon: i-lucide-rocket
      color: neutral
    - label: Guide d'Auto-hébergement
      to: /getting-started/introduction
      trailingIcon: i-lucide-server
      color: neutral
      variant: subtle
  description: open-rcode est open source et gratuit. Testez la version beta hébergée ou auto-hébergez votre propre instance avec Docker Compose.
  title: Commencez avec open-rcode dès aujourd'hui !
  variant: subtle
  ---
  :::
::