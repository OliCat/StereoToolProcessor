#!/bin/bash

# Script pour mettre à jour la configuration dans le LXC existant
# Usage: ./scripts/update-config-lxc.sh [nom_ou_id_lxc]
# Exemple: ./scripts/update-config-lxc.sh 101
# Exemple: ./scripts/update-config-lxc.sh mon-lxc-stereo

set -e

# Variables
LXC_NAME="${1:-stereo-tool-lxc}"  # Utiliser le paramètre ou valeur par défaut
APP_DIR="/opt/stereo-tool-processor"

echo "🔧 Mise à jour de la configuration pour les gros fichiers..."
echo "📋 Conteneur LXC: $LXC_NAME"

# Auto-détection si aucun paramètre fourni
if [ "$#" -eq 0 ]; then
    echo "🔍 Aucun conteneur spécifié, recherche automatique..."
    
    # Chercher un conteneur qui contient "stereo" dans le nom ou qui a l'app
    POSSIBLE_CONTAINERS=$(lxc list --format csv -c n,s | grep "RUNNING" | cut -d, -f1)
    
    for container in $POSSIBLE_CONTAINERS; do
        if lxc exec "$container" -- bash -c "[ -d '$APP_DIR' ]" 2>/dev/null; then
            LXC_NAME="$container"
            echo "✅ Conteneur détecté automatiquement: $LXC_NAME"
            break
        fi
    done
    
    if [ "$LXC_NAME" = "stereo-tool-lxc" ]; then
        echo "❌ Aucun conteneur avec StereoTool trouvé automatiquement"
        echo "💡 Spécifiez le nom ou ID de votre conteneur:"
        echo "   Exemple: ./scripts/update-config-lxc.sh 101"
        echo "   Exemple: ./scripts/update-config-lxc.sh mon-conteneur"
        echo ""
        echo "📋 Conteneurs disponibles:"
        lxc list --format table -c n,s,4
        exit 1
    fi
fi

# Fonction pour exécuter des commandes dans le LXC
lxc_exec() {
    lxc exec "$LXC_NAME" -- bash -c "$1"
}

# Vérifier que le conteneur existe et fonctionne
if ! lxc list | grep -q "$LXC_NAME.*RUNNING"; then
    echo "❌ Le conteneur $LXC_NAME n'est pas en cours d'exécution"
    echo ""
    echo "📋 Conteneurs disponibles:"
    lxc list --format table -c n,s,4
    exit 1
fi

# Vérifier que l'application existe dans ce conteneur
if ! lxc_exec "[ -d '$APP_DIR' ]" 2>/dev/null; then
    echo "❌ L'application StereoTool n'est pas trouvée dans $LXC_NAME"
    echo "   Chemin recherché: $APP_DIR"
    exit 1
fi

echo "✅ Conteneur $LXC_NAME trouvé et application détectée"

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
echo "🔍 Commandes utiles :"
echo "   # Logs:"
echo "   lxc exec $LXC_NAME -- sudo -u stereoapp pm2 logs stereo-tool-processor"
echo ""
echo "   # Status:"
echo "   lxc exec $LXC_NAME -- sudo -u stereoapp pm2 status"
echo ""
echo "   # Redémarrer si besoin:"
echo "   lxc exec $LXC_NAME -- sudo -u stereoapp pm2 restart stereo-tool-processor" 