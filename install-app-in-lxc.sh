#!/bin/bash

# Installation de StereoTool Processor dans LXC Debian
# Usage: ./install-app-in-lxc.sh <CTID>

set -e

CTID=${1:-200}
APP_USER="stereoapp"
APP_DIR="/opt/stereo-tool-processor"
DB_NAME="stereo_tool_app"
DB_USER="stereo_user"
DB_PASS="StereoTool2024!SecureDB"

echo "🚀 Installation de StereoTool Processor dans le container LXC $CTID"

# Fonction pour exécuter des commandes dans le container
lxc_exec() {
    pct exec $CTID -- bash -c "$1"
}

echo "📦 Installation des dépendances système..."

# Installation Node.js 18.x
lxc_exec "
curl -fsSL https://deb.nodesource.com/setup_18.x | bash -
apt install -y nodejs
"

# Installation MySQL
lxc_exec "
DEBIAN_FRONTEND=noninteractive apt install -y mysql-server
systemctl enable mysql
systemctl start mysql
"

# Installation FFmpeg et autres dépendances
lxc_exec "
apt install -y ffmpeg build-essential python3 make g++ libnss3-dev libatk-bridge2.0-dev libgtk-3-dev libgconf-2-4 libxss1 libasound2-dev
"

# Installation PM2 globalement
lxc_exec "npm install -g pm2"

echo "👤 Création de l'utilisateur application..."

lxc_exec "
useradd -m -s /bin/bash $APP_USER
usermod -aG sudo $APP_USER
mkdir -p $APP_DIR
chown $APP_USER:$APP_USER $APP_DIR
"

echo "🗄️ Configuration de MySQL..."

lxc_exec "
mysql -e \"CREATE DATABASE $DB_NAME CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;\"
mysql -e \"CREATE USER '$DB_USER'@'localhost' IDENTIFIED BY '$DB_PASS';\"
mysql -e \"GRANT ALL PRIVILEGES ON $DB_NAME.* TO '$DB_USER'@'localhost';\"
mysql -e \"FLUSH PRIVILEGES;\"
"

echo "📁 Copie des fichiers de l'application..."

# Copier les fichiers du projet vers le container
pct push $CTID package.json $APP_DIR/package.json
pct push $CTID package-lock.json $APP_DIR/package-lock.json
pct push $CTID webpack.config.js $APP_DIR/webpack.config.js

# Copier les dossiers
pct push $CTID src/ $APP_DIR/src/ --recursive
pct push $CTID public/ $APP_DIR/public/ --recursive
pct push $CTID scripts/ $APP_DIR/scripts/ --recursive
pct push $CTID presets/ $APP_DIR/presets/ --recursive

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

# Configuration du fichier config.js
lxc_exec "
cat > $APP_DIR/config.js << 'EOF'
module.exports = {
  database: {
    host: 'localhost',
    port: 3306,
    name: '$DB_NAME',
    username: '$DB_USER',
    password: '$DB_PASS',
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
    host: '0.0.0.0'  // Écouter sur toutes les interfaces
  },

  stereoTool: {
    license: 'VOTRE_LICENCE_STEREOTOOL_ICI',
    executablePath: '$APP_DIR/stereo_tool_linux_x64'
  },

  organization: {
    name: 'Radio Cause Commune',
    adminEmail: 'admin@radiocausecommune.fr',
    domain: 'radiocausecommune.fr'
  },

  limits: {
    maxFileSize: 100 * 1024 * 1024, // 100MB
    maxFilesPerUser: 10,
    maxProcessingTime: 30 * 60 * 1000,
    rateLimitWindowMs: 15 * 60 * 1000,
    rateLimitMaxRequests: 100
  },

  paths: {
    uploads: '$APP_DIR/uploads',
    outputs: '$APP_DIR/outputs',
    temp: '$APP_DIR/temp',
    presets: '$APP_DIR/presets'
  }
};
EOF
"

# Installation des dépendances Node.js
lxc_exec "
cd $APP_DIR
sudo -u $APP_USER npm install --production
sudo -u $APP_USER npm run build
"

# Création des dossiers nécessaires
lxc_exec "
mkdir -p $APP_DIR/{uploads,outputs,temp,logs}
chown -R $APP_USER:$APP_USER $APP_DIR
"

echo "🚀 Configuration PM2..."

# Configuration PM2
lxc_exec "
cat > $APP_DIR/ecosystem.config.js << 'EOF'
module.exports = {
  apps: [{
    name: 'stereo-tool-processor',
    script: 'src/server/index-secure.js',
    cwd: '$APP_DIR',
    user: '$APP_USER',
    instances: 2,
    exec_mode: 'cluster',
    env: {
      NODE_ENV: 'production',
      PORT: 3000
    },
    log_file: '$APP_DIR/logs/combined.log',
    out_file: '$APP_DIR/logs/out.log',
    error_file: '$APP_DIR/logs/error.log',
    log_date_format: 'YYYY-MM-DD HH:mm:ss',
    max_restarts: 10,
    min_uptime: '10s',
    max_memory_restart: '500M',
    node_args: '--max-old-space-size=512'
  }]
};
EOF
"

# Démarrage de l'application avec PM2
lxc_exec "
cd $APP_DIR
sudo -u $APP_USER pm2 start ecosystem.config.js
sudo -u $APP_USER pm2 save
sudo -u $APP_USER pm2 startup systemd -u $APP_USER --hp /home/$APP_USER
"

echo "🔥 Configuration du firewall..."

lxc_exec "
ufw default deny incoming
ufw default allow outgoing
ufw allow 3000/tcp
ufw allow 22/tcp
ufw --force enable
"

echo "📝 Configuration des logs..."

lxc_exec "
cat > /etc/logrotate.d/stereo-tool << 'EOF'
$APP_DIR/logs/*.log {
    daily
    missingok
    rotate 14
    compress
    notifempty
    create 0644 $APP_USER $APP_USER
    postrotate
        sudo -u $APP_USER pm2 reloadLogs
    endscript
}
EOF
"

echo "✅ Installation terminée !"
echo ""
echo "🎯 Application accessible sur: http://10.10.10.50:3000"
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