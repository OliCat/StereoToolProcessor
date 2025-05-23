import React, { useState } from 'react';

const SingleFileProcessor = () => {
  const [audioFile, setAudioFile] = useState(null);
  const [preset, setPreset] = useState(null);
  const [licenseKey, setLicenseKey] = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);
  const [processing, setProcessing] = useState({ status: '', progress: 0 });

  const handleAudioFileChange = (e) => {
    if (e.target.files.length > 0) {
      setAudioFile(e.target.files[0]);
    }
  };

  const handlePresetChange = (e) => {
    if (e.target.files.length > 0) {
      setPreset(e.target.files[0]);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    // Validation
    if (!audioFile || !preset || !licenseKey) {
      setError('Veuillez fournir tous les champs requis');
      return;
    }

    setError(null);
    setResult(null);
    setLoading(true);
    setProcessing({ status: 'Démarrage du traitement...', progress: 5 });

    try {
      const formData = new FormData();
      formData.append('audioFile', audioFile);
      formData.append('preset', preset);
      formData.append('licenseKey', licenseKey);

      // Vérification de la taille du fichier
      if (audioFile.size > 1024 * 1024 * 50) { // si le fichier fait plus de 50 MB
        setProcessing({ status: 'Le fichier est volumineux, traitement par segments en cours...', progress: 10 });
      }

      const response = await fetch('/api/process-file', {
        method: 'POST',
        body: formData
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || data.details || 'Une erreur est survenue');
      }

      setResult(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
      setProcessing({ status: '', progress: 0 });
    }
  };

  // Formats audio supportés
  const supportedFormats = ".wav, .mp3, .flac, .aiff, .ogg, .m4a";

  return (
    <div>
      <h2>Traitement de Fichier Unique</h2>
      <p>Téléchargez un fichier audio et un preset pour le traiter avec StereoTool.</p>

      {error && <div className="error">{error}</div>}

      <form onSubmit={handleSubmit}>
        <div className="form-group">
          <label htmlFor="audioFile">Fichier Audio ({supportedFormats})</label>
          <div className="file-input-container">
            <label className="file-input-label">
              {audioFile ? audioFile.name : 'Choisir un fichier'}
              <input
                type="file"
                id="audioFile"
                className="file-input"
                accept={supportedFormats}
                onChange={handleAudioFileChange}
              />
            </label>
          </div>
        </div>

        <div className="form-group">
          <label htmlFor="preset">Preset StereoTool (.sts)</label>
          <div className="file-input-container">
            <label className="file-input-label">
              {preset ? preset.name : 'Choisir un preset'}
              <input
                type="file"
                id="preset"
                className="file-input"
                accept=".sts"
                onChange={handlePresetChange}
              />
            </label>
          </div>
        </div>

        <div className="form-group">
          <label htmlFor="licenseKey">Clé de Licence StereoTool</label>
          <input
            type="text"
            id="licenseKey"
            value={licenseKey}
            onChange={(e) => setLicenseKey(e.target.value)}
            placeholder="Entrez votre clé de licence StereoTool (commence par < et se termine par >)"
          />
        </div>

        <div className="infobox">
          <p><strong>Note :</strong> Les fichiers de plus de 30 minutes seront automatiquement traités par segments.</p>
          <p><strong>Format de sortie :</strong> Tous les fichiers seront convertis au format WAV pour une meilleure compatibilité avec les applications audio.</p>
        </div>

        <button type="submit" className="btn" disabled={loading}>
          {loading ? 'Traitement en cours...' : 'Traiter le Fichier'}
        </button>
      </form>

      {loading && (
        <div className="loading">
          <div className="loader"></div>
          <p>{processing.status || 'Traitement en cours...'}</p>
          {processing.progress > 0 && (
            <div className="progress-bar">
              <div className="progress" style={{ width: `${processing.progress}%` }}></div>
            </div>
          )}
        </div>
      )}

      {result && (
        <div className="results">
          <h3>Résultat</h3>
          <div className="success">
            {result.message}
          </div>
          <div className="result-actions">
            <a 
              href={result.outputFile} 
              className="btn"
              download
            >
              Télécharger le Fichier Traité
            </a>
            <button 
              className="btn btn-secondary"
              onClick={() => window.dispatchEvent(new CustomEvent('navigate-to-files'))}
            >
              Voir tous les fichiers
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default SingleFileProcessor; 