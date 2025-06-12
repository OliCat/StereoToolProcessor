#!/usr/bin/env node

const { sequelize, User } = require('../src/server/models');
const { hashPassword, validateEmailDomain } = require('../src/server/middleware/auth');

// Helper pour afficher l'aide
function showHelp() {
  console.log(`
Usage: node scripts/manage-user.js <action> [options]

Actions:
  create                 Créer un nouvel utilisateur
  change-password        Changer le mot de passe d'un utilisateur existant
  update-info           Mettre à jour les informations d'un utilisateur
  activate              Activer un utilisateur
  deactivate            Désactiver un utilisateur

Options communes:
  --email <email>        Email de l'utilisateur (requis)
  --help                 Afficher cette aide

Options pour create:
  --password <pass>      Mot de passe (requis)
  --firstName <n>     Prénom (requis)
  --lastName <n>      Nom de famille (requis)
  --role <role>          Rôle (admin/user/guest, défaut: user)

Options pour change-password:
  --new-password <pass>  Nouveau mot de passe (requis)

Options pour update-info:
  --firstName <n>     Nouveau prénom (optionnel)
  --lastName <n>      Nouveau nom (optionnel)
  --role <role>          Nouveau rôle (optionnel)

Exemples:
  # Créer un utilisateur
  node scripts/manage-user.js create --email admin@radiocausecommune.fr --password motdepasse123 --firstName Admin --lastName System --role admin
  
  # Changer un mot de passe
  node scripts/manage-user.js change-password --email utilisateur@radiocausecommune.fr --new-password nouveaumotdepasse123
  
  # Mettre à jour les informations
  node scripts/manage-user.js update-info --email utilisateur@radiocausecommune.fr --firstName Jean --lastName Martin --role admin
  
  # Activer/Désactiver un utilisateur
  node scripts/manage-user.js activate --email utilisateur@radiocausecommune.fr
  node scripts/manage-user.js deactivate --email utilisateur@radiocausecommune.fr
`);
}

// Parser les arguments de la ligne de commande
function parseArgs() {
  const args = process.argv.slice(2);
  const options = {};

  if (args.length === 0) {
    console.error('❌ Action requise');
    showHelp();
    process.exit(1);
  }

  // Première argument = action
  const action = args[0];
  if (!['create', 'change-password', 'update-info', 'activate', 'deactivate'].includes(action)) {
    if (action === '--help') {
      showHelp();
      process.exit(0);
    }
    console.error(`❌ Action inconnue: ${action}`);
    showHelp();
    process.exit(1);
  }

  options.action = action;

  // Parser les autres arguments
  for (let i = 1; i < args.length; i++) {
    const arg = args[i];
    const next = args[i + 1];

    switch (arg) {
      case '--help':
        showHelp();
        process.exit(0);
        break;
      case '--email':
        options.email = next;
        i++;
        break;
      case '--password':
        options.password = next;
        i++;
        break;
      case '--new-password':
        options.newPassword = next;
        i++;
        break;
      case '--firstName':
        options.firstName = next;
        i++;
        break;
      case '--lastName':
        options.lastName = next;
        i++;
        break;
      case '--role':
        options.role = next;
        i++;
        break;
      default:
        if (arg.startsWith('--')) {
          console.error(`❌ Option inconnue: ${arg}`);
          process.exit(1);
        }
    }
  }

  return options;
}

