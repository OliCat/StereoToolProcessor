// Configuration pour l'application StereoTool Processor sécurisée
// Copier ce fichier vers config.js et modifier les valeurs

module.exports = {
  // Configuration de la base de données
  database: {
    host: 'localhost',
    port: 3306,
    name: 'stereo_tool_app',
    username: 'stereo_user',
    password: 'your_secure_password_here',
    dialect: 'mysql'
  },

  // Sécurité
  security: {
    jwtSecret: 'your_jwt_secret_here_change_this_in_production',
    sessionSecret: 'your_session_secret_here_change_this_in_production',
    passwordSaltRounds: 12
  },

  // Configuration serveur
  server: {
    port: process.env.PORT || 3000,
    environment: process.env.NODE_ENV || 'development',
    httpsKeyPath: '/path/to/private-key.pem',
    httpsCertPath: '/path/to/certificate.pem'
  },

  // StereoTool
  stereoTool: {
    license: 'your_license_key_here',
    executablePath: './stereo_tool_mac'
  },

  // Organisation
  organization: {
    name: 'Radio Cause Commune',
    adminEmail: 'admin@radiocausecommune.fr',
    domain: 'radiocausecommune.fr'
  },

  // Limites de l'application
  limits: {
    maxFileSize: 2 * 1024 * 1024 * 1024, // 2GB pour les gros fichiers audio
    maxFilesPerUser: 10,
    maxProcessingTime: 120 * 60 * 1000, // 2 heures pour les gros fichiers
    rateLimitWindowMs: 15 * 60 * 1000, // 15 minutes
    rateLimitMaxRequests: 100,
    
    // Nouveaux paramètres pour les gros fichiers
    uploadTimeout: 30 * 60 * 1000, // 30 minutes pour l'upload
    processingTimeout: 120 * 60 * 1000, // 2 heures pour le traitement
    largeFileThreshold: 100 * 1024 * 1024, // 100MB = considéré comme gros fichier
    maxConcurrentUploads: 3
  }
}; 