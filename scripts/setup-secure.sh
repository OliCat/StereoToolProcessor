#!/bin/bash

# Script d'installation pour la version sécurisée de StereoTool Processor
# Radio Cause Commune

set -e

echo "🔧 Installation de la version sécurisée de StereoTool Processor"
echo "================================================================="

# Couleurs pour l'affichage
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Fonction pour afficher les messages
print_status() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

print_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Vérification des prérequis
check_prerequisites() {
    print_status "Vérification des prérequis..."
    
    # Vérifier Node.js
    if ! command -v node &> /dev/null; then
        print_error "Node.js n'est pas installé. Veuillez l'installer avant de continuer."
        exit 1
    fi
    
    node_version=$(node --version | cut -d'v' -f2 | cut -d'.' -f1)
    if [ "$node_version" -lt 16 ]; then
        print_error "Node.js version 16+ requis. Version actuelle: $(node --version)"
        exit 1
    fi
    
    print_success "Node.js $(node --version) détecté"
    
    # Vérifier npm
    if ! command -v npm &> /dev/null; then
        print_error "npm n'est pas installé."
        exit 1
    fi
    
    print_success "npm $(npm --version) détecté"
}

# Installation des dépendances
install_dependencies() {
    print_status "Installation des dépendances..."
    
    if [ -f "package-lock.json" ]; then
        npm ci
    else
        npm install
    fi
    
    print_success "Dépendances installées"
}

# Configuration initiale
setup_configuration() {
    print_status "Configuration initiale..."
    
    # Créer le fichier de configuration s'il n'existe pas
    if [ ! -f "config.js" ]; then
        if [ -f "config.example.js" ]; then
            cp config.example.js config.js
            print_warning "Fichier config.js créé depuis l'exemple."
            print_warning "IMPORTANT: Modifiez config.js avec vos vraies valeurs de configuration!"
        else
            print_error "Fichier config.example.js non trouvé."
            exit 1
        fi
    else
        print_success "Fichier config.js déjà présent"
    fi
}

# Création des dossiers nécessaires
create_directories() {
    print_status "Création des dossiers nécessaires..."
    
    directories=("uploads" "outputs" "presets" "temp" "logs")
    
    for dir in "${directories[@]}"; do
        if [ ! -d "$dir" ]; then
            mkdir -p "$dir"
            chmod 755 "$dir"
            print_success "Dossier $dir créé"
        else
            print_success "Dossier $dir existe déjà"
        fi
    done
}

# Construction de l'application client
build_client() {
    print_status "Construction de l'application client..."
    
    if [ -f "webpack.config.js" ]; then
        npm run build-client
        print_success "Application client construite"
    else
        print_warning "webpack.config.js non trouvé, construction ignorée"
    fi
}

# Vérification de la configuration
verify_config() {
    print_status "Vérification de la configuration..."
    
    if [ -f "config.js" ]; then
        node -e "
        try {
            const config = require('./config.js');
            console.log('✓ Configuration valide');
            
            // Vérifier les valeurs par défaut
            if (config.security.jwtSecret.includes('example') || config.security.jwtSecret === 'your_jwt_secret_here_change_this_in_production') {
                console.log('⚠️  ATTENTION: Changez le jwtSecret dans config.js');
            }
            
            if (config.database.password.includes('your_secure_password_here')) {
                console.log('⚠️  ATTENTION: Configurez le mot de passe de la base de données');
            }
            
            if (config.stereoTool.license.includes('your_license_key_here')) {
                console.log('⚠️  ATTENTION: Configurez votre licence StereoTool');
            }
        } catch (error) {
            console.error('❌ Erreur dans config.js:', error.message);
            process.exit(1);
        }
        "
    else
        print_error "Fichier config.js manquant"
        exit 1
    fi
}

# Menu d'installation
show_menu() {
    echo ""
    echo "🚀 Choisissez le type d'installation:"
    echo "1) Installation complète (développement local)"
    echo "2) Installation pour production (avec base de données)"
    echo "3) Migration depuis l'ancienne version"
    echo "4) Installation des dépendances uniquement"
    echo "5) Quitter"
    echo ""
    read -p "Votre choix (1-5): " choice
    
    case $choice in
        1)
            install_development
            ;;
        2)
            install_production
            ;;
        3)
            migrate_from_old
            ;;
        4)
            install_dependencies_only
            ;;
        5)
            echo "Installation annulée."
            exit 0
            ;;
        *)
            print_error "Choix invalide."
            show_menu
            ;;
    esac
}

