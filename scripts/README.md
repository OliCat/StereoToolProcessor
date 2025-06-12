# Scripts CLI - StereoTool Processor

Ce dossier contient des scripts en ligne de commande pour administrer l'application StereoTool Processor.

## Scripts disponibles

### 1. Gestionnaire d'utilisateurs (`manage-user.js`) ⭐ NOUVEAU ⭐

Script polyvalent pour gérer les utilisateurs : création, modification de mot de passe, mise à jour des informations, activation/désactivation.

#### Utilisation

```bash
node scripts/manage-user.js <action> [options]
```

#### Actions disponibles

- `create` : Créer un nouvel utilisateur
- `change-password` : Changer le mot de passe d'un utilisateur existant
- `update-info` : Mettre à jour les informations d'un utilisateur
- `activate` : Activer un utilisateur
- `deactivate` : Désactiver un utilisateur

#### Options

**Options communes :**
- `--email <email>` : Email de l'utilisateur (requis)
- `--help` : Afficher l'aide

**Options pour `create` :**
- `--password <password>` : Mot de passe (requis, min. 8 caractères)
- `--firstName <prénom>` : Prénom de l'utilisateur (requis)
- `--lastName <nom>` : Nom de famille de l'utilisateur (requis)
- `--role <rôle>` : Rôle de l'utilisateur (`admin`, `user`, `guest`, défaut: `user`)

**Options pour `change-password` :**
- `--new-password <password>` : Nouveau mot de passe (requis, min. 8 caractères)

**Options pour `update-info` :**
- `--firstName <prénom>` : Nouveau prénom (optionnel)
- `--lastName <nom>` : Nouveau nom (optionnel)
- `--role <rôle>` : Nouveau rôle (optionnel)

#### Exemples

```bash
# Créer un administrateur
node scripts/manage-user.js create --email admin@radiocausecommune.fr --password MotDePasse123! --firstName Admin --lastName System --role admin

# Changer un mot de passe
node scripts/manage-user.js change-password --email utilisateur@radiocausecommune.fr --new-password NouveauMotDePasse123!

# Mettre à jour les informations d'un utilisateur
node scripts/manage-user.js update-info --email utilisateur@radiocausecommune.fr --firstName Jean --lastName Martin --role admin

# Activer un utilisateur
node scripts/manage-user.js activate --email utilisateur@radiocausecommune.fr

# Désactiver un utilisateur
node scripts/manage-user.js deactivate --email utilisateur@radiocausecommune.fr

# Afficher l'aide
node scripts/manage-user.js --help
```

### 2. Création d'utilisateur (`create-user.js`) 

⚠️ **DÉPRÉCIÉ** - Utilisez `manage-user.js create` à la place

Permet de créer de nouveaux utilisateurs directement en ligne de commande.

#### Utilisation

```bash
node scripts/create-user.js --email <email> --password <password> --firstName <prénom> --lastName <nom> [--role <rôle>]
```

#### Options

- `--email <email>` : Email de l'utilisateur (requis)
- `--password <password>` : Mot de passe (requis, min. 8 caractères)
- `--firstName <prénom>` : Prénom de l'utilisateur (requis)
- `--lastName <nom>` : Nom de famille de l'utilisateur (requis)
- `--role <rôle>` : Rôle de l'utilisateur (`admin`, `user`, `guest`, défaut: `user`)
- `--help` : Afficher l'aide

#### Exemples

```bash
# Créer un administrateur
node scripts/create-user.js --email admin@radiocausecommune.fr --password MotDePasse123! --firstName Admin --lastName System --role admin

# Créer un utilisateur standard
node scripts/create-user.js --email jean.dupont@radiocausecommune.fr --password MotDePasse123! --firstName Jean --lastName Dupont

# Créer un invité
node scripts/create-user.js --email invite@radiocausecommune.fr --password MotDePasse123! --firstName Invité --lastName Test --role guest
```

#### Validation

Le script valide automatiquement :
- Format de l'email
- Longueur du mot de passe (minimum 8 caractères)
- Domaine de l'email (selon la configuration)
- Unicité de l'email
- Validité du rôle

### 3. Liste des utilisateurs (`list-users.js`)

Permet d'afficher la liste des utilisateurs avec leurs informations.

#### Utilisation

```bash
node scripts/list-users.js [options]
```

#### Options

- `--role <rôle>` : Filtrer par rôle (`admin`, `user`, `guest`)
- `--active` : Afficher seulement les utilisateurs actifs
- `--inactive` : Afficher seulement les utilisateurs inactifs
- `--help` : Afficher l'aide

#### Exemples

```bash
# Lister tous les utilisateurs
node scripts/list-users.js

# Lister seulement les administrateurs
node scripts/list-users.js --role admin

# Lister seulement les utilisateurs actifs
node scripts/list-users.js --active

# Lister les utilisateurs inactifs avec le rôle user
node scripts/list-users.js --role user --inactive
```

#### Affichage

Le script affiche :
- Un tableau formaté avec les informations des utilisateurs
- Des statistiques globales (nombre total, actifs/inactifs, répartition par rôle)

## Prérequis

- Node.js installé
- Variables d'environnement configurées (base de données, etc.)
- Application StereoTool Processor configurée

## Configuration

Les scripts utilisent la même configuration que l'application principale :
- Configuration de la base de données depuis `config.js`
- Règles de validation des emails (domaine autorisé)
- Paramètres de sécurité (hachage des mots de passe)

## Sécurité

- Les mots de passe sont automatiquement hachés avec bcrypt
- Validation du domaine d'email selon la configuration
- Connexion sécurisée à la base de données
- Fermeture automatique des connexions

## Dépannage

### Erreur de connexion à la base de données
Vérifiez que :
- La base de données est accessible
- Les paramètres de connexion sont corrects dans `config.js`
- L'utilisateur de base de données a les bonnes permissions

### Erreur "Domaine email non autorisé"
Vérifiez la configuration du domaine autorisé dans `config.js` :
```javascript
organization: {
  domain: 'radiocausecommune.fr' // ou 'any' pour autoriser tous les domaines
}
```

### Erreur "Utilisateur existe déjà"
L'email doit être unique. Utilisez `list-users.js` pour vérifier les utilisateurs existants.

## Exemples d'utilisation courante

### Configuration initiale
```bash
# 1. Créer le premier administrateur
node scripts/create-user.js --email admin@radiocausecommune.fr --password AdminPass123! --firstName Admin --lastName Principal --role admin

# 2. Vérifier la création
node scripts/list-users.js

# 3. Créer des utilisateurs standard
node scripts/create-user.js --email utilisateur@radiocausecommune.fr --password UserPass123! --firstName Utilisateur --lastName Standard
```

### Maintenance
```bash
# Lister tous les administrateurs
node scripts/list-users.js --role admin

# Vérifier les utilisateurs inactifs
node scripts/list-users.js --inactive
``` 