# 🎵 StereoTool Processor Sécurisé
## Version Enterprise pour Radio Cause Commune

Une application web sécurisée pour le traitement de fichiers audio avec StereoTool, conçue spécialement pour les équipes de Radio Cause Commune.

## 🔒 Fonctionnalités de Sécurité

### Authentification et Autorisation
- **Authentification JWT** avec tokens d'accès et de rafraîchissement
- **Gestion des rôles** : Admin, Utilisateur, Invité
- **Rate limiting** pour prévenir les attaques
- **Sessions sécurisées** avec stockage en base de données
- **Restriction par domaine email** (@radiocausecommune.fr uniquement)

### Sécurité des Données
- **Chiffrement des mots de passe** avec bcrypt et salt
- **Isolation des fichiers** par utilisateur
- **Logs sécurisés** avec Winston
- **Protection CSRF** et headers de sécurité
- **Validation stricte** des types de fichiers

### Infrastructure Sécurisée
- **HTTPS/TLS** obligatoire en production
- **Reverse proxy** Nginx avec protection DDoS
- **Firewall** configuré avec UFW
- **Fail2Ban** pour la protection contre les intrusions
- **Monitoring** et alertes automatiques

## 🚀 Installation Rapide

### Prérequis
- Node.js 18+ 
- MySQL 8.0+
- Système Linux/macOS

### Installation Automatique

```bash
# Cloner le repository
git clone <votre-repo>
cd StereoToolProcessor

# Lancer l'installation interactive
./scripts/setup-secure.sh

# Ou installation automatique pour développement
./scripts/setup-secure.sh --auto
```

### Configuration Manuelle

1. **Installer les dépendances**
   ```bash
   npm install
   ```

2. **Configurer l'application**
   ```bash
   cp config.example.js config.js
   # Modifiez config.js avec vos paramètres
   ```

3. **Créer la base de données**
   ```sql
   CREATE DATABASE stereo_tool_app;
   CREATE USER 'stereo_user'@'localhost' IDENTIFIED BY 'VotreMotDePasse';
   GRANT ALL PRIVILEGES ON stereo_tool_app.* TO 'stereo_user'@'localhost';
   ```

4. **Construire et démarrer**
   ```bash
   npm run build
   npm start
   ```

## 📋 Configuration

### Fichier de Configuration Principal

Le fichier `config.js` contient tous les paramètres de l'application :

```javascript
module.exports = {
  // Base de données
  database: {
    host: 'localhost',
    name: 'stereo_tool_app',
    username: 'stereo_user',
    password: 'VotreMotDePasseSecurise'
  },
  
  // Sécurité
  security: {
    jwtSecret: 'VotreJWTSecret',
    sessionSecret: 'VotreSessionSecret'
  },
  
  // Organisation
  organization: {
    name: 'Radio Cause Commune',
    domain: 'radiocausecommune.fr'
  }
};
```

### Variables d'Environnement

Pour une sécurité maximale, utilisez les variables d'environnement :

```bash
export DB_PASSWORD="VotreMotDePasseSecurise"
export JWT_SECRET="VotreJWTSecret"
export SESSION_SECRET="VotreSessionSecret"
export STEREO_TOOL_LICENSE="VotreLicence"
```

## 👥 Gestion des Utilisateurs

### Rôles et Permissions

| Rôle | Permissions |
|------|-------------|
| **Admin** | Gestion complète des utilisateurs, accès aux statistiques, configuration système |
| **User** | Upload et traitement de fichiers, historique personnel |
| **Guest** | Accès en lecture seule, limité dans le temps |

### Création d'Utilisateurs

Seuls les administrateurs peuvent créer de nouveaux comptes :

```bash
# Première connexion admin (après installation)
Email: admin@radiocausecommune.fr
Mot de passe: AdminPassword123!
```

⚠️ **Changez immédiatement le mot de passe admin après la première connexion !**

## 🎛️ Interface d'Administration

### Tableau de Bord Admin
- **Statistiques d'utilisation** en temps réel
- **Gestion des utilisateurs** : création, désactivation, changement de rôles
- **Monitoring des processus** de traitement
- **Logs de sécurité** et d'activité

### Gestion des Fichiers
- **Quotas par utilisateur** configurables
- **Nettoyage automatique** des anciens fichiers
- **Surveillance de l'espace disque**

## 🔧 Déploiement Production

### Déploiement Rapide

Pour un déploiement complet en production, suivez le guide détaillé :

```bash
# Consulter le guide complet
cat DEPLOYMENT_GUIDE.md

# Installation production automatique
./scripts/setup-secure.sh --production
```

### Architecture de Production

```
Internet → Cloudflare/CDN → Nginx → Node.js App → MySQL
                          ↓
                       Fail2Ban
                       Firewall (UFW)
                       SSL/TLS (Let's Encrypt)
```

