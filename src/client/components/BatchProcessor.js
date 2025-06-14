import React, { useState } from 'react';

const BatchProcessor = () => {
  const [audioFiles, setAudioFiles] = useState([]);
  const [preset, setPreset] = useState(null);
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState(null);
  const [error, setError] = useState(null);
  const [processing, setProcessing] = useState({ status: '', currentFile: '', progress: 0 });

  const handleAudioFilesChange = (e) => {
    if (e.target.files.length > 0) {
      setAudioFiles(Array.from(e.target.files));
    }
  };

  const handlePresetChange = (e) => {
    if (e.target.files.length > 0) {
      setPreset(e.target.files[0]);
    }
  };

  const handleDownload = async (downloadUrl) => {
    try {
      const token = localStorage.getItem('accessToken');
      const response = await fetch(downloadUrl, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (!response.ok) {
        throw new Error('Erreur lors du téléchargement');
      }

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.style.display = 'none';
      a.href = url;
      
      // Extraire le nom du fichier depuis l'URL
      const filename = downloadUrl.split('/').pop();
      a.download = filename;
      
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (error) {
      setError('Erreur lors du téléchargement: ' + error.message);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    // Validation
    if (audioFiles.length === 0 || !preset) {
      setError('Veuillez fournir des fichiers audio et un preset');
      return;
    }

    // Limiter le nombre de fichiers à traiter
    if (audioFiles.length > 20) {
      setError('Vous ne pouvez pas traiter plus de 20 fichiers à la fois.');
      return;
    }

    setError(null);
    setResults(null);
    setLoading(true);
    setProcessing({ status: 'Préparation du traitement par lot...', currentFile: '', progress: 5 });

    try {
      const formData = new FormData();
      
      audioFiles.forEach(file => {
        formData.append('audioFiles', file);
      });
      
      formData.append('preset', preset);

      // Vérification des fichiers volumineux
      const hasLargeFiles = audioFiles.some(file => file.size > 1024 * 1024 * 50);
      if (hasLargeFiles) {
        setProcessing({ 
          status: 'Des fichiers volumineux ont été détectés, le traitement peut prendre plus de temps...', 
          currentFile: '', 
          progress: 10 
        });
      }

      const token = localStorage.getItem('accessToken');
      const response = await fetch('/api/batch-process', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`
        },
        body: formData
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || data.details || 'Une erreur est survenue');
      }

      setResults(data.results);
      
      // Notifier le gestionnaire de fichiers que de nouveaux fichiers ont été traités
      window.dispatchEvent(new CustomEvent('file-processed', { 
        detail: { 
          count: data.results.filter(r => r.success).length,
          filenames: data.results.filter(r => r.success).map(r => r.outputFile ? r.outputFile.split('/').pop() : null)
        }
      }));
      
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
      setProcessing({ status: '', currentFile: '', progress: 0 });
    }
  };

  // Formats audio supportés
  const supportedFormats = ".wav, .mp3, .flac, .aiff, .ogg, .m4a";

  return (
    <div>
      <h2>Traitement par Lot</h2>
      <p>Téléchargez plusieurs fichiers audio et un preset pour les traiter avec StereoTool.</p>

      {error && <div className="error">{error}</div>}

      <form onSubmit={handleSubmit}>
        <div className="form-group">
          <label htmlFor="audioFiles">Fichiers Audio ({supportedFormats})</label>
          <div className="file-input-container">
            <label className="file-input-label">
              {audioFiles.length > 0 ? `${audioFiles.length} fichier(s) sélectionné(s)` : 'Choisir des fichiers'}
              <input
                type="file"
                id="audioFiles"
                className="file-input"
                accept={supportedFormats}
                multiple
                onChange={handleAudioFilesChange}
              />
            </label>
          </div>
          {audioFiles.length > 0 && (
            <div className="file-list">
              {audioFiles.map((file, index) => (
                <div key={index} className="file-item">
                  {file.name} ({(file.size / (1024 * 1024)).toFixed(2)} MB)
                </div>
              ))}
            </div>
          )}
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



        <div className="infobox">
          <p><strong>Notes :</strong></p>
          <ul>
            <li>Les fichiers de plus de 30 minutes seront automatiquement traités par segments.</li>
            <li>Vous pouvez traiter jusqu'à 20 fichiers à la fois.</li>
            <li>Le traitement par lot peut prendre du temps, surtout pour les fichiers volumineux.</li>
            <li>Tous les fichiers seront convertis au format WAV pour une meilleure compatibilité avec les applications audio.</li>
          </ul>
        </div>

        <button type="submit" className="btn" disabled={loading}>
          {loading ? 'Traitement en cours...' : 'Traiter les Fichiers'}
        </button>
      </form>

      {loading && (
        <div className="loading">
          <div className="loader"></div>
          <p>{processing.status || 'Traitement par lot en cours...'}</p>
          {processing.currentFile && <p>Fichier en cours: {processing.currentFile}</p>}
          {processing.progress > 0 && (
            <div className="progress-bar">
              <div className="progress" style={{ width: `${processing.progress}%` }}></div>
            </div>
          )}
        </div>
      )}

      {results && (
        <div className="results">
          <h3>Résultats</h3>
          <div className="batch-results-header">
            <div>
              <span className="success-count">{results.filter(r => r.success).length} fichier(s) traité(s)</span>
              {results.some(r => !r.success) && (
                <span className="error-count">{results.filter(r => !r.success).length} échec(s)</span>
              )}
            </div>
            <button 
              className="btn btn-secondary"
              onClick={() => window.dispatchEvent(new CustomEvent('navigate-to-files'))}
            >
              Gérer tous les fichiers
            </button>
          </div>
          {results.map((result, index) => (
            <div key={index} className={`result-item ${result.success ? 'success' : 'error'}`}>
              <div>
                <strong>{result.filename}</strong>
                <div>{result.success ? 'Traité avec succès' : `Erreur: ${result.error}`}</div>
              </div>
              {result.success && (
                <button 
                  className="btn"
                  onClick={() => handleDownload(result.outputFile)}
                >
                  Télécharger
                </button>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default BatchProcessor; 