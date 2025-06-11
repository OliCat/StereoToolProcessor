#!/bin/bash

# Script pour mettre à jour la configuration dans le LXC existant
# Usage: ./scripts/update-config-lxc.sh

set -e

# Variables
LXC_NAME="stereo-tool-lxc"
APP_DIR="/opt/stereo-tool-processor"

echo "🔧 Mise à jour de la configuration pour les gros fichiers..."

# Fonction pour exécuter des commandes dans le LXC
lxc_exec() {
    lxc exec "$LXC_NAME" -- bash -c "$1"
}

# Vérifier que le conteneur existe et fonctionne
if ! lxc list | grep -q "$LXC_NAME.*RUNNING"; then
    echo "❌ Le conteneur $LXC_NAME n'est pas en cours d'exécution"
    exit 1
fi

echo "📝 Génération de la nouvelle configuration..."

# Créer le nouveau fichier config.js avec les bonnes limites
cat > /tmp/config_updated.js << 'EOF'
module.exports = {
  database: {
    host: '127.0.0.1',
    port: 3306,
    name: 'stereo_tool_app',
    username: 'stereo_user',
    password: 'StereoTool2024SecureDB',
    dialect: 'mysql'
  },

  security: {
    jwtSecret: 'StereoToolJWT2024!UltraSecure789XyZ',
    sessionSecret: 'StereoSession2024!TresLongSecret456ABC',
    passwordSaltRounds: 12
  },

  server: {
    port: 3000,
    environment: 'production',
    host: '0.0.0.0'
  },

  stereoTool: {
    license: 'VOTRE_LICENCE_STEREOTOOL_ICI',
    executablePath: '/opt/stereo-tool-processor/stereo_tool_linux_x64'
  },

  organization: {
    name: 'Radio Cause Commune',
    adminEmail: 'admin@radiocausecommune.fr',
    domain: 'radiocausecommune.fr'
  },

  limits: {
    maxFileSize: 2 * 1024 * 1024 * 1024, // 2GB pour les gros fichiers audio
    maxFilesPerUser: 10,
    maxProcessingTime: 120 * 60 * 1000, // 2 heures pour les gros fichiers
    rateLimitWindowMs: 15 * 60 * 1000,
    rateLimitMaxRequests: 100,
    
    // Nouveaux paramètres pour les gros fichiers
    uploadTimeout: 30 * 60 * 1000, // 30 minutes pour l'upload
    processingTimeout: 120 * 60 * 1000, // 2 heures pour le traitement
    largeFileThreshold: 100 * 1024 * 1024, // 100MB = considéré comme gros fichier
    maxConcurrentUploads: 3
  },

  paths: {
    uploads: '/opt/stereo-tool-processor/uploads',
    outputs: '/opt/stereo-tool-processor/outputs',
    temp: '/opt/stereo-tool-processor/temp',
    presets: '/opt/stereo-tool-processor/presets'
  }
};
EOF

echo "🔄 Sauvegarde de la configuration actuelle..."
lxc_exec "cp $APP_DIR/config.js $APP_DIR/config.js.backup-$(date +%Y%m%d-%H%M%S)"

echo "📤 Upload de la nouvelle configuration..."
pct push "$LXC_NAME" /tmp/config_updated.js "$APP_DIR/config.js"
rm /tmp/config_updated.js

echo "🔧 Ajustement des permissions..."
lxc_exec "chown stereoapp:stereoapp $APP_DIR/config.js"

echo "🔄 Redémarrage de l'application..."
lxc_exec "sudo -u stereoapp pm2 restart stereo-tool-processor"

echo "⏳ Attente du redémarrage..."
sleep 5

echo "📊 Vérification du statut..."
lxc_exec "sudo -u stereoapp pm2 status"

echo ""
echo "✅ Configuration mise à jour avec succès !"
echo ""
echo "📋 Nouvelles limites appliquées :"
echo "   - Taille maximale des fichiers : 2GB"
echo "   - Timeout upload : 30 minutes"
echo "   - Timeout traitement : 2 heures"
echo "   - Seuil gros fichier : 100MB"
echo ""
echo "🌐 Testez maintenant avec votre fichier de 1278MB !"
echo ""
echo "🔍 Pour vérifier les logs :"
echo "   lxc exec $LXC_NAME -- sudo -u stereoapp pm2 logs stereo-tool-processor" 