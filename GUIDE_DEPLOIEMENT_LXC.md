# 🐧 Guide de Déploiement LXC - StereoTool Processor
## Architecture Nginx Front + LXC Backend

Ce guide détaille le déploiement de votre application StereoTool Processor dans un environnement Proxmox avec:
- **Front**: Serveur Nginx avec IP publique (SSL/TLS)
- **Backend**: Container LXC Debian avec IP privée (10.10.10.X)

## 🏗️ Architecture Cible

```
Internet ──→ [Nginx Front] ──→ [LXC Debian] ──→ [MySQL]
             IP Publique       10.10.10.50      Localhost
             SSL/TLS           Node.js App      Base de données
```

## 📋 Prérequis

### Serveur Proxmox
- Proxmox VE 7.0+
- Bridge réseau vmbr1 configuré (10.10.10.0/24)
- Templates LXC Debian disponibles
- Stockage suffisant (50GB+ par container)

### Serveur Front (Nginx)
- Ubuntu/Debian avec IP publique
- Nginx installé
- Certificat SSL (Let's Encrypt recommandé)
- Accès réseau vers 10.10.10.X

### Application
- Binaire StereoTool pour Linux x64
- Licence StereoTool valide
- Fichiers du projet StereoTool Processor

## 🚀 Étape 1: Création du Container LXC

### 1.1 Préparation des scripts

Rendez les scripts exécutables:
```bash
chmod +x deploy-lxc-setup.sh
chmod +x install-app-in-lxc.sh
chmod +x monitor-lxc-app.sh
```

### 1.2 Configuration des variables

Éditez `deploy-lxc-setup.sh` et ajustez selon votre environnement:
```bash
CTID="200"                    # ID de votre container
IP_ADDRESS="10.10.10.50"      # IP privée désirée
GATEWAY="10.10.10.1"          # Gateway de votre réseau privé
TEMPLATE="local:vztmpl/debian-12-standard_12.2-1_amd64.tar.zst"
```

### 1.3 Création du container

Depuis votre serveur Proxmox:
```bash
./deploy-lxc-setup.sh
```

Cette commande va:
- Créer le container LXC avec 4GB RAM et 4 CPU cores
- Configurer le réseau privé
- Installer les dépendances de base
- Activer le démarrage automatique

## 🔧 Étape 2: Installation de l'Application

### 2.1 Préparation du binaire StereoTool

Assurez-vous d'avoir le binaire Linux:
```bash
# Si vous avez seulement la version Mac
# Téléchargez la version Linux depuis le site StereoTool
wget https://www.stereotool.com/download/stereo_tool_linux_x64
chmod +x stereo_tool_linux_x64
```

### 2.2 Installation dans le LXC

```bash
./install-app-in-lxc.sh 200
```

Cette commande va:
- Installer Node.js 18.x, MySQL, FFmpeg
- Créer l'utilisateur `stereoapp`
- Configurer la base de données
- Copier les fichiers de l'application
- Installer les dépendances npm
- Configurer PM2 pour la gestion des processus
- Démarrer l'application

### 2.3 Configuration de la licence StereoTool

Connectez-vous au container et éditez la configuration:
```bash
pct enter 200
nano /opt/stereo-tool-processor/config.js
```

Modifiez la ligne de licence:
```javascript
stereoTool: {
  license: 'VOTRE_LICENCE_STEREOTOOL_ICI',
  executablePath: '/opt/stereo-tool-processor/stereo_tool_linux_x64'
}
```

Redémarrez l'application:
```bash
sudo -u stereoapp pm2 restart stereo-tool-processor
```

## 🌐 Étape 3: Configuration Nginx Front

### 3.1 Installation du certificat SSL

Sur votre serveur front:
```bash
# Installation de Certbot
sudo apt install certbot python3-certbot-nginx

# Obtention du certificat
sudo certbot certonly --nginx -d stereo.radiocausecommune.fr
```

### 3.2 Configuration Nginx

Copiez le fichier de configuration:
```bash
sudo cp nginx-front-config.conf /etc/nginx/sites-available/stereo-tool-app
```

Ajustez l'IP du backend dans le fichier:
```bash
sudo nano /etc/nginx/sites-available/stereo-tool-app
```

Vérifiez que l'upstream pointe vers votre LXC:
```nginx
upstream stereo_app_backend {
    server 10.10.10.50:3000 max_fails=3 fail_timeout=30s;
}
```

### 3.3 Activation de la configuration

```bash
# Créer les répertoires de cache
sudo mkdir -p /var/cache/nginx/{static,downloads}
sudo chown www-data:www-data /var/cache/nginx/{static,downloads}

# Activer le site
sudo ln -s /etc/nginx/sites-available/stereo-tool-app /etc/nginx/sites-enabled/

# Tester la configuration
sudo nginx -t

# Recharger Nginx
sudo systemctl reload nginx
```

## 📊 Étape 4: Monitoring et Maintenance

### 4.1 Surveillance de l'application

Utilisez le script de monitoring:
```bash
./monitor-lxc-app.sh 200
```

Pour un nettoyage automatique:
```bash
./monitor-lxc-app.sh 200 --cleanup
```

### 4.2 Logs et debugging

```bash
# Logs de l'application
pct exec 200 -- sudo -u stereoapp pm2 logs stereo-tool-processor

# Logs MySQL
pct exec 200 -- tail -f /var/log/mysql/error.log

# Logs Nginx (sur le serveur front)
sudo tail -f /var/log/nginx/stereo-tool-error.log
```

### 4.3 Commandes utiles

```bash
# Statut des services dans le LXC
pct exec 200 -- systemctl status mysql
pct exec 200 -- sudo -u stereoapp pm2 status

# Redémarrage de l'application
pct exec 200 -- sudo -u stereoapp pm2 restart stereo-tool-processor

# Sauvegarde de la base de données
pct exec 200 -- mysqldump -u stereo_user -pStereoTool2024!SecureDB stereo_tool_app > backup.sql
```

## 🔒 Sécurité

### 4.1 Firewall LXC

Le container est configuré avec UFW:
- Port 3000: Autorisé (application)
- Port 22: Autorisé (SSH)
- Tout le reste: Bloqué

### 4.2 Sécurité réseau

- Application accessible uniquement depuis le réseau privé
- Nginx front avec rate limiting
- Headers de sécurité configurés
- SSL/TLS avec certificats Let's Encrypt

### 4.3 Sauvegardes recommandées

```bash
# Arrêt propre pour sauvegarde
pct exec 200 -- sudo -u stereoapp pm2 stop stereo-tool-processor
pct exec 200 -- systemctl stop mysql

# Snapshot du container
vzdump 200 --mode snapshot --storage local

# Redémarrage
pct exec 200 -- systemctl start mysql
pct exec 200 -- sudo -u stereoapp pm2 start stereo-tool-processor
```

## 🚦 Tests de Validation

### 5.1 Tests de connectivité

```bash
# Test depuis le serveur front vers le LXC
curl -I http://10.10.10.50:3000/health

# Test de l'interface web complète
curl -I https://stereo.radiocausecommune.fr/
```

### 5.2 Test de traitement

1. Accédez à https://stereo.radiocausecommune.fr/
2. Créez un compte administrateur
3. Uploadez un fichier audio de test
4. Vérifiez le traitement et le téléchargement

## 📈 Optimisations Production

### 6.1 Performance

```bash
# Augmentation des ressources si nécessaire
pct set 200 --memory 8192 --cores 8

# Optimisation MySQL
pct exec 200 -- mysql -e "SET GLOBAL innodb_buffer_pool_size=2G;"
```

### 6.2 Surveillance automatique

Ajoutez une tâche cron pour le monitoring:
```bash
# Surveillance toutes les 5 minutes
*/5 * * * * /path/to/monitor-lxc-app.sh 200 >/dev/null 2>&1
```

## 🆘 Dépannage

### Problèmes courants

1. **Application inaccessible**
   - Vérifiez PM2: `pct exec 200 -- sudo -u stereoapp pm2 status`
   - Vérifiez le port: `pct exec 200 -- netstat -tlnp | grep 3000`

2. **Erreur base de données**
   - Vérifiez MySQL: `pct exec 200 -- systemctl status mysql`
   - Testez la connexion: `pct exec 200 -- mysql -u stereo_user -p`

3. **Nginx 502 Bad Gateway**
   - Vérifiez la connectivité réseau: `ping 10.10.10.50`
   - Vérifiez les logs Nginx: `tail -f /var/log/nginx/stereo-tool-error.log`

### Support

- Logs détaillés disponibles dans `/opt/stereo-tool-processor/logs/`
- Configuration dans `/opt/stereo-tool-processor/config.js`
- Base de données: `stereo_tool_app` sur localhost

## ✅ Checklist de Déploiement

- [ ] Container LXC créé et configuré
- [ ] Application installée et fonctionnelle
- [ ] Base de données configurée
- [ ] Licence StereoTool activée
- [ ] Nginx front configuré avec SSL
- [ ] Tests de connectivité réussis
- [ ] Monitoring en place
- [ ] Sauvegardes configurées
- [ ] Premier utilisateur admin créé

Votre application StereoTool Processor est maintenant prête pour la production ! 🎉 