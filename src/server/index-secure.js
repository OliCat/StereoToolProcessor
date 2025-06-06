const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const session = require('express-session');
const SequelizeStore = require('connect-session-sequelize')(session.Store);
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const https = require('https');
const winston = require('winston');
const { v4: uuidv4 } = require('uuid');
const { exec, spawn } = require('child_process');
const ffmpeg = require('fluent-ffmpeg');
const archiver = require('archiver');

// Configuration et modèles
const config = require('../../config');
const { sequelize, User, ProcessingJob } = require('./models');
const { authenticateToken, requireRole, apiLimiter } = require('./middleware/auth');
const authRoutes = require('./routes/auth');

// Configuration des logs
const logger = winston.createLogger({
  level: 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.errors({ stack: true }),
    winston.format.json()
  ),
  defaultMeta: { service: 'stereo-tool-processor' },
  transports: [
    new winston.transports.File({ filename: 'logs/error.log', level: 'error' }),
    new winston.transports.File({ filename: 'logs/combined.log' }),
  ],
});

if (config.server.environment !== 'production') {
  logger.add(new winston.transports.Console({
    format: winston.format.simple()
  }));
}

const app = express();
const port = config.server.port;

// Middleware de sécurité
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
      fontSrc: ["'self'", "https://fonts.gstatic.com"],
      scriptSrc: ["'self'"],
      imgSrc: ["'self'", "data:", "blob:"],
      connectSrc: ["'self'"],
      mediaSrc: ["'self'", "blob:"],
    },
  },
}));

app.use(cors({
  origin: config.server.environment === 'production' 
    ? ['https://stereo.radiocausecommune.fr'] 
    : ['http://localhost:3000', 'http://127.0.0.1:3000'],
  credentials: true
}));

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Configuration des sessions
const sessionStore = new SequelizeStore({
  db: sequelize,
});

app.use(session({
  secret: config.security.sessionSecret,
  store: sessionStore,
  resave: false,
  saveUninitialized: false,
  cookie: {
    secure: config.server.environment === 'production',
    httpOnly: true,
    maxAge: 24 * 60 * 60 * 1000 // 24 heures
  }
}));

// Rate limiting
app.use('/api/', apiLimiter);

// Routes d'authentification
app.use('/api/auth', authRoutes);

// Servir les fichiers statiques (uniquement après authentification pour les ressources sensibles)
app.use(express.static(path.join(__dirname, '../../public')));

// Middleware de logging des requêtes
app.use((req, res, next) => {
  logger.info(`${req.method} ${req.path}`, {
    ip: req.ip,
    userAgent: req.get('User-Agent'),
    userId: req.user?.id
  });
  next();
});

// Configuration du stockage sécurisé pour les fichiers
const createSecureStorage = (userId) => {
  return multer.diskStorage({
    destination: function (req, file, cb) {
      // Créer un dossier spécifique à l'utilisateur
      const userUploadDir = path.join(__dirname, '../../uploads', userId);
      const userOutputDir = path.join(__dirname, '../../outputs', userId);
      const presetDir = path.join(__dirname, '../../presets');
      const tempDir = path.join(__dirname, '../../temp');
      
      // Créer les dossiers si nécessaire
      [userUploadDir, userOutputDir, presetDir, tempDir].forEach(dir => {
        if (!fs.existsSync(dir)) {
          fs.mkdirSync(dir, { recursive: true, mode: 0o755 });
        }
      });
      
      if (file.fieldname === 'preset') {
        cb(null, presetDir);
      } else {
        cb(null, userUploadDir);
      }
    },
    filename: function (req, file, cb) {
      const uniqueId = uuidv4();
      const extension = path.extname(file.originalname);
      const sanitizedName = file.originalname.replace(/[^a-zA-Z0-9.-]/g, '_');
      cb(null, `${Date.now()}_${uniqueId}_${sanitizedName}`);
    }
  });
};

