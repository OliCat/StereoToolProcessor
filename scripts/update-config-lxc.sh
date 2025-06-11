#!/bin/bash

# Script pour mettre à jour la configuration dans le conteneur LXC Proxmox
# Usage: ./scripts/update-config-lxc.sh [id_conteneur]
# Exemple: ./scripts/update-config-lxc.sh 101
# Compatible avec Proxmox (pct)

set -e

# Variables
CTID="${1:-}"  # ID du conteneur Proxmox
APP_DIR="/opt/stereo-tool-processor"

echo "🔧 Mise à jour de la configuration pour les gros fichiers..."

# Auto-détection si aucun paramètre fourni
if [ "$#" -eq 0 ]; then
    echo "🔍 Aucun conteneur spécifié, recherche automatique..."
    
    # Chercher un conteneur qui a l'application StereoTool
    POSSIBLE_CONTAINERS=$(pct list | awk 'NR>1 && $2=="running" {print $1}')
    
    for container in $POSSIBLE_CONTAINERS; do
        if pct exec "$container" -- bash -c "[ -d '$APP_DIR' ]" 2>/dev/null; then
            CTID="$container"
            echo "✅ Conteneur détecté automatiquement: $CTID"
            break
        fi
    done
    
    if [ -z "$CTID" ]; then
        echo "❌ Aucun conteneur avec StereoTool trouvé automatiquement"
        echo "💡 Spécifiez l'ID de votre conteneur:"
        echo "   Exemple: ./scripts/update-config-lxc.sh 101"
        echo ""
        echo "📋 Conteneurs disponibles:"
        pct list
        exit 1
    fi
else
    echo "📋 Conteneur LXC: $CTID"
fi

# Fonction pour exécuter des commandes dans le conteneur
pct_exec() {
    pct exec "$CTID" -- bash -c "$1"
}

# Vérifier que le conteneur existe et fonctionne
CT_STATUS=$(pct status "$CTID" 2>/dev/null | grep -o "running" || echo "stopped")
if [ "$CT_STATUS" != "running" ]; then
    echo "❌ Le conteneur $CTID n'est pas en cours d'exécution (statut: $CT_STATUS)"
    echo ""
    echo "📋 Conteneurs disponibles:"
    pct list
    exit 1
fi

# Vérifier que l'application existe dans ce conteneur
if ! pct_exec "[ -d '$APP_DIR' ]" 2>/dev/null; then
    echo "❌ L'application StereoTool n'est pas trouvée dans le conteneur $CTID"
    echo "   Chemin recherché: $APP_DIR"
    exit 1
fi

echo "✅ Conteneur $CTID trouvé et application détectée"

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
pct_exec "cp $APP_DIR/config.js $APP_DIR/config.js.backup-$(date +%Y%m%d-%H%M%S)"

echo "📤 Upload de la nouvelle configuration..."
pct push "$CTID" /tmp/config_updated.js "$APP_DIR/config.js"
rm /tmp/config_updated.js

echo "🔧 Ajustement des permissions..."
pct_exec "chown stereoapp:stereoapp $APP_DIR/config.js"

echo "🔄 Redémarrage de l'application..."
pct_exec "sudo -u stereoapp pm2 restart stereo-tool-processor"

echo "⏳ Attente du redémarrage..."
sleep 5

echo "📊 Vérification du statut..."
pct_exec "sudo -u stereoapp pm2 status"

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
echo "🔍 Commandes utiles :"
echo "   # Logs:"
echo "   pct exec $CTID -- sudo -u stereoapp pm2 logs stereo-tool-processor"
echo ""
echo "   # Status:"
echo "   pct exec $CTID -- sudo -u stereoapp pm2 status"
echo ""
echo "   # Redémarrer si besoin:"
echo "   pct exec $CTID -- sudo -u stereoapp pm2 restart stereo-tool-processor" 