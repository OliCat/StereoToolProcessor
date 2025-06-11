#!/bin/bash

# Script pour redémarrer l'application en production avec les nouvelles configurations
# Usage: ./scripts/restart-production.sh

set -e

echo "🔄 Redémarrage de l'application StereoTool Processor..."

# Variables
LXC_NAME="stereo-tool-lxc"
APP_DIR="/opt/stereo-tool-processor"

# Fonction pour exécuter des commandes dans le LXC
lxc_exec() {
    lxc exec "$LXC_NAME" -- bash -c "$1"
}

echo "📋 Vérification du statut du conteneur LXC..."
if ! lxc list | grep -q "$LXC_NAME.*RUNNING"; then
    echo "❌ Le conteneur $LXC_NAME n'est pas en cours d'exécution"
    echo "🚀 Démarrage du conteneur..."
    lxc start "$LXC_NAME"
    sleep 10
fi

echo "📦 Mise à jour de l'application..."
lxc_exec "cd $APP_DIR && git pull origin main"

echo "🔧 Installation des nouvelles dépendances..."
lxc_exec "cd $APP_DIR && npm install"

echo "🏗️ Reconstruction de l'application..."
lxc_exec "cd $APP_DIR && npm run build"

echo "🔄 Redémarrage de PM2..."
lxc_exec "pm2 restart stereo-tool-processor"

echo "📊 Vérification du statut de l'application..."
sleep 5
lxc_exec "pm2 status"

echo "🔍 Vérification des logs récents..."
lxc_exec "pm2 logs stereo-tool-processor --lines 10"

echo "🌐 Test de connectivité..."
if curl -k -s -o /dev/null -w "%{http_code}" https://stereotool.radiocausecommune.fr | grep -q "200\|302"; then
    echo "✅ Application accessible via HTTPS"
else
    echo "⚠️  Problème de connectivité détecté"
fi

echo ""
echo "✅ Redémarrage terminé !"
echo ""
echo "📋 Informations utiles :"
echo "   - URL: https://stereotool.radiocausecommune.fr"
echo "   - Logs: lxc exec $LXC_NAME -- pm2 logs stereo-tool-processor"
echo "   - Status: lxc exec $LXC_NAME -- pm2 status"
echo "   - Monitoring: lxc exec $LXC_NAME -- pm2 monit"
echo ""
echo "🔧 Nouvelles fonctionnalités :"
echo "   - Support des fichiers jusqu'à 2GB"
echo "   - Timeouts étendus pour les gros fichiers"
echo "   - Meilleurs messages d'erreur"
echo "   - Scripts CLI pour gestion des utilisateurs" 