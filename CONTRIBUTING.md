# Guide de contribution à StereoToolProcessor

Merci de votre intérêt pour contribuer à StereoToolProcessor ! Ce document fournit des lignes directrices pour contribuer au projet.

## Flux de travail Git

Nous utilisons un modèle de branche basé sur [GitFlow](https://nvie.com/posts/a-successful-git-branching-model/) :

- `main` : Branche de production stable
- `develop` : Branche de développement principal
- `feature/*` : Branches pour les nouvelles fonctionnalités
- `bugfix/*` : Branches pour les corrections de bugs
- `hotfix/*` : Branches pour les correctifs urgents en production

### Processus de contribution

1. Forkez le dépôt
2. Créez une branche à partir de `develop` pour votre fonctionnalité ou correction
   ```
   git checkout develop
   git checkout -b feature/ma-nouvelle-fonctionnalite
   ```
3. Développez votre fonctionnalité ou correction
4. Testez votre code
5. Soumettez une Pull Request vers la branche `develop`

## Standards de codage

- Indentation : 2 espaces
- Utilisez des points-virgules à la fin des instructions JavaScript
- Utilisez des guillemets simples pour les chaînes de caractères JavaScript
- Suivez les principes de React pour les composants (composants fonctionnels avec hooks)
- Commentez votre code lorsque nécessaire

## Tests

Avant de soumettre une Pull Request, assurez-vous que :

1. L'application démarre sans erreur
2. Les fonctionnalités existantes continuent de fonctionner
3. Votre nouvelle fonctionnalité fonctionne comme prévu

## Rapport de bugs

Si vous trouvez un bug, veuillez créer une issue avec les informations suivantes :

1. Description du bug
2. Étapes pour reproduire
3. Comportement attendu
4. Captures d'écran (si applicable)
5. Environnement (système d'exploitation, navigateur, version de Node.js)

## Suggestions de fonctionnalités

Pour proposer une nouvelle fonctionnalité, veuillez créer une issue avec :

1. Description détaillée de la fonctionnalité
2. Justification (pourquoi cette fonctionnalité serait utile)
3. Implémentation proposée (si vous avez des idées)

Merci de contribuer à StereoToolProcessor ! 