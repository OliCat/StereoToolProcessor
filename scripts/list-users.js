#!/usr/bin/env node

const { sequelize, User } = require('../src/server/models');

// Helper pour formater la date
function formatDate(date) {
  return date ? date.toLocaleString('fr-FR') : 'Jamais';
}

// Helper pour afficher l'aide
function showHelp() {
  console.log(`
Usage: node scripts/list-users.js [options]

Options:
  --role <role>        Filtrer par rôle (admin/user/guest)
  --active             Afficher seulement les utilisateurs actifs
  --inactive           Afficher seulement les utilisateurs inactifs
  --help               Afficher cette aide

Exemples:
  node scripts/list-users.js                    # Tous les utilisateurs
  node scripts/list-users.js --role admin       # Seulement les admins
  node scripts/list-users.js --active           # Seulement les utilisateurs actifs
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
      case '--role':
        options.role = next;
        i++;
        break;
      case '--active':
        options.activeOnly = true;
        break;
      case '--inactive':
        options.inactiveOnly = true;
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

// Lister les utilisateurs
async function listUsers(options) {
  try {
    console.log('🔄 Connexion à la base de données...');
    
    // Vérifier la connexion à la base de données
    await sequelize.authenticate();
    console.log('✅ Connexion établie\n');

    // Construire les conditions de recherche
    const whereClause = {};

    if (options.role) {
      if (!['admin', 'user', 'guest'].includes(options.role)) {
        throw new Error('Rôle invalide (admin/user/guest)');
      }
      whereClause.role = options.role;
    }

    if (options.activeOnly) {
      whereClause.isActive = true;
    } else if (options.inactiveOnly) {
      whereClause.isActive = false;
    }

    // Récupérer les utilisateurs
    const users = await User.findAll({
      where: whereClause,
      attributes: { exclude: ['password', 'resetPasswordToken'] },
      order: [['createdAt', 'DESC']]
    });

    if (users.length === 0) {
      console.log('👤 Aucun utilisateur trouvé avec ces critères');
      return;
    }

    console.log(`👥 ${users.length} utilisateur(s) trouvé(s):\n`);

    // Afficher les utilisateurs dans un tableau
    console.log('┌─────────────────┬──────────────────────────────────────┬─────────────────┬─────────────────┬─────────┬────────┬─────────────────────┬─────────────────────┐');
    console.log('│ Prénom          │ Email                                │ Nom             │ Rôle            │ Actif   │ ID     │ Créé le             │ Dernière connexion  │');
    console.log('├─────────────────┼──────────────────────────────────────┼─────────────────┼─────────────────┼─────────┼────────┼─────────────────────┼─────────────────────┤');

    users.forEach(user => {
      const firstName = user.firstName.padEnd(15).substring(0, 15);
      const email = user.email.padEnd(38).substring(0, 38);
      const lastName = user.lastName.padEnd(15).substring(0, 15);
      const role = user.role.padEnd(15).substring(0, 15);
      const isActive = (user.isActive ? '✅ Oui' : '❌ Non').padEnd(7);
      const id = user.id.substring(0, 6);
      const createdAt = formatDate(user.createdAt).padEnd(19).substring(0, 19);
      const lastLogin = formatDate(user.lastLogin).padEnd(19).substring(0, 19);

      console.log(`│ ${firstName} │ ${email} │ ${lastName} │ ${role} │ ${isActive} │ ${id} │ ${createdAt} │ ${lastLogin} │`);
    });

    console.log('└─────────────────┴──────────────────────────────────────┴─────────────────┴─────────────────┴─────────┴────────┴─────────────────────┴─────────────────────┘');

    // Statistiques
    const activeUsers = users.filter(u => u.isActive).length;
    const inactiveUsers = users.filter(u => u.isActive === false).length;
    const adminUsers = users.filter(u => u.role === 'admin').length;
    const regularUsers = users.filter(u => u.role === 'user').length;
    const guestUsers = users.filter(u => u.role === 'guest').length;

    console.log('\n📊 Statistiques:');
    console.log(`   Total: ${users.length} utilisateur(s)`);
    console.log(`   Actifs: ${activeUsers} | Inactifs: ${inactiveUsers}`);
    console.log(`   Admins: ${adminUsers} | Utilisateurs: ${regularUsers} | Invités: ${guestUsers}`);

  } catch (error) {
    console.error('❌ Erreur lors de la récupération des utilisateurs:', error.message);
    process.exit(1);
  } finally {
    // Fermer la connexion à la base de données
    await sequelize.close();
  }
}

// Fonction principale
async function main() {
  console.log('📋 Liste des utilisateurs - StereoTool Processor\n');

  const options = parseArgs();

  // Afficher les filtres appliqués
  if (options.role || options.activeOnly || options.inactiveOnly) {
    console.log('🔍 Filtres appliqués:');
    if (options.role) console.log(`   - Rôle: ${options.role}`);
    if (options.activeOnly) console.log('   - Seulement les utilisateurs actifs');
    if (options.inactiveOnly) console.log('   - Seulement les utilisateurs inactifs');
    console.log('');
  }

  await listUsers(options);
}

// Exécuter le script
if (require.main === module) {
  main().catch(error => {
    console.error('❌ Erreur fatale:', error.message);
    process.exit(1);
  });
}

module.exports = { listUsers }; 