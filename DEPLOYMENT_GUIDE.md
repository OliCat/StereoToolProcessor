# Guide de Déploiement Sécurisé - StereoTool Processor
## Radio Cause Commune

Ce guide détaille les étapes pour déployer votre application StereoTool de manière sécurisée pour les équipes de Radio Cause Commune.

## 🔧 Prérequis

### Serveur
- **OS**: Ubuntu 20.04 LTS ou plus récent
- **RAM**: Minimum 4GB (8GB recommandé)
- **Stockage**: Minimum 50GB SSD
- **CPU**: 2 cores minimum (4 cores recommandé)
- **Réseau**: Connexion stable avec IP publique

### Logiciels
- Node.js 18.x ou plus récent
- MySQL 8.0 ou plus récent
- Nginx (pour le reverse proxy)
- Certbot (pour SSL/TLS)
- PM2 (pour la gestion des processus)

## 📋 Installation Étape par Étape

### 1. Préparation du Serveur

```bash
# Mettre à jour le système
sudo apt update && sudo apt upgrade -y

# Installer les dépendances système
sudo apt install -y curl wget git build-essential

# Installer Node.js 18.x
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt install -y nodejs

# Vérifier l'installation
node --version
npm --version
```

### 2. Installation de MySQL

```bash
# Installer MySQL
sudo apt install -y mysql-server

# Sécuriser l'installation
sudo mysql_secure_installation

# Se connecter à MySQL
sudo mysql -u root -p

# Créer la base de données et l'utilisateur
CREATE DATABASE stereo_tool_app CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
CREATE USER 'stereo_user'@'localhost' IDENTIFIED BY 'VotrMotDePasseSecurise123!';
GRANT ALL PRIVILEGES ON stereo_tool_app.* TO 'stereo_user'@'localhost';
FLUSH PRIVILEGES;
EXIT;
```

### 3. Configuration de l'Application

```bash
# Cloner le repository (ou transférer les fichiers)
git clone <votre-repo> /var/www/stereo-tool-processor
cd /var/www/stereo-tool-processor

# Installer les dépendances
npm install

# Copier et configurer le fichier de configuration
cp config.example.js config.js
nano config.js
```

### 4. Configuration du Fichier config.js

```javascript
// config.js
module.exports = {
  database: {
    host: 'localhost',
    port: 3306,
    name: 'stereo_tool_app',
    username: 'stereo_user',
    password: 'VotrMotDePasseSecurise123!', // Changez ceci
    dialect: 'mysql'
  },

  security: {
    jwtSecret: 'VotreJWTSecretUltraSecurise789!', // Générez une clé unique
    sessionSecret: 'VotreSessionSecretTresLong456!', // Générez une clé unique
    passwordSaltRounds: 12
  },

  server: {
    port: 3000,
    environment: 'production',
    httpsKeyPath: '/etc/letsencrypt/live/stereo.radiocausecommune.fr/privkey.pem',
    httpsCertPath: '/etc/letsencrypt/live/stereo.radiocausecommune.fr/fullchain.pem'
  },

  stereoTool: {
    license: 'VotreLicenceStereoTool', // Votre licence StereoTool
    executablePath: './stereo_tool_mac' // Adaptez selon votre OS
  },

  organization: {
    name: 'Radio Cause Commune',
    adminEmail: 'admin@radiocausecommune.fr',
    domain: 'radiocausecommune.fr' // Seuls les emails @radiocausecommune.fr seront acceptés
  },

  limits: {
    maxFileSize: 100 * 1024 * 1024, // 100MB
    maxFilesPerUser: 10,
    maxProcessingTime: 30 * 60 * 1000,
    rateLimitWindowMs: 15 * 60 * 1000,
    rateLimitMaxRequests: 100
  }
};
```

### 5. Installation et Configuration de Nginx

```bash
# Installer Nginx
sudo apt install -y nginx

# Créer la configuration du site
sudo nano /etc/nginx/sites-available/stereo-tool
```

