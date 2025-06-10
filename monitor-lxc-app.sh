#!/bin/bash

# Script de monitoring pour StereoTool Processor dans LXC
# Usage: ./monitor-lxc-app.sh [CTID]

CTID=${1:-200}
APP_DIR="/opt/stereo-tool-processor"
APP_USER="stereoapp"

# Couleurs pour les messages
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Fonction pour exécuter des commandes dans le container
lxc_exec() {
    pct exec $CTID -- bash -c "$1"
}

# Fonction pour afficher le statut
print_status() {
    local service=$1
    local status=$2
    if [ "$status" = "OK" ]; then
        echo -e "${GREEN}✅ $service: $status${NC}"
    elif [ "$status" = "WARNING" ]; then
        echo -e "${YELLOW}⚠️  $service: $status${NC}"
    else
        echo -e "${RED}❌ $service: $status${NC}"
    fi
}

echo -e "${BLUE}🔍 Monitoring StereoTool Processor - Container LXC $CTID${NC}"
echo "========================================================"

# Vérifier que le container est en cours d'exécution
if ! pct status $CTID | grep -q "running"; then
    echo -e "${RED}❌ Container LXC $CTID n'est pas en cours d'exécution${NC}"
    exit 1
fi

print_status "Container LXC" "Running"

# Vérifier MySQL
mysql_status=$(lxc_exec "systemctl is-active mysql" 2>/dev/null || echo "stopped")
if [ "$mysql_status" = "active" ]; then
    print_status "MySQL" "Active"
else
    print_status "MySQL" "ERREUR - $mysql_status"
fi

# Vérifier les connexions à la base de données
db_check=$(lxc_exec "mysql -u stereo_user -pStereoTool2024!SecureDB -e 'SELECT 1' stereo_tool_app 2>/dev/null && echo 'OK' || echo 'ERREUR'")
print_status "Connexion Base de Données" "$db_check"

# Vérifier PM2
pm2_status=$(lxc_exec "sudo -u $APP_USER pm2 list | grep 'stereo-tool-processor' | awk '{print \$10}'" 2>/dev/null)
if [ "$pm2_status" = "online" ]; then
    print_status "Application PM2" "Online"
elif [ "$pm2_status" = "stopped" ]; then
    print_status "Application PM2" "ARRÊTÉE"
else
    print_status "Application PM2" "ERREUR - $pm2_status"
fi

# Vérifier le port 3000
port_check=$(lxc_exec "netstat -tlnp | grep ':3000' >/dev/null && echo 'OK' || echo 'FERMÉ'")
print_status "Port 3000" "$port_check"

# Vérifier l'utilisation des ressources
echo -e "\n${BLUE}📊 Utilisation des Ressources${NC}"
echo "================================"

# CPU et mémoire
cpu_usage=$(lxc_exec "top -bn1 | grep 'Cpu(s)' | awk '{print \$2}' | cut -d'%' -f1")
memory_info=$(lxc_exec "free -h | grep Mem")
echo -e "${BLUE}CPU Usage:${NC} ${cpu_usage}%"
echo -e "${BLUE}Memory:${NC} $memory_info"

# Espace disque
disk_usage=$(lxc_exec "df -h / | tail -1 | awk '{print \$5}'")
echo -e "${BLUE}Disk Usage:${NC} $disk_usage"

# Processus Node.js
node_processes=$(lxc_exec "ps aux | grep node | grep -v grep | wc -l")
echo -e "${BLUE}Processus Node.js:${NC} $node_processes"

# Vérifier les logs d'erreur récents
echo -e "\n${BLUE}📝 Logs Récents (5 dernières minutes)${NC}"
echo "======================================="
recent_errors=$(lxc_exec "find $APP_DIR/logs -name '*.log' -mmin -5 -exec grep -l 'ERROR\\|FATAL' {} \\; 2>/dev/null | wc -l")
if [ "$recent_errors" -gt "0" ]; then
    print_status "Erreurs récentes" "TROUVÉES ($recent_errors fichiers)"
    echo "Dernières erreurs:"
    lxc_exec "find $APP_DIR/logs -name '*.log' -mmin -5 -exec grep 'ERROR\\|FATAL' {} \\; 2>/dev/null | tail -5"
