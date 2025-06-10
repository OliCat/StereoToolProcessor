#!/usr/bin/env node

const { sequelize, User } = require('../src/server/models');
const { hashPassword, validateEmailDomain } = require('../src/server/middleware/auth');

// Helper pour afficher l'aide
function showHelp() {
  console.log(`
Usage: node scripts/create-user.js [options]

Options:
  --email <email>      Email de l'utilisateur (requis)
  --password <pass>    Mot de passe (requis)
  --firstName <name>   Prénom (requis)
  --lastName <name>    Nom de famille (requis)
  --role <role>        Rôle (admin/user/guest, défaut: user)
  --help               Afficher cette aide

Exemples:
  node scripts/create-user.js --email admin@radiocausecommune.fr --password motdepasse123 --firstName Admin --lastName System --role admin
  node scripts/create-user.js --email utilisateur@radiocausecommune.fr --password motdepasse123 --firstName Jean --lastName Dupont
`);
}

// Parser les arguments de la ligne de commande
function parseArgs() {
  const args = process.argv.slice(2);
  const options = {};

  for (let i = 0; i < args.length; i++) {
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

// Valider les options
function validateOptions(options) {
  const errors = [];

  if (!options.email) {
    errors.push('Email requis (--email)');
  } else if (!options.email.includes('@')) {
    errors.push('Email invalide');
  }

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

  return errors;
}

// Créer un utilisateur
async function createUser(options) {
  try {
    console.log('🔄 Connexion à la base de données...');
    
    // Vérifier la connexion à la base de données
    await sequelize.authenticate();
    
    // Synchroniser les modèles si nécessaire
    await sequelize.sync();

    console.log('✅ Connexion établie');

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

  } catch (error) {
    console.error('❌ Erreur lors de la création de l\'utilisateur:', error.message);
    process.exit(1);
  } finally {
    // Fermer la connexion à la base de données
    await sequelize.close();
  }
}

// Fonction principale
async function main() {
  console.log('🚀 Script de création d\'utilisateur - StereoTool Processor\n');

  const options = parseArgs();
  
  // Valider les options
  const errors = validateOptions(options);
  if (errors.length > 0) {
    console.error('❌ Erreurs de validation:');
    errors.forEach(error => console.error(`   - ${error}`));
    console.log('\nUtilisez --help pour voir l\'aide');
    process.exit(1);
  }

  console.log('📝 Paramètres reçus:');
  console.log(`   Email: ${options.email}`);
  console.log(`   Prénom: ${options.firstName}`);
  console.log(`   Nom: ${options.lastName}`);
  console.log(`   Rôle: ${options.role || 'user'}`);
  console.log('');

  // Créer l'utilisateur
  await createUser(options);
}

// Exécuter le script
if (require.main === module) {
  main().catch(error => {
    console.error('❌ Erreur fatale:', error.message);
    process.exit(1);
  });
}

module.exports = { createUser }; 