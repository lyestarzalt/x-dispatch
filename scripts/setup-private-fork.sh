#!/usr/bin/env bash
# Publie ce dépôt sur un fork privé GitHub (nouveau projet sous votre compte).
# Prérequis : gh auth login (compte GitHub personnel)
set -euo pipefail

ORIGINAL_OWNER="lyestarzalt"
ORIGINAL_REPO="x-dispatch"
ORIGINAL="${ORIGINAL_OWNER}/${ORIGINAL_REPO}"

echo "→ Dépôt original : https://github.com/${ORIGINAL}"

if ! gh auth status >/dev/null 2>&1; then
  echo "Connectez-vous d'abord : gh auth login"
  exit 1
fi

GH_USER=$(gh api user -q .login)
echo "→ Compte GitHub : ${GH_USER}"

read -r -p "Nom du nouveau repo [${ORIGINAL_REPO}]: " REPO_NAME
REPO_NAME=${REPO_NAME:-${ORIGINAL_REPO}}

read -r -p "Repo privé ? [O/n]: " PRIVATE_ANS
PRIVATE_ANS=${PRIVATE_ANS:-O}
if [[ "${PRIVATE_ANS}" =~ ^[OoYy] ]]; then
  PRIVATE_FLAG="--private"
else
  PRIVATE_FLAG="--public"
fi

FORK_URL="https://github.com/${GH_USER}/${REPO_NAME}.git"

if gh repo view "${GH_USER}/${REPO_NAME}" >/dev/null 2>&1; then
  echo "→ Le repo ${GH_USER}/${REPO_NAME} existe déjà."
else
  echo "→ Création du fork privé depuis ${ORIGINAL}…"
  gh repo fork "${ORIGINAL}" --fork-name "${REPO_NAME}" ${PRIVATE_FLAG} --remote=false
fi

if git remote | grep -q '^upstream$'; then
  git remote set-url upstream "https://github.com/${ORIGINAL}.git"
else
  git remote add upstream "https://github.com/${ORIGINAL}.git"
fi

if git remote | grep -q '^origin$'; then
  git remote set-url origin "${FORK_URL}"
else
  git remote add origin "${FORK_URL}"
fi

echo ""
echo "Remotes :"
git remote -v
echo ""
echo "Prochaines étapes :"
echo "  git add -A && git commit -m 'feat(sia): VAC offline, OACI, téléchargement SIA'"
echo "  git push -u origin main"
echo ""
echo "Release privée (optionnel) :"
echo "  gh workflow run release.yml -f version=patch"
