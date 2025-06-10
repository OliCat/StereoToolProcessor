const express = require('express');
const fs = require('fs').promises;
const path = require('path');
const { authenticateToken } = require('../middleware/auth');

const router = express.Router();

// Chemins des dossiers
const UPLOADS_DIR = path.join(__dirname, '../../uploads');
const OUTPUTS_DIR = path.join(__dirname, '../../outputs');
const TEMP_DIR = path.join(__dirname, '../../temp');

// Helper pour obtenir les stats d'un dossier
const getDirStats = async (dirPath) => {
  try {
    await fs.access(dirPath);
    const files = await fs.readdir(dirPath);
    let totalSize = 0;
    let count = 0;

    for (const file of files) {
      try {
        const filePath = path.join(dirPath, file);
        const stats = await fs.stat(filePath);
        if (stats.isFile()) {
          totalSize += stats.size;
          count++;
        }
      } catch (err) {
        // Ignorer les fichiers inaccessibles
        continue;
      }
    }

    return { count, size: totalSize };
  } catch (error) {
    return { count: 0, size: 0 };
  }
};

// Route pour les statistiques d'utilisation du disque
router.get('/', authenticateToken, async (req, res) => {
  try {
    const [uploads, outputs, temp] = await Promise.all([
      getDirStats(UPLOADS_DIR),
      getDirStats(OUTPUTS_DIR),
      getDirStats(TEMP_DIR)
    ]);

    res.json({
      stats: {
        uploads,
        outputs,
        temp,
        total: {
          count: uploads.count + outputs.count + temp.count,
          size: uploads.size + outputs.size + temp.size
        }
      }
    });
    
  } catch (error) {
    console.error('Erreur lors de la récupération des statistiques:', error);
    res.status(500).json({
      error: 'Erreur lors de la récupération des statistiques'
    });
  }
});

module.exports = router; 