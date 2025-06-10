#!/bin/bash

# Installation de StereoTool Processor dans LXC Debian
# Usage: ./install-app-in-lxc.sh <CTID> [--clean]

set -e

CTID=${1:-200}
CLEAN_INSTALL=${2}
APP_USER="stereoapp"
APP_DIR="/opt/stereo-tool-processor"
DB_NAME="stereo_tool_app"
DB_USER="stereo_user"
DB_PASS="StereoTool2024SecureDB"

echo "🚀 Installation de StereoTool Processor dans le container LXC $CTID"

# Option de nettoyage complet
if [ "$CLEAN_INSTALL" = "--clean" ]; then
    echo "🧹 Nettoyage complet demandé..."
    lxc_exec() { pct exec $CTID -- bash -c "$1"; }
    lxc_exec "sudo -u $APP_USER pm2 delete all 2>/dev/null || true"
    lxc_exec "sudo -u $APP_USER pm2 kill 2>/dev/null || true"
    lxc_exec "rm -rf $APP_DIR" || true
    lxc_exec "mysql -u root -e 'DROP DATABASE IF EXISTS $DB_NAME;'" || true
    lxc_exec "mysql -u root -e 'DROP USER IF EXISTS '$DB_USER'@'localhost';'" || true
    lxc_exec "userdel -r $APP_USER 2>/dev/null" || true
    echo "✅ Nettoyage terminé"
fi

# Fonction pour exécuter des commandes dans le container
lxc_exec() {
    pct exec $CTID -- bash -c "$1"
}

echo "📦 Installation des dépendances système..."

# Installation Node.js 18.x
lxc_exec "curl -fsSL https://deb.nodesource.com/setup_18.x | bash -"
lxc_exec "apt install -y nodejs"

# Installation MySQL/MariaDB
echo "📦 Installation de la base de données..."
lxc_exec "DEBIAN_FRONTEND=noninteractive apt install -y mariadb-server mariadb-client"
lxc_exec "systemctl enable mariadb"
lxc_exec "systemctl start mariadb"
sleep 5

# Installation FFmpeg et autres dépendances
lxc_exec "apt install -y ffmpeg build-essential python3 make g++ libnss3-dev libatk-bridge2.0-dev libgtk-3-dev libgconf-2-4 libxss1 libasound2-dev"

# Installation PM2 globalement
lxc_exec "npm install -g pm2"

echo "👤 Création de l'utilisateur application..."

# Créer l'utilisateur seulement s'il n'existe pas déjà
lxc_exec "id $APP_USER >/dev/null 2>&1 || useradd -m -s /bin/bash $APP_USER"
lxc_exec "usermod -aG sudo $APP_USER"
lxc_exec "mkdir -p $APP_DIR"
lxc_exec "chown $APP_USER:$APP_USER $APP_DIR"

echo "🗄️ Configuration de MariaDB..."

# Configuration de la base de données
lxc_exec "mysql -u root -e \"CREATE DATABASE IF NOT EXISTS $DB_NAME CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;\""
lxc_exec "mysql -u root -e \"CREATE USER IF NOT EXISTS '$DB_USER'@'localhost' IDENTIFIED BY '$DB_PASS';\""
lxc_exec "mysql -u root -e \"GRANT ALL PRIVILEGES ON $DB_NAME.* TO '$DB_USER'@'localhost';\""
lxc_exec "mysql -u root -e \"FLUSH PRIVILEGES;\""

echo "📁 Copie des fichiers de l'application..."

# Copier les fichiers du projet vers le container
pct push $CTID package.json $APP_DIR/package.json
pct push $CTID package-lock.json $APP_DIR/package-lock.json
pct push $CTID webpack.config.js $APP_DIR/webpack.config.js

# Copier les dossiers en utilisant tar
echo "📦 Copie des dossiers..."

# Liste des dossiers à copier
FOLDERS=("src" "public" "scripts" "presets")

for folder in "${FOLDERS[@]}"; do
    if [ -d "$folder" ]; then
        echo "  📁 Copie du dossier: $folder/"
        tar -czf /tmp/${folder}.tar.gz ${folder}/
        pct push $CTID /tmp/${folder}.tar.gz $APP_DIR/${folder}.tar.gz
        lxc_exec "cd $APP_DIR && tar -xzf ${folder}.tar.gz && rm ${folder}.tar.gz"
        rm -f /tmp/${folder}.tar.gz
    else
        echo "  ⚠️  Dossier non trouvé, création: $folder/"
        lxc_exec "mkdir -p $APP_DIR/$folder"
    fi
done

# Copier le binaire StereoTool (adapter selon votre plateforme)
if [ -f "stereo_tool_linux_x64" ]; then
    pct push $CTID stereo_tool_linux_x64 $APP_DIR/stereo_tool_linux_x64
    lxc_exec "chmod +x $APP_DIR/stereo_tool_linux_x64"
elif [ -f "stereo_tool_mac" ]; then
    echo "⚠️  Fichier StereoTool Mac détecté. Vous devrez fournir la version Linux."