```nginx
# /etc/nginx/sites-available/stereo-tool
server {
    listen 80;
    server_name stereo.radiocausecommune.fr;
    return 301 https://$server_name$request_uri;
}

server {
    listen 443 ssl http2;
    server_name stereo.radiocausecommune.fr;

    ssl_certificate /etc/letsencrypt/live/stereo.radiocausecommune.fr/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/stereo.radiocausecommune.fr/privkey.pem;

    # Configuration SSL moderne
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers ECDHE-RSA-AES256-GCM-SHA512:DHE-RSA-AES256-GCM-SHA512:ECDHE-RSA-AES256-GCM-SHA384:DHE-RSA-AES256-GCM-SHA384;
    ssl_prefer_server_ciphers off;
    ssl_session_cache shared:SSL:10m;
    ssl_session_timeout 10m;

    # En-têtes de sécurité
    add_header Strict-Transport-Security "max-age=31536000; includeSubDomains" always;
    add_header X-Frame-Options DENY always;
    add_header X-Content-Type-Options nosniff always;
    add_header X-XSS-Protection "1; mode=block" always;
    add_header Referrer-Policy "strict-origin-when-cross-origin" always;

    # Limite de taille des fichiers
    client_max_body_size 150M;

    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
        proxy_read_timeout 300s;
        proxy_connect_timeout 75s;
    }

    # Protection contre les bots
    location /api/ {
        limit_req zone=api burst=20 nodelay;
        proxy_pass http://localhost:3000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}

# Rate limiting
http {
    limit_req_zone $binary_remote_addr zone=api:10m rate=10r/m;
}
```

```bash
# Activer le site
sudo ln -s /etc/nginx/sites-available/stereo-tool /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl reload nginx
```

### 6. Configuration SSL avec Let's Encrypt

```bash
# Installer Certbot
sudo apt install -y certbot python3-certbot-nginx

# Obtenir le certificat SSL
sudo certbot --nginx -d stereo.radiocausecommune.fr

# Vérifier le renouvellement automatique
sudo crontab -e
# Ajouter cette ligne :
0 2 * * * /usr/bin/certbot renew --quiet
```

### 7. Configuration de PM2 pour la Gestion des Processus

```bash
# Installer PM2 globalement
sudo npm install -g pm2

# Créer le fichier de configuration PM2
nano ecosystem.config.js
```

```javascript
// ecosystem.config.js
module.exports = {
  apps: [{
    name: 'stereo-tool-processor',
    script: 'src/server/index-secure.js',
    instances: 2, // Nombre d'instances (adaptez selon votre CPU)
    exec_mode: 'cluster',
    watch: false,
    max_memory_restart: '1G',
    env: {
      NODE_ENV: 'production',
      PORT: 3000
    },
    error_file: './logs/err.log',
    out_file: './logs/out.log',
    log_file: './logs/combined.log',
    time: true
  }]
};
```

```bash
# Créer le dossier des logs
mkdir -p logs

# Démarrer l'application avec PM2
pm2 start ecosystem.config.js

# Sauvegarder la configuration PM2
pm2 save

# Configurer PM2 pour démarrer automatiquement
pm2 startup
# Suivre les instructions affichées
```

### 8. Configuration du Firewall

```bash
# Installer et configurer UFW
sudo ufw enable
sudo ufw default deny incoming
sudo ufw default allow outgoing

# Autoriser les ports nécessaires
sudo ufw allow ssh
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp

# Vérifier le statut
sudo ufw status
```

### 9. Configuration des Permissions et Sécurité

```bash
# Créer un utilisateur dédié pour l'application
sudo adduser stereo-app
sudo usermod -aG sudo stereo-app

# Changer la propriété des fichiers
sudo chown -R stereo-app:stereo-app /var/www/stereo-tool-processor

# Définir les permissions appropriées
chmod 755 /var/www/stereo-tool-processor
chmod 644 /var/www/stereo-tool-processor/config.js
chmod +x /var/www/stereo-tool-processor/stereo_tool_mac

# Créer les dossiers de travail avec les bonnes permissions
mkdir -p uploads outputs presets temp logs
chmod 755 uploads outputs presets temp logs
```

### 10. Tests et Validation

```bash
# Tester l'application
cd /var/www/stereo-tool-processor
npm test # Si vous avez des tests

# Vérifier les logs
pm2 logs stereo-tool-processor

# Tester la connectivité
curl -k https://stereo.radiocausecommune.fr/api/auth/login

# Vérifier la base de données
mysql -u stereo_user -p stereo_tool_app -e "SHOW TABLES;"
```

## 🔐 Configuration de Sécurité Avancée

### Fail2Ban pour la Protection contre les Attaques

```bash
# Installer Fail2Ban
sudo apt install -y fail2ban

# Configurer Fail2Ban pour Nginx
sudo nano /etc/fail2ban/jail.local
```

```ini
[DEFAULT]
bantime = 3600
findtime = 600
maxretry = 5

[nginx-http-auth]
enabled = true
filter = nginx-http-auth
logpath = /var/log/nginx/error.log

[nginx-limit-req]
enabled = true
filter = nginx-limit-req
logpath = /var/log/nginx/error.log
maxretry = 10
```

### Surveillance et Monitoring

