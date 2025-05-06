import React, { useState, useEffect } from 'react';

const MetadataEditor = ({ file, onClose, onSuccess }) => {
  const [metadata, setMetadata] = useState({
    trackNumber: '',
    album: '',
    title: '',
    artist: ''
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);

  // Charger les métadonnées existantes
  useEffect(() => {
    const loadMetadata = async () => {
      if (!file) return;
      
      try {
        setLoading(true);
        const response = await fetch(`/api/files/${encodeURIComponent(file.filename)}/metadata`);
        const data = await response.json();

        if (response.ok) {
          // Préremplir avec les métadonnées existantes ou suggérer à partir du nom de fichier
          setMetadata({
            trackNumber: data.metadata.trackNumber || '',
            album: data.metadata.album || '',
            title: data.metadata.title || file.originalName.replace(/\.[^/.]+$/, ''), // Enlever l'extension
            artist: data.metadata.artist || ''
          });
        } else {
          setError(data.error || 'Erreur lors du chargement des métadonnées');
        }
      } catch (err) {
        setError('Erreur de connexion au serveur');
        console.error(err);
      } finally {
        setLoading(false);
      }
    };

    loadMetadata();
  }, [file]);

  // Gérer les changements de champs
  const handleChange = (e) => {
    const { name, value } = e.target;
    setMetadata(prev => ({
      ...prev,
      [name]: value
    }));
  };

  // Envoyer les modifications
  const handleSubmit = async (e) => {
    e.preventDefault();
    
    // Validation basique
    if (!metadata.trackNumber || !metadata.album || !metadata.title || !metadata.artist) {
      setError('Tous les champs sont obligatoires');
      return;
    }

    try {
      setSaving(true);
      setError(null);
      
      const response = await fetch(`/api/files/${encodeURIComponent(file.filename)}/metadata`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(metadata)
      });

      const data = await response.json();

      if (response.ok) {
        setSuccess(data.message);
        
        // Appeler le callback de succès avec les nouvelles informations
        if (onSuccess) {
          setTimeout(() => {
            onSuccess({
              ...file,
              filename: data.newFilename,
              originalName: data.newFilename,
              downloadUrl: data.newDownloadUrl
            });
          }, 1500);
        }
      } else {
        setError(data.error || 'Erreur lors de la sauvegarde des métadonnées');
      }
    } catch (err) {
      setError('Erreur de connexion au serveur');
      console.error(err);
    } finally {
      setSaving(false);
    }
  };

  // Prévisualiser le nom du fichier qui sera généré
  const previewFilename = `${metadata.trackNumber} - ${metadata.album} - ${metadata.title} - ${metadata.artist}.wav`;

  return (
    <div className="metadata-editor">
      <div className="metadata-editor-header">
        <h3>Éditer les métadonnées</h3>
        <button className="btn-close" onClick={onClose} aria-label="Fermer">×</button>
      </div>

      {loading ? (
        <div className="loading">
          <div className="loader"></div>
          <p>Chargement des métadonnées...</p>
        </div>
      ) : (
        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label htmlFor="trackNumber">Numéro de piste</label>
            <input
              type="text"
              id="trackNumber"
              name="trackNumber"
              value={metadata.trackNumber}
              onChange={handleChange}
              placeholder="01"
              required
            />
          </div>

          <div className="form-group">
            <label htmlFor="album">Album</label>
            <input
              type="text"
              id="album"
              name="album"
              value={metadata.album}
              onChange={handleChange}
              placeholder="Nom de l'album"
              required
            />
          </div>

          <div className="form-group">
            <label htmlFor="title">Titre</label>
            <input
              type="text"
              id="title"
              name="title"
              value={metadata.title}
              onChange={handleChange}
              placeholder="Titre de la piste"
              required
            />
          </div>

          <div className="form-group">
            <label htmlFor="artist">Artiste</label>
            <input
              type="text"
              id="artist"
              name="artist"
              value={metadata.artist}
              onChange={handleChange}
              placeholder="Nom de l'artiste"
              required
            />
          </div>

          <div className="filename-preview">
            <p><strong>Aperçu du nom de fichier:</strong></p>
            <div className="preview-box">{previewFilename}</div>
          </div>

          {error && <div className="error">{error}</div>}
          {success && <div className="success">{success}</div>}

          <div className="form-actions">
            <button type="button" className="btn btn-secondary" onClick={onClose}>
              Annuler
            </button>
            <button type="submit" className="btn" disabled={saving}>
              {saving ? 'Enregistrement...' : 'Enregistrer'}
            </button>
          </div>
        </form>
      )}
    </div>
  );
};

export default MetadataEditor; 