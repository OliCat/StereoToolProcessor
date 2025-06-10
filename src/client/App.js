import React, { useState, useEffect } from 'react';
import SingleFileProcessor from './components/SingleFileProcessor';
import BatchProcessor from './components/BatchProcessor';
import FileManager from './components/FileManager';
import LoginForm from './components/Auth/LoginForm';

const App = () => {
  const [activeTab, setActiveTab] = useState('single');
  const [user, setUser] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');

  // Vérifier l'authentification au chargement
  useEffect(() => {
    checkAuthStatus();
  }, []);

  const checkAuthStatus = async () => {
    try {
      const token = localStorage.getItem('accessToken');
      if (!token) {
        setIsLoading(false);
        return;
      }

      const response = await fetch('/api/auth/status', {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (response.ok) {
        const data = await response.json();
        setUser(data.user);
      } else {
        localStorage.removeItem('accessToken');
        localStorage.removeItem('refreshToken');
        localStorage.removeItem('user');
      }
    } catch (error) {
      console.error('Erreur lors de la vérification de l\'authentification:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleLogin = (userData) => {
    setUser(userData);
    setError('');
  };

  const handleLogout = () => {
    localStorage.removeItem('accessToken');
    localStorage.removeItem('refreshToken');
    localStorage.removeItem('user');
    setUser(null);
    setActiveTab('single');
  };

  const handleError = (errorMessage) => {
    setError(errorMessage);
  };

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

  // Affichage de chargement
  if (isLoading) {
    return (
      <div className="app-container">
        <div className="loading-container">
          <p>Chargement...</p>
        </div>
      </div>
    );
  }

  // Affichage du formulaire de connexion si non authentifié
  if (!user) {
    return (
      <div className="app-container">
        {error && (
          <div className="error-message">
            {error}
          </div>
        )}
        <LoginForm 
          onLogin={handleLogin}
          onError={handleError}
          isLoading={isLoading}
        />
      </div>
    );
  }

  // Interface principale pour utilisateur authentifié
  return (
    <div className="app-container">
      <header className="header">
        <div className="header-content">
          <div className="header-title">
            <h1>StereoTool Processor</h1>
            <p>Traitez vos fichiers audio avec StereoTool</p>
          </div>
          <div className="header-user">
            <span>Bienvenue, {user.name || user.email}</span>
            <button className="logout-btn" onClick={handleLogout}>
              Déconnexion
            </button>
          </div>
        </div>
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
        <p>© {new Date().getFullYear()} Radio Cause Commune - StereoTool Processor</p>
      </footer>
    </div>
  );
};

export default App; 