```bash
# Installer htop pour le monitoring système
sudo apt install -y htop

# Configurer la rotation des logs
sudo nano /etc/logrotate.d/stereo-tool
```

```
/var/www/stereo-tool-processor/logs/*.log {
    daily
    missingok
    rotate 14
    compress
    delaycompress
    notifempty
    copytruncate
}
```

## 🚀 Premier Démarrage et Configuration Initiale

### 1. Démarrage de l'Application

```bash
# Construire l'application
npm run build

# Démarrer avec PM2
pm2 start ecosystem.config.js

# Vérifier le statut
pm2 status
```

### 2. Connexion Administrateur

1. Ouvrez votre navigateur et allez sur `https://stereo.radiocausecommune.fr`
2. Connectez-vous avec :
   - **Email**: `admin@radiocausecommune.fr`
   - **Mot de passe**: `AdminPassword123!`
3. **IMPORTANT**: Changez immédiatement le mot de passe admin

### 3. Création des Premiers Utilisateurs

1. Connectez-vous en tant qu'administrateur
2. Accédez à la section "Gestion des utilisateurs"
3. Créez des comptes pour votre équipe avec des emails `@radiocausecommune.fr`

## 📊 Maintenance et Surveillance

### Commandes de Maintenance Quotidienne

```bash
# Vérifier le statut de l'application
pm2 status

# Voir les logs en temps réel
pm2 logs stereo-tool-processor --lines 50

# Redémarrer l'application si nécessaire
pm2 restart stereo-tool-processor

# Vérifier l'espace disque
df -h

# Vérifier l'utilisation de la RAM
free -h

# Nettoyer les anciens fichiers (à automatiser)
find /var/www/stereo-tool-processor/uploads -type f -mtime +7 -delete
find /var/www/stereo-tool-processor/outputs -type f -mtime +7 -delete
```

### Script de Sauvegarde Automatique

```bash
# Créer un script de sauvegarde
sudo nano /usr/local/bin/backup-stereo-tool.sh
```

```bash
#!/bin/bash
BACKUP_DIR="/var/backups/stereo-tool"
DATE=$(date +%Y%m%d_%H%M%S)

mkdir -p $BACKUP_DIR

# Sauvegarde de la base de données
mysqldump -u stereo_user -p'VotrMotDePasseSecurise123!' stereo_tool_app > $BACKUP_DIR/db_backup_$DATE.sql

# Sauvegarde des fichiers de configuration
tar -czf $BACKUP_DIR/config_backup_$DATE.tar.gz /var/www/stereo-tool-processor/config.js

# Nettoyer les anciennes sauvegardes (garder 7 jours)
find $BACKUP_DIR -type f -mtime +7 -delete

echo "Sauvegarde terminée : $DATE"
```

```bash
# Rendre le script exécutable
sudo chmod +x /usr/local/bin/backup-stereo-tool.sh

# Programmer la sauvegarde quotidienne
sudo crontab -e
# Ajouter cette ligne pour une sauvegarde quotidienne à 2h du matin :
0 2 * * * /usr/local/bin/backup-stereo-tool.sh
```

## 🆘 Dépannage

### Problèmes Courants

1. **L'application ne démarre pas**
   ```bash
   pm2 logs stereo-tool-processor
   # Vérifier les erreurs dans les logs
   ```

2. **Erreur de connexion à la base de données**
   ```bash
   mysql -u stereo_user -p stereo_tool_app
   # Tester la connexion manuellement
   ```

3. **Problèmes de certificats SSL**
   ```bash
   sudo certbot certificates
   sudo certbot renew --dry-run
   ```

4. **Fichiers non traités**
   ```bash
   # Vérifier les permissions des dossiers
   ls -la uploads/ outputs/ temp/
   ```

### Contacts d'Urgence

- **Support technique**: `admin@radiocausecommune.fr`
- **Documentation**: Ce guide
- **Logs applicatifs**: `/var/www/stereo-tool-processor/logs/`
- **Logs système**: `/var/log/nginx/` et `/var/log/mysql/`

## 🎯 Sécurité et Bonnes Pratiques

1. **Mettez à jour régulièrement** le système et les dépendances
2. **Surveillez les logs** pour détecter les tentatives d'intrusion
3. **Changez les mots de passe** régulièrement
4. **Sauvegardez** quotidiennement la base de données
5. **Testez** régulièrement la procédure de restauration
6. **Limitez l'accès** aux seuls membres autorisés de Radio Cause Commune

---

**Installation terminée !** Votre application StereoTool est maintenant sécurisée et prête pour les équipes de Radio Cause Commune. 🎵🔒 