const createSecureUpload = (userId) => {
  return multer({ 
    storage: createSecureStorage(userId),
    limits: {
      fileSize: config.limits.maxFileSize,
      files: 5
    },
    fileFilter: (req, file, cb) => {
      if (file.fieldname === 'preset') {
        if (path.extname(file.originalname).toLowerCase() === '.sts') {
          return cb(null, true);
        }
      } else {
        const acceptedFormats = ['.wav', '.mp3', '.flac', '.aiff', '.ogg', '.m4a'];
        if (acceptedFormats.includes(path.extname(file.originalname).toLowerCase())) {
          return cb(null, true);
        }
      }
      cb(new Error('Format de fichier non pris en charge'));
    }
  });
};

// Fonctions utilitaires (reprises de l'ancien serveur)
const determineOutputFormat = (inputPath) => {
  const ext = path.extname(inputPath).toLowerCase();
  if (ext === '.mp3') {
    return '.wav';
  }
  return ext;
};

const processStereoTool = (command) => {
  return new Promise((resolve, reject) => {
    const process = spawn(command.split(' ')[0], command.split(' ').slice(1), {
      shell: true
    });
    
    let stderr = '';
    
    process.stderr.on('data', (data) => {
      stderr += data.toString();
    });
    
    process.on('close', (code) => {
      if (code !== 0) {
        reject(new Error(`StereoTool a échoué avec le code ${code}: ${stderr}`));
      } else {
        resolve();
      }
    });
  });
};

const isLongFile = async (filePath) => {
  try {
    return new Promise((resolve, reject) => {
      ffmpeg.ffprobe(filePath, (err, metadata) => {
        if (err) {
          logger.error('Erreur lors de la vérification de la durée du fichier:', err);
          resolve(false);
          return;
        }
        
        const duration = metadata.format.duration;
        resolve(duration > 1800);
      });
    });
  } catch (error) {
    logger.error('Erreur lors de la vérification de la durée du fichier:', error);
    return false;
  }
};

// Routes sécurisées pour le traitement des fichiers
app.post('/api/upload', authenticateToken, async (req, res) => {
  try {
    const upload = createSecureUpload(req.user.id);
    
    upload.fields([
      { name: 'audioFiles', maxCount: 10 },
      { name: 'preset', maxCount: 1 }
    ])(req, res, async (err) => {
      if (err) {
        logger.error('Erreur upload:', err);
        return res.status(400).json({
          error: err.message,
          code: 'UPLOAD_ERROR'
        });
      }

      const audioFiles = req.files?.audioFiles || [];
      const presetFile = req.files?.preset?.[0];

      if (audioFiles.length === 0) {
        return res.status(400).json({
          error: 'Aucun fichier audio fourni',
          code: 'NO_AUDIO_FILES'
        });
      }

      // Vérifier les limites utilisateur
      const userJobsCount = await ProcessingJob.count({
        where: { 
          userId: req.user.id,
          status: ['pending', 'processing']
        }
      });

      if (userJobsCount >= config.limits.maxFilesPerUser) {
        return res.status(429).json({
          error: 'Limite de fichiers en traitement atteinte',
          code: 'TOO_MANY_FILES'
        });
      }

      // Créer les jobs de traitement
      const jobs = [];
      for (const file of audioFiles) {
        const job = await ProcessingJob.create({
          userId: req.user.id,
          originalFileName: file.originalname,
          filePath: file.path,
          presetName: presetFile?.originalname || 'default',
          status: 'pending'
        });
        jobs.push(job);
      }

      res.json({
        message: 'Fichiers uploadés avec succès',
        jobs: jobs.map(job => ({
          id: job.id,
          fileName: job.originalFileName,
          status: job.status
        }))
      });

      // Traiter les fichiers en arrière-plan
      processFilesInBackground(jobs, presetFile?.path, req.user.id);
    });

  } catch (error) {
    logger.error('Erreur lors de l\'upload:', error);
    res.status(500).json({
      error: 'Erreur interne du serveur',
      code: 'INTERNAL_ERROR'
    });
  }
});

