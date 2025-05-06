const express = require('express');
const cors = require('cors');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { v4: uuidv4 } = require('uuid');
const { exec, spawn } = require('child_process');
const { promisify } = require('util');
const ffmpeg = require('fluent-ffmpeg');
const archiver = require('archiver');
const app = express();
const port = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, '../../public')));

// Configuration du stockage pour les fichiers téléchargés
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    const uploadDir = path.join(__dirname, '../../uploads');
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
    
    const presetDir = path.join(__dirname, '../../presets');
    if (!fs.existsSync(presetDir)) {
      fs.mkdirSync(presetDir, { recursive: true });
    }
    
    const outputDir = path.join(__dirname, '../../outputs');
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
    }
    
    const tempDir = path.join(__dirname, '../../temp');
    if (!fs.existsSync(tempDir)) {
      fs.mkdirSync(tempDir, { recursive: true });
    }
    
    if (file.fieldname === 'preset') {
      cb(null, presetDir);
    } else {
      cb(null, uploadDir);
    }
  },
  filename: function (req, file, cb) {
    const uniqueId = uuidv4();
    const extension = path.extname(file.originalname);
    cb(null, `${uniqueId}${extension}`);
  }
});

const upload = multer({ 
  storage,
  fileFilter: (req, file, cb) => {
    // Accepter plusieurs formats audio
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

// Fonction pour normaliser le format de sortie en fonction du format d'entrée
const determineOutputFormat = (inputPath) => {
  const ext = path.extname(inputPath).toLowerCase();
  // Pour les MP3, on préfère générer du WAV pour éviter les problèmes de compatibilité
  if (ext === '.mp3') {
    return '.wav';
  }
  // Pour les autres formats, on garde le même format
  return ext;
};

// Fonction utilitaire pour exécuter StereoTool
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

// Vérifier si un fichier est long (plus de 30 minutes)
const isLongFile = async (filePath) => {
  try {
    return new Promise((resolve, reject) => {
      ffmpeg.ffprobe(filePath, (err, metadata) => {
        if (err) {
          console.error('Erreur lors de la vérification de la durée du fichier:', err);
          resolve(false); // En cas d'erreur, considérer comme un fichier court
          return;
        }
        
        const duration = metadata.format.duration;
        resolve(duration > 1800); // 30 minutes = 1800 secondes
      });
    });
  } catch (error) {
    console.error('Erreur lors de la vérification de la durée du fichier:', error);
    return false; // En cas d'erreur, considérer comme un fichier court
  }
};

// Traiter un fichier par segments
const processFileBySegments = async (inputPath, outputPath, presetPath, licenseKey) => {
  try {
    const tempDir = path.join(__dirname, '../../temp');
    const baseName = path.basename(inputPath, path.extname(inputPath));
    const outputExt = path.extname(outputPath);
    
    // Étape 1: Diviser le fichier en segments de 10 minutes
    const segmentDuration = 600; // 10 minutes en secondes
    const tempExt = '.wav'; // Utiliser WAV pour le traitement intermédiaire
    const segmentPattern = `${tempDir}/${baseName}_part_%03d${tempExt}`;
    
    await new Promise((resolve, reject) => {
      ffmpeg(inputPath)
        .outputOptions([
          `-f segment`,
          `-segment_time ${segmentDuration}`,
          `-c:a pcm_s16le` // Forcer le format PCM 16bit
        ])
        .output(segmentPattern)
        .on('end', resolve)
        .on('error', reject)
        .run();
    });
    
    // Étape 2: Récupérer la liste des segments
    const segments = fs.readdirSync(tempDir)
      .filter(file => file.startsWith(`${baseName}_part_`))
      .sort();
    
    // Étape 3: Traiter chaque segment avec StereoTool
    const stereoToolPath = './stereo_tool_mac';
    for (const segment of segments) {
      const segmentPath = path.join(tempDir, segment);
      const outputSegmentPath = path.join(tempDir, `processed_${segment}`);
      
      const command = `${stereoToolPath} "${segmentPath}" "${outputSegmentPath}" -s "${presetPath}" -k "${licenseKey}"`;
      await processStereoTool(command);
    }
    
    // Étape 4: Concaténer les segments traités
    const processedSegments = fs.readdirSync(tempDir)
      .filter(file => file.startsWith(`processed_${baseName}_part_`))
      .sort();
    
    // Créer un fichier de liste pour ffmpeg
    const listPath = path.join(tempDir, `${baseName}_list.txt`);
    const fileList = processedSegments.map(file => `file '${path.join(tempDir, file)}'`).join('\n');
    fs.writeFileSync(listPath, fileList);
    
    // Concaténer avec ffmpeg en utilisant des paramètres optimisés pour la compatibilité
    await new Promise((resolve, reject) => {
      let ffmpegCommand = ffmpeg();
      
      ffmpegCommand
        .input(listPath)
        .inputOptions(['-f concat', '-safe 0'])
        .outputOptions([
          '-c:a pcm_s16le', // Format PCM 16 bits, très compatible
          '-ar 44100',      // Fréquence d'échantillonnage standard
          '-map_metadata -1' // Supprimer toutes les métadonnées problématiques
        ])
        .output(outputPath)
        .on('end', resolve)
        .on('error', reject)
        .run();
    });
    
    // Étape 5: Nettoyer les fichiers temporaires
    for (const segment of [...segments, ...processedSegments]) {
      fs.unlinkSync(path.join(tempDir, segment));
    }
    fs.unlinkSync(listPath);
    
    return true;
  } catch (error) {
    console.error('Erreur lors du traitement par segments:', error);
    throw error;
  }
};

// Route pour traiter un fichier unique
app.post('/api/process-file', upload.fields([
  { name: 'audioFile', maxCount: 1 },
  { name: 'preset', maxCount: 1 }
]), async (req, res) => {
  const { licenseKey } = req.body;
  
  if (!req.files || !req.files.audioFile || !req.files.preset || !licenseKey) {
    return res.status(400).json({ error: 'Fichier audio, preset et clé de licence requis' });
  }
  
  try {
    const audioFile = req.files.audioFile[0];
    const preset = req.files.preset[0];
    
    // Déterminer le format de sortie (WAV pour les MP3, même format pour les autres)
    const outputExt = '.wav'; // Toujours générer du WAV pour une meilleure compatibilité
    const outputFilename = `processed_${path.basename(audioFile.filename, path.extname(audioFile.filename))}${outputExt}`;
    const outputPath = path.join(__dirname, '../../outputs', outputFilename);
    
    // Vérifier si le fichier est long (> 30 min)
    const isLong = await isLongFile(audioFile.path);
    
    if (isLong) {
      // Traiter le fichier par segments
      await processFileBySegments(audioFile.path, outputPath, preset.path, licenseKey);
    } else {
      // Pour les fichiers courts, convertir d'abord en WAV si ce n'est pas déjà le cas
      if (path.extname(audioFile.path).toLowerCase() !== '.wav') {
        const tempWavPath = path.join(__dirname, '../../temp', `${path.basename(audioFile.filename, path.extname(audioFile.filename))}.wav`);
        
        await new Promise((resolve, reject) => {
          ffmpeg(audioFile.path)
            .outputOptions([
              '-c:a pcm_s16le', // Format PCM 16 bits
              '-ar 44100'       // Fréquence d'échantillonnage standard
            ])
            .output(tempWavPath)
            .on('end', resolve)
            .on('error', reject)
            .run();
        });
        
        // Traiter avec StereoTool
        const stereoToolPath = './stereo_tool_mac';
        const command = `${stereoToolPath} "${tempWavPath}" "${outputPath}" -s "${preset.path}" -k "${licenseKey}"`;
        await processStereoTool(command);
        
        // Nettoyer le fichier temporaire
        fs.unlinkSync(tempWavPath);
      } else {
        // Traiter directement avec StereoTool pour les fichiers WAV
        const stereoToolPath = './stereo_tool_mac';
        const command = `${stereoToolPath} "${audioFile.path}" "${outputPath}" -s "${preset.path}" -k "${licenseKey}"`;
        await processStereoTool(command);
      }
    }
    
    res.json({
      success: true,
      message: 'Fichier traité avec succès',
      outputFile: `/api/download/${outputFilename}`
    });
  } catch (error) {
    console.error(`Erreur d'exécution:`, error);
    return res.status(500).json({ error: 'Erreur lors du traitement audio', details: error.message });
  }
});

// Route pour traiter des fichiers par lot
app.post('/api/batch-process', upload.fields([
  { name: 'audioFiles', maxCount: 50 },
  { name: 'preset', maxCount: 1 }
]), async (req, res) => {
  const { licenseKey } = req.body;
  
  if (!req.files || !req.files.audioFiles || !req.files.preset || !licenseKey) {
    return res.status(400).json({ error: 'Fichiers audio, preset et clé de licence requis' });
  }
  
  const audioFiles = req.files.audioFiles;
  const preset = req.files.preset[0];
  const results = [];
  
  try {
    // Traiter chaque fichier de manière séquentielle
    for (const audioFile of audioFiles) {
      // Déterminer le format de sortie (WAV pour les MP3, même format pour les autres)
      const outputExt = '.wav'; // Toujours générer du WAV pour une meilleure compatibilité
      const outputFilename = `processed_${path.basename(audioFile.filename, path.extname(audioFile.filename))}${outputExt}`;
      const outputPath = path.join(__dirname, '../../outputs', outputFilename);
      
      try {
        // Vérifier si le fichier est long (> 30 min)
        const isLong = await isLongFile(audioFile.path);
        
        if (isLong) {
          // Traiter le fichier par segments
          await processFileBySegments(audioFile.path, outputPath, preset.path, licenseKey);
        } else {
          // Pour les fichiers courts, convertir d'abord en WAV si ce n'est pas déjà le cas
          if (path.extname(audioFile.path).toLowerCase() !== '.wav') {
            const tempWavPath = path.join(__dirname, '../../temp', `${path.basename(audioFile.filename, path.extname(audioFile.filename))}.wav`);
            
            await new Promise((resolve, reject) => {
              ffmpeg(audioFile.path)
                .outputOptions([
                  '-c:a pcm_s16le', // Format PCM 16 bits
                  '-ar 44100'       // Fréquence d'échantillonnage standard
                ])
                .output(tempWavPath)
                .on('end', resolve)
                .on('error', reject)
                .run();
            });
            
            // Traiter avec StereoTool
            const stereoToolPath = './stereo_tool_mac';
            const command = `${stereoToolPath} "${tempWavPath}" "${outputPath}" -s "${preset.path}" -k "${licenseKey}"`;
            await processStereoTool(command);
            
            // Nettoyer le fichier temporaire
            fs.unlinkSync(tempWavPath);
          } else {
            // Traiter directement avec StereoTool pour les fichiers WAV
            const stereoToolPath = './stereo_tool_mac';
            const command = `${stereoToolPath} "${audioFile.path}" "${outputPath}" -s "${preset.path}" -k "${licenseKey}"`;
            await processStereoTool(command);
          }
        }
        
        results.push({
          filename: audioFile.originalname,
          success: true,
          outputFile: `/api/download/${outputFilename}`
        });
      } catch (error) {
        results.push({
          filename: audioFile.originalname,
          success: false,
          error: error.message
        });
      }
    }
    
    res.json({
      success: true,
      results
    });
  } catch (error) {
    console.error(`Erreur d'exécution:`, error);
    return res.status(500).json({ error: 'Erreur lors du traitement audio', details: error.message });
  }
});

// Route pour télécharger un fichier traité
app.get('/api/download/:filename', (req, res) => {
  const filename = req.params.filename;
  const filePath = path.join(__dirname, '../../outputs', filename);
  
  if (!fs.existsSync(filePath)) {
    return res.status(404).json({ error: 'Fichier non trouvé' });
  }
  
  res.download(filePath);
});

// Route pour supprimer un fichier traité
app.delete('/api/files/:filename', (req, res) => {
  const filename = req.params.filename;
  const filePath = path.join(__dirname, '../../outputs', filename);
  
  try {
    // Vérifier si le fichier existe
    if (!fs.existsSync(filePath)) {
      return res.status(404).json({ error: 'Fichier non trouvé' });
    }
    
    // Supprimer le fichier
    fs.unlinkSync(filePath);
    
    res.json({ success: true, message: 'Fichier supprimé avec succès' });
  } catch (error) {
    console.error('Erreur lors de la suppression du fichier:', error);
    res.status(500).json({ error: 'Erreur lors de la suppression du fichier', details: error.message });
  }
});

// Route pour lister tous les fichiers disponibles dans le dossier outputs
app.get('/api/files', (req, res) => {
  const outputDir = path.join(__dirname, '../../outputs');
  
  try {
    // Vérifier si le dossier existe
    if (!fs.existsSync(outputDir)) {
      return res.json({ files: [] });
    }
    
    // Lire le contenu du dossier
    const files = fs.readdirSync(outputDir)
      .filter(file => !file.startsWith('.')) // Ignorer les fichiers cachés
      .map(file => {
        const filePath = path.join(outputDir, file);
        const stats = fs.statSync(filePath);
        return {
          filename: file,
          originalName: file.replace(/^processed_/, ''), // Enlever le préfixe
          size: stats.size,
          createdAt: stats.birthtime,
          downloadUrl: `/api/download/${file}`
        };
      })
      .sort((a, b) => b.createdAt - a.createdAt); // Trier par date de création, plus récent d'abord
    
    res.json({ files });
  } catch (error) {
    console.error('Erreur lors de la lecture du dossier:', error);
    res.status(500).json({ error: 'Erreur lors de la récupération des fichiers', details: error.message });
  }
});

// Route pour modifier les métadonnées d'un fichier et le renommer
app.put('/api/files/:filename/metadata', async (req, res) => {
  const filename = req.params.filename;
  const { trackNumber, album, title, artist } = req.body;
  
  if (!trackNumber || !album || !title || !artist) {
    return res.status(400).json({ error: 'Tous les champs de métadonnées sont requis' });
  }

  const filePath = path.join(__dirname, '../../outputs', filename);
  
  try {
    // Vérifier si le fichier existe
    if (!fs.existsSync(filePath)) {
      return res.status(404).json({ error: 'Fichier non trouvé' });
    }
    
    // Format du nouveau nom: "N° de Piste - ALBUM - TITRE - Artiste.wav"
    // Éviter les caractères spéciaux dans le nom de fichier
    const sanitizedFilename = `${trackNumber} - ${album} - ${title} - ${artist}`
      .replace(/[\/\\:*?"<>|]/g, '-') // Remplacer les caractères interdits par des tirets
      .trim();
    
    const newFilename = `${sanitizedFilename}.wav`;
    const newFilePath = path.join(__dirname, '../../outputs', newFilename);
    
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
    if (filePath !== newFilePath && fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
    }
    
    res.json({
      success: true,
      message: 'Métadonnées appliquées et fichier renommé avec succès',
      newFilename: newFilename,
      newDownloadUrl: `/api/download/${encodeURIComponent(newFilename)}`
    });
  } catch (error) {
    console.error('Erreur lors de la modification des métadonnées:', error);
    res.status(500).json({ 
      error: 'Erreur lors de la modification des métadonnées', 
      details: error.message 
    });
  }
});

// Route pour obtenir les métadonnées d'un fichier
app.get('/api/files/:filename/metadata', async (req, res) => {
  const filename = req.params.filename;
  const filePath = path.join(__dirname, '../../outputs', filename);
  
  try {
    // Vérifier si le fichier existe
    if (!fs.existsSync(filePath)) {
      return res.status(404).json({ error: 'Fichier non trouvé' });
    }

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
      title: tags.title || '',
      artist: tags.artist || '',
      duration: metadata.format.duration || 0,
      sampleRate: metadata.streams[0]?.sample_rate || '',
      channels: metadata.streams[0]?.channels || ''
    };
    
    res.json({
      success: true,
      metadata: extractedMetadata
    });
  } catch (error) {
    console.error('Erreur lors de la récupération des métadonnées:', error);
    res.status(500).json({ 
      error: 'Erreur lors de la récupération des métadonnées', 
      details: error.message 
    });
  }
});

// Route pour télécharger plusieurs fichiers en tant que ZIP
app.post('/api/download-multiple', express.json(), async (req, res) => {
  const { filenames } = req.body;
  
  if (!filenames || !Array.isArray(filenames) || filenames.length === 0) {
    return res.status(400).json({ error: 'Liste de fichiers invalide' });
  }

  try {
    // Créer un nom unique pour l'archive
    const zipFilename = `stereo-tool-files-${Date.now()}.zip`;
    const zipPath = path.join(__dirname, '../../temp', zipFilename);
    
    // Vérifier si le dossier temp existe, sinon le créer
    const tempDir = path.join(__dirname, '../../temp');
    if (!fs.existsSync(tempDir)) {
      fs.mkdirSync(tempDir, { recursive: true });
    }
    
    // Créer un stream pour écrire le fichier ZIP
    const output = fs.createWriteStream(zipPath);
    const archive = archiver('zip', {
      zlib: { level: 5 } // Niveau de compression
    });
    
    // Gérer les événements de finalisation
    output.on('close', () => {
      console.log(`Archive créée: ${archive.pointer()} octets`);
      // Envoyer le fichier ZIP au client
      res.download(zipPath, zipFilename, (err) => {
        if (err) {
          console.error('Erreur lors de l\'envoi du ZIP:', err);
        }
        
        // Supprimer le fichier ZIP après l'envoi (que ce soit réussi ou non)
        if (fs.existsSync(zipPath)) {
          fs.unlinkSync(zipPath);
        }
      });
    });
    
    archive.on('warning', (err) => {
      if (err.code === 'ENOENT') {
        console.warn('Avertissement pendant la création de l\'archive:', err);
      } else {
        console.error('Erreur pendant la création de l\'archive:', err);
        throw err;
      }
    });
    
    archive.on('error', (err) => {
      console.error('Erreur pendant la création de l\'archive:', err);
      throw err;
    });
    
    // Pipe archive data to the output file
    archive.pipe(output);
    
    // Ajouter chaque fichier demandé à l'archive
    const outputsDir = path.join(__dirname, '../../outputs');
    let fileCount = 0;
    
    for (const filename of filenames) {
      const filePath = path.join(outputsDir, filename);
      
      // Vérifier si le fichier existe
      if (fs.existsSync(filePath)) {
        archive.file(filePath, { name: filename });
        fileCount++;
      }
    }
    
    if (fileCount === 0) {
      // Si aucun fichier n'a été trouvé, annuler et répondre avec une erreur
      archive.abort();
      return res.status(404).json({ error: 'Aucun fichier valide trouvé' });
    }
    
    // Finaliser l'archive
    await archive.finalize();
    
  } catch (error) {
    console.error('Erreur lors de la création de l\'archive ZIP:', error);
    res.status(500).json({ 
      error: 'Erreur lors du téléchargement multiple', 
      details: error.message 
    });
  }
});

// Gérer toutes les autres routes - SPA
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, '../../public/index.html'));
});

// Démarrer le serveur
app.listen(port, () => {
  console.log(`Serveur démarré sur le port ${port}`);
}); 