# Installation pour développement
install_development() {
    print_status "Installation pour développement local..."
    
    check_prerequisites
    install_dependencies
    setup_configuration
    create_directories
    build_client
    verify_config
    
    print_success "Installation de développement terminée!"
    echo ""
    echo "📋 Prochaines étapes:"
    echo "1. Modifiez config.js avec vos paramètres"
    echo "2. Démarrez avec: npm run dev"
    echo "3. Accédez à http://localhost:3000"
}

# Installation pour production
install_production() {
    print_status "Installation pour production..."
    
    check_prerequisites
    
    # Vérifier MySQL
    if ! command -v mysql &> /dev/null; then
        print_error "MySQL n'est pas installé. Installez-le d'abord."
        exit 1
    fi
    
    install_dependencies
    setup_configuration
    create_directories
    build_client
    verify_config
    
    # Instructions pour la production
    print_success "Installation de base terminée!"
    echo ""
    print_warning "⚠️  CONFIGURATION PRODUCTION REQUISE:"
    echo "1. Configurez MySQL et créez la base de données"
    echo "2. Modifiez config.js avec vos vrais paramètres"
    echo "3. Configurez HTTPS avec des certificats SSL"
    echo "4. Utilisez PM2 pour la gestion des processus"
    echo "5. Configurez Nginx comme reverse proxy"
    echo ""
    echo "📖 Consultez DEPLOYMENT_GUIDE.md pour les détails complets"
}

# Migration depuis l'ancienne version
migrate_from_old() {
    print_status "Migration depuis l'ancienne version..."
    
    # Sauvegarder l'ancienne configuration
    if [ -f "src/server/index.js" ]; then
        print_status "Sauvegarde de l'ancienne configuration..."
        cp src/server/index.js src/server/index-backup-$(date +%Y%m%d_%H%M%S).js
        print_success "Ancienne version sauvegardée"
    fi
    
    check_prerequisites
    install_dependencies
    setup_configuration
    create_directories
    build_client
    verify_config
    
    print_success "Migration terminée!"
    echo ""
    print_warning "📋 Actions requises après migration:"
    echo "1. Configurez config.js avec vos paramètres"
    echo "2. Créez la base de données MySQL"
    echo "3. Testez la nouvelle version avec: node src/server/index-secure.js"
    echo "4. Migrez vos données si nécessaire"
}

# Installation des dépendances uniquement
install_dependencies_only() {
    print_status "Installation des dépendances uniquement..."
    check_prerequisites
    install_dependencies
    print_success "Dépendances installées!"
}

# Script de test
run_tests() {
    print_status "Exécution des tests de configuration..."
    
    # Test de la configuration
    node -e "
    try {
        const config = require('./config.js');
        console.log('✓ Configuration chargée avec succès');
        
        // Test des modules requis
        require('./src/server/models');
        console.log('✓ Modèles de base de données OK');
        
        require('./src/server/middleware/auth');
        console.log('✓ Middlewares d\\'authentification OK');
        
        console.log('✅ Tous les tests passés!');
    } catch (error) {
        console.error('❌ Erreur:', error.message);
        process.exit(1);
    }
    "
}

# Script principal
main() {
    echo "🎵 StereoTool Processor - Radio Cause Commune"
    echo "Installation de la version sécurisée"
    echo "=========================================="
    echo ""
    
    # Vérifier que nous sommes dans le bon répertoire
    if [ ! -f "package.json" ]; then
        print_error "Ce script doit être exécuté depuis la racine du projet (où se trouve package.json)"
        exit 1
    fi
    
    # Vérifier si c'est une installation interactive ou automatique
    if [ "$1" = "--auto" ]; then
        install_development
    elif [ "$1" = "--production" ]; then
        install_production
    elif [ "$1" = "--migrate" ]; then
        migrate_from_old
    elif [ "$1" = "--test" ]; then
        run_tests
    else
        show_menu
    fi
}

# Exécution du script principal
main "$@" 