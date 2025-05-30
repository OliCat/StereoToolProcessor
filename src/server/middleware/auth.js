const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const rateLimit = require('express-rate-limit');
const { User } = require('../models');
const config = require('../../../config');

// Middleware d'authentification JWT
const authenticateToken = async (req, res, next) => {
  try {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (!token) {
      return res.status(401).json({ 
        error: 'Token d\'accès requis', 
        code: 'NO_TOKEN' 
      });
    }

    const decoded = jwt.verify(token, config.security.jwtSecret);
    const user = await User.findByPk(decoded.userId, {
      attributes: { exclude: ['password'] }
    });

    if (!user || !user.isActive) {
      return res.status(401).json({ 
        error: 'Utilisateur non autorisé', 
        code: 'INVALID_USER' 
      });
    }

    req.user = user;
    next();
  } catch (error) {
    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({ 
        error: 'Token expiré', 
        code: 'EXPIRED_TOKEN' 
      });
    }
    
    return res.status(403).json({ 
      error: 'Token invalide', 
      code: 'INVALID_TOKEN' 
    });
  }
};

// Middleware de vérification des rôles
const requireRole = (roles) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ 
        error: 'Authentification requise', 
        code: 'NO_AUTH' 
      });
    }

    if (!roles.includes(req.user.role)) {
      return res.status(403).json({ 
        error: 'Permissions insuffisantes', 
        code: 'INSUFFICIENT_PERMISSIONS' 
      });
    }

    next();
  };
};

// Rate limiting pour les tentatives de connexion
const loginLimiter = rateLimit({
  windowMs: config.limits.rateLimitWindowMs,
  max: 5, // 5 tentatives de connexion par fenêtre
  message: {
    error: 'Trop de tentatives de connexion. Réessayez plus tard.',
    code: 'TOO_MANY_LOGIN_ATTEMPTS'
  },
  standardHeaders: true,
  legacyHeaders: false,
  skipSuccessfulRequests: true
});

// Rate limiting général pour l'API
const apiLimiter = rateLimit({
  windowMs: config.limits.rateLimitWindowMs,
  max: config.limits.rateLimitMaxRequests,
  message: {
    error: 'Trop de requêtes. Réessayez plus tard.',
    code: 'TOO_MANY_REQUESTS'
  },
  standardHeaders: true,
  legacyHeaders: false
});

// Utilitaires pour les mots de passe
const hashPassword = async (password) => {
  return bcrypt.hash(password, config.security.passwordSaltRounds);
};

const comparePassword = async (password, hashedPassword) => {
  return bcrypt.compare(password, hashedPassword);
};

// Génération de tokens JWT
const generateAccessToken = (user) => {
  return jwt.sign(
    { 
      userId: user.id, 
      email: user.email, 
      role: user.role 
    },
    config.security.jwtSecret,
    { expiresIn: '24h' }
  );
};

const generateRefreshToken = (user) => {
  return jwt.sign(
    { userId: user.id },
    config.security.jwtSecret,
    { expiresIn: '7d' }
  );
};

// Validation des emails de domaine autorisé
const validateEmailDomain = (email) => {
  if (config.organization.domain === 'any') {
    return true;
  }
  
  const domain = email.split('@')[1];
  return domain === config.organization.domain;
};

module.exports = {
  authenticateToken,
  requireRole,
  loginLimiter,
  apiLimiter,
  hashPassword,
  comparePassword,
  generateAccessToken,
  generateRefreshToken,
  validateEmailDomain
}; 