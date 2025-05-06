import React, { useState, useEffect } from 'react';
import SingleFileProcessor from './components/SingleFileProcessor';
import BatchProcessor from './components/BatchProcessor';
import FileManager from './components/FileManager';

const App = () => {
  const [activeTab, setActiveTab] = useState('single');

  // Écouter l'événement de navigation vers l'onglet des fichiers
  useEffect(() => {
    const handleNavigateToFiles = () => {
      setActiveTab('files');
    };

    window.addEventListener('navigate-to-files', handleNavigateToFiles);

    return () => {
      window.removeEventListener('navigate-to-files', handleNavigateToFiles);
    };
  }, []);

  return (
    <div className="app-container">
      <header className="header">
        <h1>StereoTool Processor</h1>
        <p>Traitez vos fichiers audio avec StereoTool</p>
      </header>

      <div className="tabs">
        <button 
          className={`tab ${activeTab === 'single' ? 'active' : ''}`}
          onClick={() => setActiveTab('single')}
        >
          Fichier Unique
        </button>
        <button 
          className={`tab ${activeTab === 'batch' ? 'active' : ''}`}
          onClick={() => setActiveTab('batch')}
        >
          Traitement par Lot
        </button>
        <button 
          className={`tab ${activeTab === 'files' ? 'active' : ''}`}
          onClick={() => setActiveTab('files')}
        >
          Gestionnaire de Fichiers
        </button>
      </div>

      <div className="content">
        {activeTab === 'single' ? (
          <SingleFileProcessor />
        ) : activeTab === 'batch' ? (
          <BatchProcessor />
        ) : (
          <FileManager />
        )}
      </div>

      <footer className="footer">
        <p>© {new Date().getFullYear()} StereoTool Processor</p>
      </footer>
    </div>
  );
};

export default App; 