// Valider les options selon l'action
function validateOptions(options) {
  const errors = [];

  // Validation commune
  if (!options.email) {
    errors.push('Email requis (--email)');
  } else if (!options.email.includes('@')) {
    errors.push('Email invalide');
  }

  // Validation selon l'action
  switch (options.action) {
    case 'create':
      if (!options.password) {
        errors.push('Mot de passe requis (--password)');
      } else if (options.password.length < 8) {
        errors.push('Le mot de passe doit contenir au moins 8 caractères');
      }

      if (!options.firstName) {
        errors.push('Prénom requis (--firstName)');
      }

      if (!options.lastName) {
        errors.push('Nom de famille requis (--lastName)');
      }

      if (options.role && !['admin', 'user', 'guest'].includes(options.role)) {
        errors.push('Rôle invalide (admin/user/guest)');
      }
      break;

    case 'change-password':
      if (!options.newPassword) {
        errors.push('Nouveau mot de passe requis (--new-password)');
      } else if (options.newPassword.length < 8) {
        errors.push('Le nouveau mot de passe doit contenir au moins 8 caractères');
      }
      break;

    case 'update-info':
      if (!options.firstName && !options.lastName && !options.role) {
        errors.push('Au moins une information à mettre à jour requise (--firstName, --lastName, ou --role)');
      }

      if (options.role && !['admin', 'user', 'guest'].includes(options.role)) {
        errors.push('Rôle invalide (admin/user/guest)');
      }
      break;

    case 'activate':
    case 'deactivate':
      // Pas de validation supplémentaire nécessaire
      break;
  }

  return errors;
}

// Créer un utilisateur
async function createUser(options) {
  console.log('🔍 Vérification de l\'utilisateur...');

  // Valider le domaine de l'email
  if (!validateEmailDomain(options.email)) {
    throw new Error('Domaine email non autorisé');
  }

  // Vérifier si l'utilisateur existe déjà
  const existingUser = await User.findOne({ 
    where: { email: options.email.toLowerCase() } 
  });

  if (existingUser) {
    throw new Error(`Un utilisateur avec l'email ${options.email} existe déjà`);
  }

  console.log('🔐 Hachage du mot de passe...');
  
  // Hasher le mot de passe
  const hashedPassword = await hashPassword(options.password);

  console.log('👤 Création de l\'utilisateur...');

  // Créer l'utilisateur
  const user = await User.create({
    email: options.email.toLowerCase(),
    password: hashedPassword,
    firstName: options.firstName,
    lastName: options.lastName,
    role: options.role || 'user'
  });

  console.log('✅ Utilisateur créé avec succès !');
  console.log(`
📋 Détails de l'utilisateur:
   ID: ${user.id}
   Email: ${user.email}
   Prénom: ${user.firstName}
   Nom: ${user.lastName}
   Rôle: ${user.role}
   Statut: ${user.isActive ? 'Actif' : 'Inactif'}
   Créé le: ${user.createdAt.toLocaleString('fr-FR')}
`);
}

// Changer le mot de passe
async function changePassword(options) {
  console.log('🔍 Recherche de l\'utilisateur...');

  const user = await User.findOne({ 
    where: { email: options.email.toLowerCase() } 
  });

  if (!user) {
    throw new Error(`Aucun utilisateur trouvé avec l'email ${options.email}`);
  }

  console.log(`👤 Utilisateur trouvé: ${user.firstName} ${user.lastName}`);
  console.log('🔐 Hachage du nouveau mot de passe...');
  
  // Hasher le nouveau mot de passe
  const hashedPassword = await hashPassword(options.newPassword);

  console.log('💾 Mise à jour du mot de passe...');

  // Mettre à jour le mot de passe
  await user.update({
    password: hashedPassword
  });

  console.log('✅ Mot de passe changé avec succès !');
  console.log(`
📋 Utilisateur mis à jour:
   Email: ${user.email}
   Prénom: ${user.firstName}
   Nom: ${user.lastName}
   Rôle: ${user.role}
   Modifié le: ${new Date().toLocaleString('fr-FR')}
`);
}

// Mettre à jour les informations
async function updateInfo(options) {
  console.log('🔍 Recherche de l\'utilisateur...');

  const user = await User.findOne({ 
    where: { email: options.email.toLowerCase() } 
  });

  if (!user) {
    throw new Error(`Aucun utilisateur trouvé avec l'email ${options.email}`);
  }

  console.log(`👤 Utilisateur trouvé: ${user.firstName} ${user.lastName}`);
  console.log('💾 Mise à jour des informations...');

  // Préparer les données à mettre à jour
  const updateData = {};
  
  if (options.firstName) {
    updateData.firstName = options.firstName;
  }
  
  if (options.lastName) {
    updateData.lastName = options.lastName;
  }
  
  if (options.role) {
    updateData.role = options.role;
  }

  // Mettre à jour l'utilisateur
  await user.update(updateData);

  console.log('✅ Informations mises à jour avec succès !');
  
  // Recharger l'utilisateur pour afficher les nouvelles données
  await user.reload();
  
  console.log(`
📋 Utilisateur mis à jour:
   Email: ${user.email}
   Prénom: ${user.firstName}
   Nom: ${user.lastName}
   Rôle: ${user.role}
   Statut: ${user.isActive ? 'Actif' : 'Inactif'}
   Modifié le: ${new Date().toLocaleString('fr-FR')}
`);
}

