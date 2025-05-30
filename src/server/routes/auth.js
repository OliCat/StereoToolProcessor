const express = require('express');
const { User } = require('../models');
const {
  hashPassword,
  comparePassword,
  generateAccessToken,
  generateRefreshToken,
  validateEmailDomain,
  loginLimiter,
  authenticateToken,
  requireRole
} = require('../middleware/auth');

const router = express.Router();

// Route de connexion
router.post('/login', loginLimiter, async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({
        error: 'Email et mot de passe requis',
        code: 'MISSING_CREDENTIALS'
      });
    }

    const user = await User.findOne({ where: { email: email.toLowerCase() } });

    if (!user || !user.isActive) {
      return res.status(401).json({
        error: 'Identifiants invalides',
        code: 'INVALID_CREDENTIALS'
      });
    }

    const isPasswordValid = await comparePassword(password, user.password);

    if (!isPasswordValid) {
      return res.status(401).json({
        error: 'Identifiants invalides',
        code: 'INVALID_CREDENTIALS'
      });
    }

    // Mettre à jour la dernière connexion
    await user.update({ lastLogin: new Date() });

    const accessToken = generateAccessToken(user);
    const refreshToken = generateRefreshToken(user);

    res.json({
      message: 'Connexion réussie',
      user: {
        id: user.id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        role: user.role
      },
      accessToken,
      refreshToken
    });

  } catch (error) {
    console.error('Erreur lors de la connexion:', error);
    res.status(500).json({
      error: 'Erreur interne du serveur',
      code: 'INTERNAL_ERROR'
    });
  }
});

// Route d'inscription (pour les administrateurs uniquement)
router.post('/register', authenticateToken, requireRole(['admin']), async (req, res) => {
  try {
    const { email, password, firstName, lastName, role = 'user' } = req.body;

    if (!email || !password || !firstName || !lastName) {
      return res.status(400).json({
        error: 'Tous les champs sont requis',
        code: 'MISSING_FIELDS'
      });
    }

    if (password.length < 8) {
      return res.status(400).json({
        error: 'Le mot de passe doit contenir au moins 8 caractères',
        code: 'PASSWORD_TOO_SHORT'
      });
    }

    if (!validateEmailDomain(email)) {
      return res.status(400).json({
        error: 'Domaine email non autorisé',
        code: 'INVALID_EMAIL_DOMAIN'
      });
    }

    const existingUser = await User.findOne({ 
      where: { email: email.toLowerCase() } 
    });

    if (existingUser) {
      return res.status(409).json({
        error: 'Un utilisateur avec cet email existe déjà',
        code: 'EMAIL_EXISTS'
      });
    }

    const hashedPassword = await hashPassword(password);

    const user = await User.create({
      email: email.toLowerCase(),
      password: hashedPassword,
      firstName,
      lastName,
      role: ['admin', 'user', 'guest'].includes(role) ? role : 'user'
    });

    res.status(201).json({
      message: 'Utilisateur créé avec succès',
      user: {
        id: user.id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        role: user.role
      }
    });

  } catch (error) {
    console.error('Erreur lors de l\'inscription:', error);
    res.status(500).json({
      error: 'Erreur interne du serveur',
      code: 'INTERNAL_ERROR'
    });
  }
});

// Route pour obtenir le profil utilisateur
router.get('/profile', authenticateToken, async (req, res) => {
  try {
    res.json({
      user: {
        id: req.user.id,
        email: req.user.email,
        firstName: req.user.firstName,
        lastName: req.user.lastName,
        role: req.user.role,
        lastLogin: req.user.lastLogin,
        createdAt: req.user.createdAt
      }
    });
  } catch (error) {
    console.error('Erreur lors de la récupération du profil:', error);
    res.status(500).json({
      error: 'Erreur interne du serveur',
      code: 'INTERNAL_ERROR'
    });
  }
});

// Route pour modifier le mot de passe
router.put('/change-password', authenticateToken, async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;

    if (!currentPassword || !newPassword) {
      return res.status(400).json({
        error: 'Mot de passe actuel et nouveau mot de passe requis',
        code: 'MISSING_PASSWORDS'
      });
    }

    if (newPassword.length < 8) {
      return res.status(400).json({
        error: 'Le nouveau mot de passe doit contenir au moins 8 caractères',
        code: 'PASSWORD_TOO_SHORT'
      });
    }

    const user = await User.findByPk(req.user.id);
    const isCurrentPasswordValid = await comparePassword(currentPassword, user.password);

    if (!isCurrentPasswordValid) {
      return res.status(401).json({
        error: 'Mot de passe actuel incorrect',
        code: 'INVALID_CURRENT_PASSWORD'
      });
    }

    const hashedNewPassword = await hashPassword(newPassword);
    await user.update({ password: hashedNewPassword });

    res.json({
      message: 'Mot de passe modifié avec succès'
    });

  } catch (error) {
    console.error('Erreur lors du changement de mot de passe:', error);
    res.status(500).json({
      error: 'Erreur interne du serveur',
      code: 'INTERNAL_ERROR'
    });
  }
});

// Route pour lister les utilisateurs (admin uniquement)
router.get('/users', authenticateToken, requireRole(['admin']), async (req, res) => {
  try {
    const { page = 1, limit = 10, search } = req.query;
    const offset = (page - 1) * limit;

    const whereClause = search ? {
      [require('sequelize').Op.or]: [
        { firstName: { [require('sequelize').Op.like]: `%${search}%` } },
        { lastName: { [require('sequelize').Op.like]: `%${search}%` } },
        { email: { [require('sequelize').Op.like]: `%${search}%` } }
      ]
    } : {};

    const { count, rows: users } = await User.findAndCountAll({
      where: whereClause,
      attributes: { exclude: ['password'] },
      order: [['createdAt', 'DESC']],
      limit: parseInt(limit),
      offset
    });

    res.json({
      users,
      pagination: {
        current: parseInt(page),
        total: Math.ceil(count / limit),
        count
      }
    });

  } catch (error) {
    console.error('Erreur lors de la récupération des utilisateurs:', error);
    res.status(500).json({
      error: 'Erreur interne du serveur',
      code: 'INTERNAL_ERROR'
    });
  }
});

// Route pour activer/désactiver un utilisateur (admin uniquement)
router.put('/users/:userId/toggle', authenticateToken, requireRole(['admin']), async (req, res) => {
  try {
    const { userId } = req.params;

    if (userId === req.user.id) {
      return res.status(400).json({
        error: 'Vous ne pouvez pas modifier votre propre statut',
        code: 'CANNOT_MODIFY_SELF'
      });
    }

    const user = await User.findByPk(userId);

    if (!user) {
      return res.status(404).json({
        error: 'Utilisateur non trouvé',
        code: 'USER_NOT_FOUND'
      });
    }

    await user.update({ isActive: !user.isActive });

    res.json({
      message: `Utilisateur ${user.isActive ? 'activé' : 'désactivé'} avec succès`,
      user: {
        id: user.id,
        email: user.email,
        isActive: user.isActive
      }
    });

  } catch (error) {
    console.error('Erreur lors de la modification du statut utilisateur:', error);
    res.status(500).json({
      error: 'Erreur interne du serveur',
      code: 'INTERNAL_ERROR'
    });
  }
});

// Route de déconnexion (pour invalider le token côté client)
router.post('/logout', authenticateToken, (req, res) => {
  res.json({
    message: 'Déconnexion réussie'
  });
});

module.exports = router; 