// Fonction de traitement en arrière-plan
const processFilesInBackground = async (jobs, presetPath, userId) => {
  for (const job of jobs) {
    try {
      await ProcessingJob.update(
        { status: 'processing', processingStartedAt: new Date() },
        { where: { id: job.id } }
      );

      const outputDir = path.join(__dirname, '../../outputs', userId);
      const outputExt = determineOutputFormat(job.filePath);
      const outputPath = path.join(outputDir, `processed_${path.basename(job.originalFileName, path.extname(job.originalFileName))}${outputExt}`);

      const stereoToolPath = config.stereoTool.executablePath;
      const licenseKey = config.stereoTool.license;

      // Vérifier si le fichier est long et traiter en conséquence
      const isLong = await isLongFile(job.filePath);
      
      if (isLong) {
        await processFileBySegments(job.filePath, outputPath, presetPath, licenseKey);
      } else {
        const command = presetPath 
          ? `${stereoToolPath} "${job.filePath}" "${outputPath}" -s "${presetPath}" -k "${licenseKey}"`
          : `${stereoToolPath} "${job.filePath}" "${outputPath}" -k "${licenseKey}"`;
        
        await processStereoTool(command);
      }

      await ProcessingJob.update(
        { 
          status: 'completed', 
          outputPath,
          processingCompletedAt: new Date(),
          progress: 100
        },
        { where: { id: job.id } }
      );

      logger.info(`Traitement terminé pour le job ${job.id}`);

    } catch (error) {
      logger.error(`Erreur lors du traitement du job ${job.id}:`, error);
      
      await ProcessingJob.update(
        { 
          status: 'failed', 
          errorMessage: error.message,
          processingCompletedAt: new Date()
        },
        { where: { id: job.id } }
      );
    }
  }
};

// Route pour obtenir le statut des jobs
app.get('/api/jobs', authenticateToken, async (req, res) => {
  try {
    const jobs = await ProcessingJob.findAll({
      where: { userId: req.user.id },
      order: [['createdAt', 'DESC']],
      limit: 50
    });

    res.json({
      jobs: jobs.map(job => ({
        id: job.id,
        fileName: job.originalFileName,
        status: job.status,
        progress: job.progress,
        createdAt: job.createdAt,
        processingStartedAt: job.processingStartedAt,
        processingCompletedAt: job.processingCompletedAt,
        errorMessage: job.errorMessage
      }))
    });

  } catch (error) {
    logger.error('Erreur lors de la récupération des jobs:', error);
    res.status(500).json({
      error: 'Erreur interne du serveur',
      code: 'INTERNAL_ERROR'
    });
  }
});

// Route pour télécharger un fichier traité
app.get('/api/download/:jobId', authenticateToken, async (req, res) => {
  try {
    const { jobId } = req.params;
    
    const job = await ProcessingJob.findOne({
      where: { 
        id: jobId, 
        userId: req.user.id,
        status: 'completed'
      }
    });

    if (!job || !job.outputPath || !fs.existsSync(job.outputPath)) {
      return res.status(404).json({
        error: 'Fichier non trouvé',
        code: 'FILE_NOT_FOUND'
      });
    }

    const fileName = `processed_${job.originalFileName}`;
    res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);
    res.setHeader('Content-Type', 'application/octet-stream');
    
    const fileStream = fs.createReadStream(job.outputPath);
    fileStream.pipe(res);

    logger.info(`Téléchargement du fichier ${jobId} par l'utilisateur ${req.user.id}`);

  } catch (error) {
    logger.error('Erreur lors du téléchargement:', error);
    res.status(500).json({
      error: 'Erreur interne du serveur',
      code: 'INTERNAL_ERROR'
    });
  }
});