fi

# Copier et configurer le fichier de configuration
pct push $CTID config.example.js $APP_DIR/config.js

echo "⚙️ Configuration de l'application..."

lxc_exec "chown -R $APP_USER:$APP_USER $APP_DIR"

# Configuration du fichier config.js - créer le fichier localement puis le copier
cat > /tmp/config_lxc.js << 'EOF'
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
    maxFileSize: 100 * 1024 * 1024,
    maxFilesPerUser: 10,
    maxProcessingTime: 30 * 60 * 1000,
    rateLimitWindowMs: 15 * 60 * 1000,
    rateLimitMaxRequests: 100
  },

  paths: {
    uploads: '/opt/stereo-tool-processor/uploads',
    outputs: '/opt/stereo-tool-processor/outputs',
    temp: '/opt/stereo-tool-processor/temp',
    presets: '/opt/stereo-tool-processor/presets'
  }
};
EOF

pct push $CTID /tmp/config_lxc.js $APP_DIR/config.js
rm /tmp/config_lxc.js

# Installation des dépendances Node.js
echo "📦 Installation des dépendances Node.js..."
lxc_exec "cd $APP_DIR && sudo -u $APP_USER npm install"
echo "🏗️ Build de l'application..."
lxc_exec "cd $APP_DIR && sudo -u $APP_USER npm run build"
echo "🧹 Nettoyage des devDependencies..."
lxc_exec "cd $APP_DIR && sudo -u $APP_USER npm prune --omit=dev"

# Création des dossiers nécessaires
lxc_exec "mkdir -p $APP_DIR/uploads $APP_DIR/outputs $APP_DIR/temp $APP_DIR/logs"
lxc_exec "chown -R $APP_USER:$APP_USER $APP_DIR"

echo "🚀 Configuration PM2..."

# Configuration PM2 - créer le fichier localement puis le copier
cat > /tmp/ecosystem_lxc.config.js << 'EOF'
module.exports = {
  apps: [{
    name: 'stereo-tool-processor',
    script: 'src/server/index-secure.js',
    cwd: '/opt/stereo-tool-processor',
    instances: 2,
    exec_mode: 'cluster',
    env: {
      NODE_ENV: 'production',
      PORT: 3000
    },
    log_file: '/opt/stereo-tool-processor/logs/combined.log',
    out_file: '/opt/stereo-tool-processor/logs/out.log',
    error_file: '/opt/stereo-tool-processor/logs/error.log',
    log_date_format: 'YYYY-MM-DD HH:mm:ss',
    max_restarts: 10,
    min_uptime: '10s',
    max_memory_restart: '500M',
    node_args: '--max-old-space-size=512'
  }]
};
EOF

pct push $CTID /tmp/ecosystem_lxc.config.js $APP_DIR/ecosystem.config.js
rm /tmp/ecosystem_lxc.config.js

# Démarrage de l'application avec PM2
lxc_exec "cd $APP_DIR && sudo -u $APP_USER pm2 delete stereo-tool-processor 2>/dev/null || true"
lxc_exec "cd $APP_DIR && sudo -u $APP_USER pm2 start ecosystem.config.js"
lxc_exec "sudo -u $APP_USER pm2 save"
lxc_exec "sudo -u $APP_USER pm2 startup systemd -u $APP_USER --hp /home/$APP_USER || true"

echo "🔥 Configuration du firewall..."

lxc_exec "ufw default deny incoming"
lxc_exec "ufw default allow outgoing"
lxc_exec "ufw allow 3000/tcp"
lxc_exec "ufw allow 22/tcp"
lxc_exec "ufw --force enable"

echo "📝 Configuration des logs..."

# Configuration logrotate - créer le fichier localement puis le copier
cat > /tmp/logrotate_stereo << 'EOF'
/opt/stereo-tool-processor/logs/*.log {
    daily
    missingok
    rotate 14
    compress
    notifempty
    create 0644 stereoapp stereoapp
    postrotate
        sudo -u stereoapp pm2 reloadLogs
    endscript
}
EOF

pct push $CTID /tmp/logrotate_stereo /etc/logrotate.d/stereo-tool
rm /tmp/logrotate_stereo

echo "✅ Installation terminée !"
echo ""
echo "🎯 Application accessible sur: http://10.10.10.X:3000 (remplacez X par votre IP)"
echo "👤 Utilisateur application: $APP_USER"
echo "📁 Répertoire application: $APP_DIR"
echo "🗄️ Base de données: $DB_NAME"
echo ""
echo "🔧 Commandes utiles dans le container:"
echo "   sudo -u $APP_USER pm2 status"
echo "   sudo -u $APP_USER pm2 logs"
echo "   sudo -u $APP_USER pm2 restart stereo-tool-processor"
echo ""
echo "⚠️  N'oubliez pas de:"
echo "1. Configurer votre licence StereoTool dans $APP_DIR/config.js"
echo "2. Créer le premier utilisateur admin via l'interface web"
echo "3. Configurer Nginx sur le serveur front" 