# 🎵 StereoTool Processor
## Application de Traitement Audio pour Radio Cause Commune

[![Version](https://img.shields.io/badge/version-2.0.0-blue.svg)](https://github.com/RadioCauseCommune/StereoToolProcessor)
[![Security](https://img.shields.io/badge/security-enterprise-green.svg)](./README_SECURISE.md)
[![License](https://img.shields.io/badge/license-Custom-orange.svg)](./LICENSE)

Une application web professionnelle pour le traitement de fichiers audio avec StereoTool, disponible en deux versions : standalone et sécurisée enterprise.

## 🚀 **Versions Disponibles**

### **Version 2.0 - Sécurisée Enterprise (Recommandée)**
- ✅ **Authentification JWT** et gestion des rôles
- ✅ **Base de données MySQL** avec ORM Sequelize
- ✅ **Interface d'administration** complète
- ✅ **Sécurité enterprise** : HTTPS, rate limiting, logs
- ✅ **Déploiement production** avec PM2 et Nginx
- ✅ **Restriction par domaine** (@radiocausecommune.fr)

👉 **[Guide d'installation sécurisée](./README_SECURISE.md)**

### **Version 1.0 - Standalone (Simple)**
- ✅ Interface web basique pour le traitement StereoTool
- ✅ Upload et traitement de fichiers audio
- ✅ Support multi-formats (WAV, MP3, FLAC, etc.)
- ✅ Traitement par segments pour les gros fichiers

## 📦 **Installation Rapide**

### **Version Sécurisée (Recommandée)**
```bash
# Installation automatique
./scripts/setup-secure.sh --auto

# Ou installation interactive
./scripts/setup-secure.sh
```

### **Version Standalone**
```bash
npm install
npm run build
npm start
```

## 🔧 **Fonctionnalités**

### **Traitement Audio**
- **Formats supportés** : WAV, MP3, FLAC, AIFF, OGG, M4A
- **Presets StereoTool** personnalisables
- **Traitement par segments** pour les fichiers longs (>30min)
- **Traitement par lot** de plusieurs fichiers
- **Optimisation automatique** du format de sortie

### **Sécurité (Version Enterprise)**
- **Authentification sécurisée** avec JWT
- **Gestion des rôles** : Admin, User, Guest
- **Rate limiting** anti-attaques
- **Logs d'audit** complets
- **Chiffrement** des mots de passe
- **Sessions sécurisées** en base de données

### **Administration (Version Enterprise)**
- **Tableau de bord** avec statistiques temps réel
- **Gestion des utilisateurs** et permissions
- **Monitoring** des processus de traitement
- **Configuration centralisée**
- **Quotas par utilisateur**

## 🏗️ **Architecture**

### **Version Enterprise**
```
┌─────────────────┐    ┌──────────────┐    ┌─────────────────┐
│   Nginx Proxy   │────│  Node.js App │────│  MySQL Database │
│   (SSL/HTTPS)   │    │  (Cluster)   │    │  (Users/Jobs)   │
└─────────────────┘    └──────────────┘    └─────────────────┘
         │                       │                     │
    ┌────▼────┐             ┌────▼────┐           ┌────▼────┐
    │Fail2Ban │             │ Winston │           │Sessions │
    │Firewall │             │  Logs   │           │ Store   │
    └─────────┘             └─────────┘           └─────────┘
```

### **Version Standalone**
```
┌─────────────────┐    ┌──────────────┐
│   Web Browser   │────│  Node.js App │
│                 │    │  (Express)   │
└─────────────────┘    └──────────────┘
                              │
                        ┌─────▼─────┐
                        │StereoTool │
                        │Processing │
                        └───────────┘
```

## 📖 **Documentation**

- **[README Sécurisé](./README_SECURISE.md)** - Version Enterprise complète
- **[Guide de Déploiement](./DEPLOYMENT_GUIDE.md)** - Installation production
- **[Évolutions](./EVOLUTIONS.md)** - Historique des versions
- **[Contribution](./CONTRIBUTING.md)** - Guide pour contribuer

## 🚀 **Déploiement Production**

### **Prérequis**
- Ubuntu 20.04+ LTS
- Node.js 18+
- MySQL 8.0+
- Nginx
- Domaine avec SSL

### **Installation Automatique**
```bash
# Sur votre serveur
./scripts/setup-secure.sh --production

# Suivre le guide détaillé
cat DEPLOYMENT_GUIDE.md
```

## 🔐 **Sécurité**

La version enterprise inclut :
- **Authentification JWT** avec refresh tokens
- **Rate limiting** configurable
- **Headers de sécurité** Helmet.js
- **Protection CSRF** et XSS
- **Logs sécurisés** avec Winston
- **Firewall** et monitoring Fail2Ban
- **HTTPS** obligatoire en production

## 📊 **API Documentation**

### **Endpoints Publics**
```
POST /api/auth/login       # Connexion utilisateur
```

### **Endpoints Authentifiés**
```
GET  /api/auth/profile     # Profil utilisateur
POST /api/upload           # Upload et traitement
GET  /api/jobs             # Liste des tâches
GET  /api/download/:id     # Téléchargement
```

### **Endpoints Admin**
```
POST /api/auth/register    # Créer utilisateur
GET  /api/auth/users       # Liste utilisateurs
GET  /api/admin/stats      # Statistiques
```

## 🛠️ **Développement**

### **Structure du Projet**
```
├── src/
│   ├── client/           # Interface React
│   │   ├── components/   # Composants UI
│   │   │   └── Auth/     # Authentification
│   │   └── styles.css    # Styles
│   └── server/           # Backend Node.js
│       ├── models/       # Modèles Sequelize
│       ├── routes/       # Routes API
│       ├── middleware/   # Middlewares sécurité
│       ├── index.js      # Serveur standalone
│       └── index-secure.js # Serveur sécurisé
├── scripts/
│   └── setup-secure.sh   # Installation automatique
├── config.example.js     # Configuration exemple
├── ecosystem.config.js   # Configuration PM2
└── public/               # Assets statiques
```

### **Scripts NPM**
```bash
npm run dev          # Développement (serveur classique)
npm run dev-secure   # Développement (serveur sécurisé)
npm run build        # Construction production
npm run start        # Démarrage production
npm test             # Tests (à implémenter)
```

## 🤝 **Contribution**

1. Fork le projet
2. Créer une branche feature (`git checkout -b feature/AmazingFeature`)
3. Commit vos changements (`git commit -m 'Add AmazingFeature'`)
4. Push vers la branche (`git push origin feature/AmazingFeature`)
5. Ouvrir une Pull Request

## 📝 **Changelog**

### **v2.0.0** - Version Sécurisée Enterprise
- ➕ Authentification JWT complète
- ➕ Base de données MySQL/Sequelize
- ➕ Interface d'administration
- ➕ Sécurité enterprise (rate limiting, logs, HTTPS)
- ➕ Déploiement production automatisé
- ➕ Guide d'installation complet

### **v1.0.0** - Version Standalone
- ➕ Interface web de base
- ➕ Traitement StereoTool
- ➕ Support multi-formats
- ➕ Traitement par segments

## 📧 **Support**

- **Email technique** : `admin@radiocausecommune.fr`
- **Issues GitHub** : [Créer un ticket](https://github.com/RadioCauseCommune/StereoToolProcessor/issues)
- **Documentation** : Voir les guides dans le repository

## 📄 **Licence**

Application développée spécifiquement pour Radio Cause Commune.
Utilisation soumise aux conditions de licence StereoTool.

---

**🎵 Radio Cause Commune - Traitement Audio Professionnel**

*Transformez vos enregistrements avec la puissance de StereoTool dans une interface web moderne et sécurisée.* 