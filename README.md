# StereoTool Processor

Une application web pour traiter des fichiers audio avec StereoTool.

## Fonctionnalités

- Traitement de fichiers audio individuels
- Traitement par lot depuis un répertoire
- Support pour les presets StereoTool (.sts)
- Support pour différents formats audio (.wav, .mp3, .flac, .aiff, .ogg, .m4a)
- Traitement automatique par segments pour les fichiers longs (>30 minutes)
- Téléchargement des fichiers traités
- Interface utilisateur intuitive

## Prérequis

- Node.js (v14 ou supérieur)
- npm (v6 ou supérieur)
- StereoTool (exécutable `stereo_tool_mac` dans le répertoire racine du projet)
- FFmpeg (installé et accessible dans le PATH)
- Clé de licence StereoTool valide

## Installation

1. Clonez ce dépôt
2. Installez les dépendances :

```bash
npm install
```

3. Assurez-vous que FFmpeg est installé sur votre système:

```bash
# Pour macOS avec Homebrew
brew install ffmpeg

# Pour Ubuntu/Debian
apt-get install ffmpeg

# Pour Windows
# Téléchargez depuis https://ffmpeg.org/download.html et ajoutez le dossier bin à votre PATH
```

4. Placez l'exécutable StereoTool dans le répertoire racine du projet.

## Développement

Pour démarrer le serveur de développement :

```bash
npm run dev
```

## Production

Pour construire l'application pour la production :

```bash
npm run build
npm start
```

L'application sera accessible à l'adresse `http://localhost:3000`.

## Utilisation

### Traitement d'un fichier unique

1. Sélectionnez l'onglet "Fichier Unique"
2. Téléchargez un fichier audio (formats supportés: .wav, .mp3, .flac, .aiff, .ogg, .m4a)
3. Téléchargez un preset StereoTool (.sts)
4. Entrez votre clé de licence StereoTool
5. Cliquez sur "Traiter le Fichier"
6. Une fois le traitement terminé, téléchargez le fichier traité

### Traitement par lot

1. Sélectionnez l'onglet "Traitement par Lot"
2. Téléchargez plusieurs fichiers audio (jusqu'à 20 fichiers)
3. Téléchargez un preset StereoTool (.sts)
4. Entrez votre clé de licence StereoTool
5. Cliquez sur "Traiter les Fichiers"
6. Une fois le traitement terminé, téléchargez les fichiers traités individuellement

### Gestion des fichiers longs

Les fichiers audio de plus de 30 minutes sont automatiquement traités par segments:
1. Le fichier est divisé en segments de 10 minutes
2. Chaque segment est traité individuellement
3. Les segments traités sont fusionnés en un seul fichier
4. Le fichier résultant est identique à l'original en termes de qualité et de durée

### Format de sortie

Tous les fichiers sont convertis au format WAV (PCM 16 bits, 44,1 kHz) pour assurer:
- Une compatibilité maximale avec les applications audio comme Adobe Audition
- Une qualité optimale sans artefacts de compression
- Une cohérence dans le traitement, quelle que soit la source

## Structure du projet

```
.
├── src/
│   ├── client/              # Code frontend React
│   │   ├── components/      # Composants React
│   │   ├── App.js           # Composant principal
│   │   ├── index.js         # Point d'entrée React
│   │   ├── index.html       # Template HTML
│   │   └── styles.css       # Styles CSS
│   └── server/              # Code backend Express
│       └── index.js         # Serveur Express
├── public/                  # Fichiers statiques et build client
├── uploads/                 # Dossier temporaire pour les fichiers téléchargés
├── presets/                 # Dossier temporaire pour les presets
├── outputs/                 # Fichiers audio traités
├── temp/                    # Fichiers temporaires pour le traitement par segments
├── package.json             # Configuration npm
├── webpack.config.js        # Configuration webpack
└── README.md                # Documentation
```

## Licence

Ce projet est sous licence MIT. 