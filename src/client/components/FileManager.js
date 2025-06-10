import React, { useState, useEffect } from 'react';
import MetadataEditor from './MetadataEditor';

// Helper pour faire des requêtes authentifiées
const authenticatedFetch = (url, options = {}) => {
  const token = localStorage.getItem('accessToken');
  return fetch(url, {
    ...options,
    headers: {
      ...options.headers,
      'Authorization': `Bearer ${token}`
    }
  });
};

const FileManager = () => {
  const [files, setFiles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [deleteStatus, setDeleteStatus] = useState({ show: false, message: '', isError: false });
  const [editingFile, setEditingFile] = useState(null);
  const [selectedFiles, setSelectedFiles] = useState([]);
  const [selectAll, setSelectAll] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [downloadingFile, setDownloadingFile] = useState(null);
  const [cleaningUploads, setCleaningUploads] = useState(false);
  const [diskUsage, setDiskUsage] = useState(null);
  const [loadingDiskUsage, setLoadingDiskUsage] = useState(false);

  // Formater la taille du fichier
  const formatFileSize = (bytes) => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  // Formater la date
  const formatDate = (dateString) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('fr-FR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  // Télécharger un fichier individuel
  const handleDownload = async (filename) => {
    try {
      setDownloadingFile(filename);
      setError(null);
      
      const token = localStorage.getItem('accessToken');
      const response = await authenticatedFetch(`/api/download/${filename}`);

      if (!response.ok) {
        throw new Error('Erreur lors du téléchargement');
      }

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.style.display = 'none';
      a.href = url;
      a.download = filename;
      
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
      
      // Petite pause pour que l'utilisateur voie le message
      setTimeout(() => {
        setDownloadingFile(null);
      }, 1000);
      
    } catch (error) {
      setDownloadingFile(null);
      setError('Erreur lors du téléchargement: ' + error.message);
    }
  };

  // Charger la liste des fichiers
  const loadFiles = async () => {
    try {
      setLoading(true);
      const response = await authenticatedFetch('/api/files');
      const data = await response.json();

      if (response.ok) {
        setFiles(data.files);
        // Réinitialiser la sélection lorsque les fichiers sont rechargés
        setSelectedFiles([]);
        setSelectAll(false);
      } else {
        setError(data.error || 'Erreur lors du chargement des fichiers');
      }
    } catch (err) {
      setError('Erreur de connexion au serveur');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  // Charger les statistiques d'utilisation du disque
  const loadDiskUsage = async () => {
    try {
      setLoadingDiskUsage(true);
      const response = await authenticatedFetch('/api/disk-usage');
      const data = await response.json();

      if (response.ok) {
        setDiskUsage(data.stats);
      } else {
        console.error('Erreur lors du chargement des statistiques:', data.error);
      }
    } catch (err) {
      console.error('Erreur de connexion au serveur lors du chargement des statistiques:', err);
    } finally {
      setLoadingDiskUsage(false);
    }
  };

  // Supprimer un fichier
  const deleteFile = async (filename) => {
    if (!window.confirm(`Êtes-vous sûr de vouloir supprimer le fichier ${filename} ?`)) {
      return;
    }

    try {
      const response = await authenticatedFetch(`/api/files/${encodeURIComponent(filename)}`, {
        method: 'DELETE'
      });

      const data = await response.json();

      if (response.ok) {
        // Mettre à jour la liste des fichiers
        setFiles(prevFiles => prevFiles.filter(file => file.filename !== filename));
        // Mettre à jour la liste des fichiers sélectionnés
        setSelectedFiles(prevSelected => prevSelected.filter(name => name !== filename));
        
        setDeleteStatus({
          show: true,
          message: 'Fichier supprimé avec succès',
          isError: false
        });
      } else {
        setDeleteStatus({
          show: true,
          message: data.error || 'Erreur lors de la suppression',
          isError: true
        });
      }

      // Masquer le message après 3 secondes
      setTimeout(() => {
        setDeleteStatus({ show: false, message: '', isError: false });
      }, 3000);
    } catch (err) {
      setDeleteStatus({
        show: true,
        message: 'Erreur de connexion au serveur',
        isError: true
      });
      console.error(err);
    }
  };

  // Gérer la sélection d'un fichier
  const handleSelectFile = (filename) => {
    setSelectedFiles(prevSelected => {
      if (prevSelected.includes(filename)) {
        // Désélectionner le fichier
        return prevSelected.filter(name => name !== filename);
      } else {
        // Sélectionner le fichier
        return [...prevSelected, filename];
      }
    });
  };

  // Gérer la sélection de tous les fichiers
  const handleSelectAll = () => {
    if (selectAll) {
      // Désélectionner tous les fichiers
      setSelectedFiles([]);
    } else {
      // Sélectionner tous les fichiers
      setSelectedFiles(files.map(file => file.filename));
    }
    setSelectAll(!selectAll);
  };

  // Télécharger les fichiers sélectionnés
  const downloadSelectedFiles = async () => {
    if (selectedFiles.length === 0) {
      alert('Veuillez sélectionner au moins un fichier à télécharger');
      return;
    }

    try {
      setDownloading(true);
      
      // Effectuer une requête pour créer le ZIP
      const response = await authenticatedFetch('/api/download-multiple', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ filenames: selectedFiles })
      });
      
      if (!response.ok) {
        throw new Error('Erreur lors de la création du ZIP');
      }
      
      // Obtenir le blob pour télécharger le fichier
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      
      // Créer un lien et déclencher le téléchargement
      const a = document.createElement('a');
      a.style.display = 'none';
      a.href = url;
      
      // Déterminer le nom du fichier
      const contentDisposition = response.headers.get('Content-Disposition');
      let filename = 'stereo-tool-files.zip';
      
      if (contentDisposition) {
        const matches = /filename[^;=\n]*=((['"]).*?\2|[^;\n]*)/.exec(contentDisposition);
        if (matches != null && matches[1]) {
          filename = matches[1].replace(/['"]/g, '');
        }
      }
      
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      
      // Nettoyer
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
      
      setDownloading(false);
    } catch (err) {
      setDownloading(false);
      console.error('Erreur lors du téléchargement multiple:', err);
      alert('Erreur lors du téléchargement des fichiers sélectionnés');
    }
  };

  // Supprimer les fichiers sélectionnés
  const deleteSelectedFiles = async () => {
    if (selectedFiles.length === 0) {
      alert('Veuillez sélectionner au moins un fichier à supprimer');
      return;
    }

    if (!window.confirm(`Êtes-vous sûr de vouloir supprimer ${selectedFiles.length} fichier(s) ?`)) {
      return;
    }

    try {
      let successCount = 0;
      let errorCount = 0;
      
      // Supprimer chaque fichier sélectionné
      for (const filename of selectedFiles) {
        try {
          const response = await authenticatedFetch(`/api/files/${encodeURIComponent(filename)}`, {
            method: 'DELETE'
          });
          
          if (response.ok) {
            successCount++;
          } else {
            errorCount++;
          }
        } catch (err) {
          errorCount++;
          console.error(`Erreur lors de la suppression de ${filename}:`, err);
        }
      }
      
      // Mettre à jour la liste des fichiers
      await loadFiles();
      
      // Afficher un message de résultat
      setDeleteStatus({
        show: true,
        message: `${successCount} fichier(s) supprimé(s) avec succès${errorCount > 0 ? `, ${errorCount} erreur(s)` : ''}`,
        isError: errorCount > 0
      });
      
      // Masquer le message après 3 secondes
      setTimeout(() => {
        setDeleteStatus({ show: false, message: '', isError: false });
      }, 3000);
    } catch (err) {
      setDeleteStatus({
        show: true,
        message: 'Erreur lors de la suppression des fichiers',
        isError: true
      });
      console.error(err);
    }
  };

  // Ouvrir l'éditeur de métadonnées
  const openMetadataEditor = (file) => {
    setEditingFile(file);
  };

  // Fermer l'éditeur de métadonnées
  const closeMetadataEditor = () => {
    setEditingFile(null);
  };

  // Callback lorsque l'édition des métadonnées est réussie
  const handleMetadataSuccess = (updatedFile) => {
    // Mettre à jour le fichier dans la liste
    setFiles(prevFiles => 
      prevFiles.map(file => 
        file.filename === editingFile.filename ? updatedFile : file
      )
    );
    
    // Fermer l'éditeur
    closeMetadataEditor();
    
    // Afficher un message de succès
    setDeleteStatus({
      show: true,
      message: 'Métadonnées mises à jour avec succès',
      isError: false
    });
    
    // Masquer le message après 3 secondes
    setTimeout(() => {
      setDeleteStatus({ show: false, message: '', isError: false });
    }, 3000);
  };

  // Nettoyer les fichiers importés
  const cleanUploadedFiles = async () => {
    if (!window.confirm('Êtes-vous sûr de vouloir nettoyer tous les fichiers importés ? Cette action ne supprimera pas vos fichiers traités.')) {
      return;
    }

    try {
      setCleaningUploads(true);
      
      const response = await authenticatedFetch('/api/clean-uploads', {
        method: 'POST',
      });
      
      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(data.error || 'Erreur lors du nettoyage des fichiers importés');
      }
      
      setDeleteStatus({
        show: true,
        message: data.message,
        isError: false
      });
      
      // Recharger les statistiques d'utilisation du disque
      loadDiskUsage();
      
      // Masquer le message après 3 secondes
      setTimeout(() => {
        setDeleteStatus({ show: false, message: '', isError: false });
      }, 3000);
    } catch (err) {
      setDeleteStatus({
        show: true,
        message: err.message,
        isError: true
      });
      console.error('Erreur lors du nettoyage des fichiers importés:', err);
    } finally {
      setCleaningUploads(false);
    }
  };

  // Charger les fichiers et les statistiques au chargement du composant
  useEffect(() => {
    loadFiles();
    loadDiskUsage();
    
    // Écouter les événements de navigation et de nouveau fichier traité
    const handleNavigateToFiles = () => {
      loadFiles();
      loadDiskUsage();
    };
    
    const handleFileProcessed = () => {
      // Recharger la liste des fichiers avec un léger délai pour laisser le temps au serveur
      setTimeout(() => {
        loadFiles();
        loadDiskUsage();
      }, 1000);
    };
    
    window.addEventListener('navigate-to-files', handleNavigateToFiles);
    window.addEventListener('file-processed', handleFileProcessed);
    
    // Nettoyer les événements lors du démontage du composant
    return () => {
      window.removeEventListener('navigate-to-files', handleNavigateToFiles);
      window.removeEventListener('file-processed', handleFileProcessed);
    };
  }, []);

  return (
    <div className="file-manager">
      <h2>Gestionnaire de Fichiers</h2>
      <p>Tous vos fichiers audio traités sont listés ici. Vous pouvez les télécharger, les éditer ou les supprimer.</p>

      {deleteStatus.show && (
        <div className={`notification ${deleteStatus.isError ? 'error' : 'success'}`}>
          {deleteStatus.message}
        </div>
      )}

      {editingFile && (
        <div className="modal-overlay">
          <div className="modal-content">
            <MetadataEditor 
              file={editingFile} 
              onClose={closeMetadataEditor} 
              onSuccess={handleMetadataSuccess} 
            />
          </div>
        </div>
      )}

      {/* Affichage des statistiques d'utilisation du disque */}
      {diskUsage && (
        <div className="disk-usage-stats">
          <div className="disk-usage-item">
            <h4>Fichiers importés</h4>
            <div className="disk-usage-details">
              <span>{diskUsage.uploads.count} fichier(s)</span>
              <span>{formatFileSize(diskUsage.uploads.size)}</span>
              <button 
                onClick={cleanUploadedFiles} 
                className="btn btn-sm btn-danger" 
                disabled={cleaningUploads || diskUsage.uploads.count === 0}
              >
                {cleaningUploads ? 'Nettoyage...' : 'Nettoyer'}
              </button>
            </div>
          </div>
          <div className="disk-usage-item">
            <h4>Fichiers traités</h4>
            <div className="disk-usage-details">
              <span>{diskUsage.outputs.count} fichier(s)</span>
              <span>{formatFileSize(diskUsage.outputs.size)}</span>
            </div>
          </div>
          <div className="disk-usage-item">
            <h4>Fichiers temporaires</h4>
            <div className="disk-usage-details">
              <span>{diskUsage.temp.count} fichier(s)</span>
              <span>{formatFileSize(diskUsage.temp.size)}</span>
            </div>
          </div>
          <button 
            onClick={loadDiskUsage} 
            className="btn btn-sm btn-secondary refresh-stats"
            title="Actualiser les statistiques"
            disabled={loadingDiskUsage}
          >
            {loadingDiskUsage ? '...' : '↻'}
          </button>
        </div>
      )}

      <div className="file-actions-bar">
        <div className="refresh-button-container">
          <button onClick={loadFiles} className="btn btn-secondary" disabled={loading}>
            {loading ? 'Chargement...' : 'Actualiser la liste'}
          </button>
        </div>
        
        {files.length > 0 && (
          <div className="bulk-actions">
            <span className="selection-info">
              {selectedFiles.length} fichier(s) sélectionné(s)
            </span>
            <button 
              className="btn btn-secondary"
              onClick={handleSelectAll}
              disabled={loading}
            >
              {selectAll ? 'Désélectionner tout' : 'Sélectionner tout'}
            </button>
            <button 
              className="btn"
              onClick={downloadSelectedFiles}
              disabled={selectedFiles.length === 0 || downloading}
            >
              {downloading ? 'Préparation...' : 'Télécharger la sélection'}
            </button>
            <button 
              className="btn btn-danger"
              onClick={deleteSelectedFiles}
              disabled={selectedFiles.length === 0}
            >
              Supprimer la sélection
            </button>
          </div>
        )}
      </div>

      {loading ? (
        <div className="loading">
          <div className="loader"></div>
          <p>Chargement des fichiers...</p>
        </div>
      ) : error ? (
        <div className="error">{error}</div>
      ) : files.length === 0 ? (
        <div className="no-files">
          <p>Aucun fichier traité disponible. Traitez des fichiers audio pour les voir apparaître ici.</p>
        </div>
      ) : (
        <div className="file-table-container">
          <table className="file-table">
            <thead>
              <tr>
                <th className="checkbox-column">
                  <input 
                    type="checkbox" 
                    checked={selectAll}
                    onChange={handleSelectAll}
                  />
                </th>
                <th>Nom du fichier</th>
                <th>Taille</th>
                <th>Date de création</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {files.map((file) => (
                <tr key={file.filename} className={selectedFiles.includes(file.filename) ? 'selected-row' : ''}>
                  <td className="checkbox-column">
                    <input 
                      type="checkbox" 
                      checked={selectedFiles.includes(file.filename)}
                      onChange={() => handleSelectFile(file.filename)}
                    />
                  </td>
                  <td>{file.filename}</td>
                  <td>{formatFileSize(file.size)}</td>
                  <td>{formatDate(file.createdAt)}</td>
                  <td className="file-actions">
                    <button 
                      onClick={() => handleDownload(file.filename)}
                      className="btn btn-sm" 
                      title="Télécharger"
                      disabled={downloadingFile === file.filename}
                    >
                      {downloadingFile === file.filename ? '⏳' : '📥'}
                    </button>
                    <button 
                      onClick={() => openMetadataEditor(file)}
                      className="btn btn-sm btn-edit"
                      title="Éditer les métadonnées"
                    >
                      ✏️
                    </button>
                    <button 
                      onClick={() => deleteFile(file.filename)} 
                      className="btn btn-sm btn-danger"
                      title="Supprimer"
                    >
                      🗑️
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};

export default FileManager; 