else
    print_status "Erreurs récentes" "Aucune"
fi

# Vérifier la connectivité réseau
echo -e "\n${BLUE}🌐 Connectivité Réseau${NC}"
echo "========================"

# Test de connectivité interne
internal_connectivity=$(lxc_exec "curl -s -o /dev/null -w '%{http_code}' http://localhost:3000/health 2>/dev/null || echo '000'")
if [ "$internal_connectivity" = "200" ]; then
    print_status "Connectivité Interne" "OK (HTTP 200)"
else
    print_status "Connectivité Interne" "ERREUR (HTTP $internal_connectivity)"
fi

# Test de connectivité DNS
dns_test=$(lxc_exec "nslookup google.com >/dev/null 2>&1 && echo 'OK' || echo 'ERREUR'")
print_status "Résolution DNS" "$dns_test"

# Informations sur les utilisateurs connectés
echo -e "\n${BLUE}👥 Sessions Utilisateurs${NC}"
echo "=========================="
active_sessions=$(lxc_exec "mysql -u stereo_user -pStereoTool2024!SecureDB -D stereo_tool_app -e 'SELECT COUNT(*) FROM Sessions WHERE expires > NOW();' -s -N 2>/dev/null || echo '0'")
echo -e "${BLUE}Sessions actives:${NC} $active_sessions"

# Statistiques des fichiers traités
files_today=$(lxc_exec "find $APP_DIR/outputs -name '*.wav' -o -name '*.mp3' -newermt 'today' 2>/dev/null | wc -l")
echo -e "${BLUE}Fichiers traités aujourd'hui:${NC} $files_today"

# Espace utilisé par les uploads/outputs
uploads_size=$(lxc_exec "du -sh $APP_DIR/uploads 2>/dev/null | cut -f1 || echo '0B'")
outputs_size=$(lxc_exec "du -sh $APP_DIR/outputs 2>/dev/null | cut -f1 || echo '0B'")
echo -e "${BLUE}Taille uploads:${NC} $uploads_size"
echo -e "${BLUE}Taille outputs:${NC} $outputs_size"

# Actions recommandées si problèmes détectés
echo -e "\n${BLUE}🔧 Actions Disponibles${NC}"
echo "======================="
echo "Redémarrer l'application: sudo -u $APP_USER pm2 restart stereo-tool-processor"
echo "Voir les logs: sudo -u $APP_USER pm2 logs stereo-tool-processor"
echo "Nettoyer les fichiers temporaires: rm -rf $APP_DIR/temp/*"
echo "Redémarrer MySQL: systemctl restart mysql"
echo "Vérifier la configuration: cat $APP_DIR/config.js"

# Script de nettoyage automatique
if [ "$2" = "--cleanup" ]; then
    echo -e "\n${YELLOW}🧹 Nettoyage automatique...${NC}"
    
    # Supprimer les fichiers temporaires anciens
    lxc_exec "find $APP_DIR/temp -type f -mtime +1 -delete 2>/dev/null || true"
    
    # Supprimer les anciens fichiers de sortie (plus de 7 jours)
    lxc_exec "find $APP_DIR/outputs -type f -mtime +7 -delete 2>/dev/null || true"
    
    # Rotation des logs PM2
    lxc_exec "sudo -u $APP_USER pm2 flush"
    
    echo -e "${GREEN}✅ Nettoyage terminé${NC}"
fi

# Résumé final
echo -e "\n${BLUE}📋 Résumé${NC}"
echo "========="
if [ "$mysql_status" = "active" ] && [ "$pm2_status" = "online" ] && [ "$port_check" = "OK" ]; then
    echo -e "${GREEN}✅ Système opérationnel${NC}"
    exit 0
else
    echo -e "${RED}❌ Problèmes détectés - Intervention requise${NC}"
    exit 1
fi 