### Monitoring et Maintenance

- **PM2** pour la gestion des processus
- **Logs rotatifs** avec compression automatique
- **Sauvegardes automatiques** quotidiennes
- **Alertes email** en cas de problème

## 📊 API Endpoints

### Authentification
```
POST /api/auth/login          # Connexion
POST /api/auth/logout         # Déconnexion  
GET  /api/auth/profile        # Profil utilisateur
PUT  /api/auth/change-password # Changement mot de passe
```

### Traitement de Fichiers
```
POST /api/upload             # Upload et traitement
GET  /api/jobs               # Liste des tâches
GET  /api/download/:jobId    # Téléchargement résultat
```

### Administration
```
GET  /api/auth/users         # Liste utilisateurs (admin)
POST /api/auth/register      # Créer utilisateur (admin)
PUT  /api/auth/users/:id/toggle # Activer/désactiver (admin)
GET  /api/admin/stats        # Statistiques (admin)
```

## 🛡️ Sécurité Avancée

### Durcissement du Système

1. **Fail2Ban** configuré pour détecter les attaques
2. **Rate limiting** sur toutes les routes sensibles
3. **Validation stricte** de tous les inputs
4. **Logging sécurisé** de toutes les actions
5. **Chiffrement en transit** et au repos

### Surveillance

```bash
# Voir les logs en temps réel
pm2 logs stereo-tool-processor

# Vérifier les tentatives d'intrusion
sudo tail -f /var/log/fail2ban.log

# Monitoring système
htop
```

### Sauvegardes

```bash
# Sauvegarde manuelle
mysqldump -u stereo_user -p stereo_tool_app > backup.sql

# Sauvegarde automatique (configurée dans crontab)
0 2 * * * /usr/local/bin/backup-stereo-tool.sh
```

## 🆘 Support et Dépannage

### Problèmes Courants

1. **Connexion refusée**
   ```bash
   # Vérifier le statut de l'application
   pm2 status
   pm2 logs stereo-tool-processor
   ```

2. **Erreur base de données**
   ```bash
   # Tester la connexion MySQL
   mysql -u stereo_user -p stereo_tool_app
   ```

3. **Fichiers non traités**
   ```bash
   # Vérifier les permissions
   ls -la uploads/ outputs/ temp/
   ```

4. **SSL/HTTPS non fonctionnel**
   ```bash
   # Vérifier les certificats
   sudo certbot certificates
   sudo nginx -t
   ```

### Logs et Diagnostics

```bash
# Logs application
tail -f logs/combined.log
tail -f logs/error.log

# Logs système
tail -f /var/log/nginx/access.log
tail -f /var/log/nginx/error.log
tail -f /var/log/mysql/error.log
```

### Contact Support

- **Email**: admin@radiocausecommune.fr
- **Documentation**: `DEPLOYMENT_GUIDE.md`
- **Issues**: Repository GitHub (si applicable)

## 📈 Performances et Scalabilité

### Optimisations Configurées

- **Clustering** avec PM2 (multi-instances)
- **Cache** avec en-têtes HTTP appropriés
- **Compression** gzip/brotli
- **CDN-ready** pour les assets statiques

### Métriques Surveillées

- Temps de traitement des fichiers
- Utilisation CPU/RAM
- Espace disque disponible
- Nombre d'utilisateurs connectés
- Taux d'erreur des requêtes

## 🔄 Mise à Jour

### Mise à Jour de l'Application

```bash
# Sauvegarder avant mise à jour
npm run backup

# Mettre à jour le code
git pull

# Installer nouvelles dépendances
npm install

# Redémarrer l'application
pm2 restart stereo-tool-processor
```

### Mise à Jour Sécurité

```bash
# Mettre à jour le système
sudo apt update && sudo apt upgrade

# Mettre à jour Node.js si nécessaire
# Renouveler certificats SSL automatiquement
sudo certbot renew
```

## 📜 Changelog

### Version 2.0.0 - Version Sécurisée
- ✅ Authentification JWT complète
- ✅ Base de données MySQL avec ORM
- ✅ Interface d'administration
- ✅ Logs sécurisés et monitoring
- ✅ Rate limiting et protection DDoS
- ✅ Déploiement production avec HTTPS
- ✅ Guide d'installation automatisé

### Version 1.0.0 - Version Standalone
- ✅ Traitement de base StereoTool
- ✅ Interface web simple
- ✅ Upload de fichiers
- ✅ Support multi-formats

## 📝 Licence

Application développée spécifiquement pour Radio Cause Commune.
Utilisation soumise aux conditions de licence StereoTool.

---

**🎵 Radio Cause Commune - StereoTool Processor Sécurisé**  
*Traitement audio professionnel avec sécurité enterprise*

Pour toute question technique : `admin@radiocausecommune.fr` 