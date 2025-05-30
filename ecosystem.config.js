module.exports = {
  apps: [{
    name: 'stereo-tool-processor',
    script: 'src/server/index-secure.js',
    instances: 'max', // Utilise tous les cœurs CPU disponibles
    exec_mode: 'cluster',
    watch: false,
    max_memory_restart: '1G',
    min_uptime: '10s',
    max_restarts: 10,
    restart_delay: 4000,
    env: {
      NODE_ENV: 'development',
      PORT: 3000
    },
    env_production: {
      NODE_ENV: 'production',
      PORT: 3000
    },
    error_file: './logs/err.log',
    out_file: './logs/out.log',
    log_file: './logs/combined.log',
    time: true,
    log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
    merge_logs: true,
    kill_timeout: 5000,
    wait_ready: true,
    listen_timeout: 10000,
    
    // Configuration avancée pour la production
    node_args: '--max-old-space-size=1024',
    
    // Variables d'environnement spécifiques
    env_variables: {
      // Ces variables peuvent être surchargées par le système
      TERM: 'xterm-256color'
    }
  }],

  // Configuration du déploiement (optionnel)
  deploy: {
    production: {
      user: 'stereo-app',
      host: 'stereo.radiocausecommune.fr',
      ref: 'origin/main',
      repo: 'git@github.com:RadioCauseCommune/stereo-tool-processor.git',
      path: '/var/www/stereo-tool-processor',
      'pre-deploy-local': '',
      'post-deploy': 'npm install && npm run build && pm2 reload ecosystem.config.js --env production',
      'pre-setup': ''
    }
  }
}; 