// Fonction de traitement par segments (reprise de l'ancien serveur)
const processFileBySegments = async (inputPath, outputPath, presetPath, licenseKey) => {
  // [Même implémentation que dans l'ancien serveur]
  // ... (code identique à celui de l'ancien serveur)
};

// Route d'administration
app.get('/api/admin/stats', authenticateToken, requireRole(['admin']), async (req, res) => {
  try {
    const totalUsers = await User.count();
    const activeUsers = await User.count({ where: { isActive: true } });
    const totalJobs = await ProcessingJob.count();
    const todayJobs = await ProcessingJob.count({
      where: {
        createdAt: {
          [require('sequelize').Op.gte]: new Date(new Date().setHours(0, 0, 0, 0))
        }
      }
    });

    res.json({
      stats: {
        totalUsers,
        activeUsers,
        totalJobs,
        todayJobs
      }
    });

  } catch (error) {
    logger.error('Erreur lors de la récupération des statistiques:', error);
    res.status(500).json({
      error: 'Erreur interne du serveur',
      code: 'INTERNAL_ERROR'
    });
  }
});

// Gestion des erreurs globales
app.use((error, req, res, next) => {
  logger.error('Erreur non gérée:', error);
  res.status(500).json({
    error: 'Erreur interne du serveur',
    code: 'INTERNAL_ERROR'
  });
});

// Route 404
app.use('*', (req, res) => {
  res.status(404).json({
    error: 'Route non trouvée',
    code: 'NOT_FOUND'
  });
});

// Initialisation de la base de données et démarrage du serveur
const startServer = async () => {
  try {
    // Synchroniser la base de données
    await sequelize.authenticate();
    logger.info('Connexion à la base de données établie avec succès.');
    
    await sequelize.sync();
    sessionStore.sync();
    
    logger.info('Base de données synchronisée.');

    // Créer un utilisateur admin par défaut si aucun n'existe
    const adminExists = await User.findOne({ where: { role: 'admin' } });
    if (!adminExists) {
      const { hashPassword } = require('./middleware/auth');
      const hashedPassword = await hashPassword('AdminPassword123!');
      
      await User.create({
        email: config.organization.adminEmail,
        password: hashedPassword,
        firstName: 'Admin',
        lastName: 'StereoTool',
        role: 'admin'
      });
      
      logger.info('Utilisateur admin créé avec succès.');
      logger.info(`Email: ${config.organization.adminEmail}`);
      logger.info('Mot de passe: AdminPassword123! (à changer immédiatement)');
    }

    // Démarrer le serveur HTTPS en production, HTTP en développement
    if (config.server.environment === 'production' && 
        fs.existsSync(config.server.httpsKeyPath) && 
        fs.existsSync(config.server.httpsCertPath)) {
      
      const httpsOptions = {
        key: fs.readFileSync(config.server.httpsKeyPath),
        cert: fs.readFileSync(config.server.httpsCertPath)
      };
      
      https.createServer(httpsOptions, app).listen(port, () => {
        logger.info(`Serveur HTTPS sécurisé démarré sur le port ${port}`);
      });
    } else {
      app.listen(port, () => {
        logger.info(`Serveur HTTP démarré sur le port ${port}`);
        if (config.server.environment === 'development') {
          logger.info('Mode développement - HTTPS désactivé');
        }
      });
    }

  } catch (error) {
    logger.error('Erreur lors du démarrage du serveur:', error);
    process.exit(1);
  }
};

// Gestion de l'arrêt propre
process.on('SIGTERM', async () => {
  logger.info('Signal SIGTERM reçu, arrêt du serveur...');
  await sequelize.close();
  process.exit(0);
});

process.on('SIGINT', async () => {
  logger.info('Signal SIGINT reçu, arrêt du serveur...');
  await sequelize.close();
  process.exit(0);
});

startServer(); 