// Activer/Désactiver un utilisateur
async function toggleUserStatus(options, activate = true) {
  console.log('🔍 Recherche de l\'utilisateur...');

  const user = await User.findOne({ 
    where: { email: options.email.toLowerCase() } 
  });

  if (!user) {
    throw new Error(`Aucun utilisateur trouvé avec l'email ${options.email}`);
  }

  console.log(`👤 Utilisateur trouvé: ${user.firstName} ${user.lastName}`);
  
  if (user.isActive === activate) {
    console.log(`⚠️ L'utilisateur est déjà ${activate ? 'activé' : 'désactivé'}`);
    return;
  }

  console.log(`💾 ${activate ? 'Activation' : 'Désactivation'} de l'utilisateur...`);

  // Mettre à jour le statut
  await user.update({
    isActive: activate
  });

  console.log(`✅ Utilisateur ${activate ? 'activé' : 'désactivé'} avec succès !`);
  console.log(`
📋 Utilisateur mis à jour:
   Email: ${user.email}
   Prénom: ${user.firstName}
   Nom: ${user.lastName}
   Rôle: ${user.role}
   Statut: ${activate ? 'Actif' : 'Inactif'}
   Modifié le: ${new Date().toLocaleString('fr-FR')}
`);
}

// Fonction principale de gestion
async function manageUser(options) {
  try {
    console.log('🔄 Connexion à la base de données...');
    
    // Vérifier la connexion à la base de données
    await sequelize.authenticate();
    
    // Synchroniser les modèles si nécessaire
    await sequelize.sync();

    console.log('✅ Connexion établie\n');

    // Exécuter l'action demandée
    switch (options.action) {
      case 'create':
        await createUser(options);
        break;
      case 'change-password':
        await changePassword(options);
        break;
      case 'update-info':
        await updateInfo(options);
        break;
      case 'activate':
        await toggleUserStatus(options, true);
        break;
      case 'deactivate':
        await toggleUserStatus(options, false);
        break;
      default:
        throw new Error(`Action non supportée: ${options.action}`);
    }

  } catch (error) {
    console.error(`❌ Erreur lors de l'action '${options.action}':`, error.message);
    process.exit(1);
  } finally {
    // Fermer la connexion à la base de données
    await sequelize.close();
  }
}

// Fonction principale
async function main() {
  console.log('🛠️ Gestionnaire d\'utilisateurs - StereoTool Processor\n');

  const options = parseArgs();
  
  // Valider les options
  const errors = validateOptions(options);
  if (errors.length > 0) {
    console.error('❌ Erreurs de validation:');
    errors.forEach(error => console.error(`   - ${error}`));
    console.log('\nUtilisez --help pour voir l\'aide');
    process.exit(1);
  }

  console.log(`📝 Action: ${options.action}`);
  console.log(`   Email: ${options.email}`);
  
  if (options.action === 'create') {
    console.log(`   Prénom: ${options.firstName}`);
    console.log(`   Nom: ${options.lastName}`);
    console.log(`   Rôle: ${options.role || 'user'}`);
  }
  
  if (options.action === 'update-info') {
    if (options.firstName) console.log(`   Nouveau prénom: ${options.firstName}`);
    if (options.lastName) console.log(`   Nouveau nom: ${options.lastName}`);
    if (options.role) console.log(`   Nouveau rôle: ${options.role}`);
  }
  
  console.log('');

  // Gérer l'utilisateur
  await manageUser(options);
}

// Exécuter le script
if (require.main === module) {
  main().catch(error => {
    console.error('❌ Erreur fatale:', error.message);
    process.exit(1);
  });
}

module.exports = { manageUser, createUser, changePassword, updateInfo, toggleUserStatus }; 