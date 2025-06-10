#!/bin/bash

# Script de déploiement LXC pour StereoTool Processor
# Architecture: Nginx (front public) -> LXC Debian (app privée)

set -e

# Variables de configuration
CTID="200"  # ID du container (ajustez selon vos besoins)
HOSTNAME="stereo-app"
MEMORY="4096"  # 4GB RAM
CORES="4"
DISK_SIZE="50"  # 50GB
BRIDGE="vmbr1"  # Bridge réseau privé
IP_ADDRESS="10.10.10.50"  # IP privée
GATEWAY="10.10.10.1"  # Gateway du réseau privé
NAMESERVER="8.8.8.8"

# Template Debian (ajustez selon vos templates disponibles)
TEMPLATE="local:vztmpl/debian-12-standard_12.2-1_amd64.tar.zst"

echo "🚀 Création du container LXC pour StereoTool Processor..."

# Création du container LXC
pct create $CTID $TEMPLATE \
  --hostname $HOSTNAME \
  --memory $MEMORY \
  --cores $CORES \
  --rootfs local-lvm:$DISK_SIZE \
  --net0 name=eth0,bridge=$BRIDGE,ip=$IP_ADDRESS/24,gw=$GATEWAY \
  --nameserver $NAMESERVER \
  --features nesting=1,mount=nfs;cifs \
  --unprivileged 1 \
  --onboot 1 \
  --start 1

echo "✅ Container $CTID créé avec succès"

# Attendre que le container soit complètement démarré
sleep 10

echo "🔧 Configuration initiale du container..."

# Mise à jour du système
pct exec $CTID -- bash -c "apt update && apt upgrade -y"
pct exec $CTID -- bash -c "apt install -y curl wget git nano htop sudo ufw fail2ban logrotate"

echo "✅ Configuration de base terminée"
echo "🎯 Container LXC prêt à l'adresse: $IP_ADDRESS"
echo ""
echo "Prochaines étapes:"
echo "1. Exécuter le script d'installation de l'application: ./install-app-in-lxc.sh $CTID"
echo "2. Configurer nginx sur le serveur front avec l'IP: $IP_ADDRESS" 