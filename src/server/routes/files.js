const express = require('express');
const fs = require('fs').promises;
const path = require('path');
const ffmpeg = require('fluent-ffmpeg');
const { authenticateToken } = require('../middleware/auth');

const router = express.Router();

// Chemins des dossiers
const UPLOADS_DIR = path.join(__dirname, '../../../uploads');
const OUTPUTS_DIR = path.join(__dirname, '../../../outputs');
const TEMP_DIR = path.join(__dirname, '../../../temp');

// Helper pour formater la taille des fichiers
const formatFileSize = (bytes) => {
  if (bytes === 0) return '0 o';
  const k = 1024;
  const sizes = ['o', 'Ko', 'Mo', 'Go'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
};

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

// Route pour lister les fichiers traités
router.get('/', authenticateToken, async (req, res) => {
  try {
    await fs.access(OUTPUTS_DIR);
    const files = await fs.readdir(OUTPUTS_DIR);
    
    const fileList = [];
    
    for (const file of files) {
      try {
        const filePath = path.join(OUTPUTS_DIR, file);
        const stats = await fs.stat(filePath);
        
        if (stats.isFile()) {
          fileList.push({
            filename: file,
            size: stats.size,
            formattedSize: formatFileSize(stats.size),
            createdAt: stats.birthtime,
            modifiedAt: stats.mtime
          });
        }
      } catch (err) {
        // Ignorer les fichiers inaccessibles
        continue;
      }
    }
    
    // Trier par date de création (plus récent en premier)
    fileList.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    
    res.json({
      files: fileList,
      count: fileList.length
    });
    
  } catch (error) {
    if (error.code === 'ENOENT') {
      res.json({
        files: [],
        count: 0
      });
    } else {
      console.error('Erreur lors de la lecture des fichiers:', error);
      res.status(500).json({
        error: 'Erreur lors de la lecture des fichiers'
      });
    }
  }
});

// Route pour supprimer un fichier
router.delete('/:filename', authenticateToken, async (req, res) => {
  try {
    const filename = decodeURIComponent(req.params.filename);
    const filePath = path.join(OUTPUTS_DIR, filename);
    
    // Vérifier que le fichier existe et est dans le bon dossier
    await fs.access(filePath);
    
    // Vérifier que le chemin ne sort pas du dossier de sortie
    const resolvedPath = path.resolve(filePath);
    const resolvedOutputsDir = path.resolve(OUTPUTS_DIR);
    
    if (!resolvedPath.startsWith(resolvedOutputsDir)) {
      return res.status(400).json({
        error: 'Chemin de fichier non autorisé'
      });
    }
    
    await fs.unlink(filePath);
    
    res.json({
      message: `Fichier ${filename} supprimé avec succès`
    });
    
  } catch (error) {
    if (error.code === 'ENOENT') {
      res.status(404).json({
        error: 'Fichier non trouvé'
      });
    } else {
      console.error('Erreur lors de la suppression du fichier:', error);
      res.status(500).json({
        error: 'Erreur lors de la suppression du fichier'
      });
    }
  }
});

// Route pour nettoyer les fichiers importés
router.post('/clean-uploads', authenticateToken, async (req, res) => {
  try {
    await fs.access(UPLOADS_DIR);
    const files = await fs.readdir(UPLOADS_DIR);
    
    let deletedCount = 0;
    let deletedSize = 0;
    
    for (const file of files) {
      try {
        const filePath = path.join(UPLOADS_DIR, file);
        const stats = await fs.stat(filePath);
        
        if (stats.isFile()) {
          deletedSize += stats.size;
          await fs.unlink(filePath);
          deletedCount++;
        }
      } catch (err) {
        // Ignorer les fichiers inaccessibles
        continue;
      }
    }
    
    res.json({
      message: `${deletedCount} fichier(s) importé(s) supprimé(s) (${formatFileSize(deletedSize)} libéré(s))`,
      deletedCount,
      deletedSize
    });
    
  } catch (error) {
    if (error.code === 'ENOENT') {
      res.json({
        message: 'Aucun fichier à nettoyer',
        deletedCount: 0,
        deletedSize: 0
      });
    } else {
      console.error('Erreur lors du nettoyage des fichiers importés:', error);
      res.status(500).json({
        error: 'Erreur lors du nettoyage des fichiers importés'
      });
    }
  }
});

// Route pour télécharger plusieurs fichiers en ZIP
router.post('/download-multiple', authenticateToken, async (req, res) => {
  try {
    const { filenames } = req.body;
    
    if (!filenames || !Array.isArray(filenames) || filenames.length === 0) {
      return res.status(400).json({
        error: 'Liste de fichiers requise'
      });
    }
    
    const archiver = require('archiver');
    const archive = archiver('zip', {
      zlib: { level: 9 }
    });
    
    archive.on('error', (err) => {
      console.error('Erreur lors de la création du ZIP:', err);
      res.status(500).json({
        error: 'Erreur lors de la création du ZIP'
      });
    });
    
    const zipFilename = `stereo-tool-files-${Date.now()}.zip`;
    
    res.setHeader('Content-Type', 'application/zip');
    res.setHeader('Content-Disposition', `attachment; filename="${zipFilename}"`);
    
    archive.pipe(res);
    
    // Ajouter chaque fichier au ZIP
    for (const filename of filenames) {
      try {
        const filePath = path.join(OUTPUTS_DIR, filename);
        const resolvedPath = path.resolve(filePath);
        const resolvedOutputsDir = path.resolve(OUTPUTS_DIR);
        
        // Vérifier que le chemin ne sort pas du dossier de sortie
        if (!resolvedPath.startsWith(resolvedOutputsDir)) {
          continue;
        }
        
        await fs.access(filePath);
        archive.file(filePath, { name: filename });
      } catch (err) {
        // Ignorer les fichiers inaccessibles
        continue;
      }
    }
    
    archive.finalize();
    
  } catch (error) {
    console.error('Erreur lors du téléchargement multiple:', error);
    res.status(500).json({
      error: 'Erreur lors du téléchargement multiple'
    });
  }
});

// Route pour obtenir les métadonnées d'un fichier
router.get('/:filename/metadata', authenticateToken, async (req, res) => {
  try {
    const filename = decodeURIComponent(req.params.filename);
    const filePath = path.join(OUTPUTS_DIR, filename);
    
    // Vérifier que le fichier existe
    await fs.access(filePath);
    
    // Récupérer les métadonnées avec ffprobe
    const metadata = await new Promise((resolve, reject) => {
      ffmpeg.ffprobe(filePath, (err, data) => {
        if (err) {
          reject(err);
          return;
        }
        resolve(data);
      });
    });
    
    // Extraire les métadonnées pertinentes
    const tags = metadata.format.tags || {};
    
    const extractedMetadata = {
      trackNumber: tags.track || '',
      album: tags.album || '',
      title: tags.title || filename.replace(/^processed_\d+_[a-f0-9-]+_/, '').replace(/\.[^/.]+$/, ''),
      artist: tags.artist || '',
      duration: metadata.format.duration || 0,
      sampleRate: metadata.streams[0]?.sample_rate || '',
      channels: metadata.streams[0]?.channels || ''
    };
    
    res.json({
      filename,
      metadata: extractedMetadata
    });
    
  } catch (error) {
    if (error.code === 'ENOENT') {
      res.status(404).json({
        error: 'Fichier non trouvé'
      });
    } else {
      console.error('Erreur lors de la lecture des métadonnées:', error);
      res.status(500).json({
        error: 'Erreur lors de la lecture des métadonnées'
      });
    }
  }
});

// Route pour mettre à jour les métadonnées d'un fichier
router.put('/:filename/metadata', authenticateToken, async (req, res) => {
  try {
    const filename = decodeURIComponent(req.params.filename);
    const { trackNumber, album, title, artist } = req.body;
    
    if (!trackNumber || !album || !title || !artist) {
      return res.status(400).json({ error: 'Tous les champs de métadonnées sont requis' });
    }
    
    const filePath = path.join(OUTPUTS_DIR, filename);
    
    // Vérifier que le fichier existe
    await fs.access(filePath);
    
    // Format du nouveau nom: "N° de Piste - ALBUM - TITRE - Artiste.wav"
    // Éviter les caractères spéciaux dans le nom de fichier
    const sanitizedFilename = `${trackNumber.padStart(2, '0')} - ${album} - ${title} - ${artist}`
      .replace(/[\/\\:*?"<>|]/g, '-') // Remplacer les caractères interdits par des tirets
      .trim();
    
    const extension = path.extname(filename);
    const newFilename = `${sanitizedFilename}${extension}`;
    const newFilePath = path.join(OUTPUTS_DIR, newFilename);
    
    // Appliquer les métadonnées avec ffmpeg
    const ffmpegCommand = ffmpeg(filePath);
    
    // Copier l'audio sans le recompresser
    ffmpegCommand.outputOptions('-c:a copy');
    
    // Ajouter les métadonnées individuellement (de cette façon on évite les problèmes d'espaces)
    ffmpegCommand.outputOptions('-metadata', `track=${trackNumber}`);
    ffmpegCommand.outputOptions('-metadata', `album=${album}`);
    ffmpegCommand.outputOptions('-metadata', `title=${title}`);
    ffmpegCommand.outputOptions('-metadata', `artist=${artist}`);
    
    // Définir le fichier de sortie
    ffmpegCommand.output(newFilePath);
    
    // Exécuter la commande
    await new Promise((resolve, reject) => {
      ffmpegCommand
        .on('end', resolve)
        .on('error', reject)
        .run();
    });
    
    // Supprimer le fichier original si les noms sont différents
    if (filePath !== newFilePath) {
      await fs.unlink(filePath);
    }
    
    res.json({
      message: 'Métadonnées appliquées et fichier renommé avec succès',
      newFilename,
      newDownloadUrl: `/api/download/${encodeURIComponent(newFilename)}`
    });
    
  } catch (error) {
    if (error.code === 'ENOENT') {
      res.status(404).json({
        error: 'Fichier non trouvé'
      });
    } else {
      console.error('Erreur lors de la mise à jour des métadonnées:', error);
      res.status(500).json({
        error: 'Erreur lors de la mise à jour des métadonnées'
      });
    }
  }
});

module.exports = router; 