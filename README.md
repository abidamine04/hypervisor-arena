# Hypervisor Arena — Datacenter Rescue

Jeu de course multijoueur en français pour une classe. Les joueurs inspectent des logs, modifient des fichiers JSON et utilisent un terminal simulé. Le premier à valider les quatre missions sur le serveur gagne. Aucun questionnaire à choix multiples.

## Démarrage rapide : Windows, Linux ou macOS

Prérequis : Node.js 20 ou plus récent, avec npm. Aucune dépendance externe, aucun compte, aucune clé API.

1. Extraire le ZIP et ouvrir un terminal dans le dossier `hypervisor-arena` (celui qui contient `package.json`).
2. Lancer :

```sh
npm start
```

3. Ouvrir `http://localhost:5173/admin` sur la machine hôte.
4. Saisir le mot de passe admin affiché dans le terminal. Il est généré à chaque démarrage si `ADMIN_PASSWORD` n’est pas défini.
5. Créer une salle, saisir le nom de l’hôte et choisir son avatar. Donner le code à la classe.
6. Les joueurs ouvrent `http://IP-DU-SERVEUR:5173`, choisissent un pseudo et un avatar, puis entrent le code **avant** le départ.
7. Cliquer « Lancer le départ ». Tout le monde part après cinq secondes. Le premier à terminer les quatre missions gagne ; les autres peuvent continuer.

`npm run dev` lance le même serveur. `npm run build` vérifie la syntaxe : cette application n’a pas besoin de compilation. `npm test` lance les tests métier et un test de course complète avec plusieurs sessions.

## Connexion de la classe

Le serveur écoute sur `0.0.0.0:5173` par défaut. Sur Windows, `ipconfig` indique l’adresse IPv4 du réseau utilisé ; sur Linux, `hostname -I` peut aider à la trouver. Remplacer `IP-DU-SERVEUR` par cette adresse, par exemple `192.168.1.20`.

Sur le même réseau, utiliser cette URL depuis les autres ordinateurs ou téléphones. Autoriser Node.js sur le réseau privé dans le pare-feu si nécessaire. Certains réseaux scolaires isolent les clients Wi-Fi : dans ce cas, utiliser un réseau de lab qui autorise la communication entre appareils ou demander à l’administrateur réseau.

Le lien copié depuis l’admin reprend l’adresse utilisée pour ouvrir l’admin. **Pour partager un lien utilisable par les autres, ouvrir l’admin avec l’adresse LAN du serveur**, pas `localhost`.

Le poste principal est plus confortable sur ordinateur avec clavier ; l’interface s’adapte aux téléphones.

## Interface admin

- `/admin` : connexion par mot de passe, création de salles, départ commun, pause/reprise, fin de course, retrait d’un joueur et export JSON des résultats.
- `/board?code=ABCDEF` : projection avec le leader, les avatars, les pistes de progression et le datacenter animé, actualisée toutes les 1,5 seconde. Si l’admin est connecté dans le même navigateur, les boutons Démarrer, Pause, Reprendre et Terminer sont disponibles directement. Un spectateur ne voit pas ces commandes ; les API vérifient aussi les droits côté serveur.
- `/board` : ouvre la salle mémorisée dans cet onglet, ou la salle active la plus récente (à défaut, la dernière salle terminée). Aucun formulaire de code en projection. Pour sélectionner un autre code, utiliser la console globale `/admin`.
- Les liens entre la console globale et la projection naviguent dans le même onglet. Le menu Projection & classement conserve le code sélectionné. Un bouton Plein écran est disponible, selon les capacités du navigateur.
- `/?code=ABCDEF` : lien d’inscription des joueurs.

Pour rejouer, créer une nouvelle salle : les inscriptions se ferment au départ et une course commencée ne peut pas être remise à zéro. Cela conserve l’historique du classement.

## Règles et équité

- Les quatre missions sont identiques pour tous. L’accès aux fichiers n’est transmis par l’API qu’après le départ.
- Progression et validation côté serveur. Aucun champ client ne peut imposer un score, un rang ou une date de fin.
- Un joueur ne peut pas sauter une mission ou soumettre à nouveau après son arrivée.
- Le classement final suit l’ordre des dernières validations acceptées par le serveur, y compris si deux arrivées ont le même timestamp en millisecondes.
- Le temps affiché provient du serveur et exclut les pauses admin. La latence réseau fait partie de l’arrivée : utiliser le même réseau pour tous.
- Les erreurs ne donnent pas de pénalité supplémentaire ; le temps continue pendant les essais et la lecture.
- Avant l’arrivée : tri par missions terminées, puis pseudo. Ce tri provisoire ne désigne pas un vainqueur. Le bandeau de projection présente une tête de course partagée en cas d’égalité de progression ; personne n’est déclaré en tête uniquement à cause de son pseudo.
- Une session navigateur = un joueur. Les onglets partagent les cookies : pour simuler plusieurs joueurs sur un PC, utiliser des profils de navigateur distincts.
- Les éditions sont sauvegardées après 600 ms d’inactivité et lors d’une validation. Attendre « SAUVEGARDÉ » avant de recharger. La session joueur est conservée par cookie pendant 12 heures.

Il s’agit d’une activité pédagogique : le serveur bloque les contournements évidents de progression, mais ne détecte pas les joueurs qui échangent les solutions, automatisent leurs requêtes ou inspectent un exemplaire du code serveur. Ne pas distribuer `lib/game.mjs` ou les tests avant une compétition si l’on souhaite garder les solutions côté organisateur.

## Les quatre interventions

1. **KVM** : activer le prérequis CPU du modèle, choisir l’accélération KVM et relier le disque à virtio.
2. **Xen** : reconstruire l’architecture centralisée Dom0 / DomU et le chemin des E/S.
3. **Hyper-V** : pilotes dans la partition parente, VMBus et Secure Boot pour la VM Gen2 compatible du lab.
4. **ESXi** : choisir une destination compatible, autorisée et disponible, puis configurer la migration active avec transfert du stockage local.

Chaque mission fournit `incident.log`, `manual.md`, un JSON modifiable et, si nécessaire, un inventaire en lecture seule. Le terminal supporte `help`, `ls`, `cat`, `status`, `set`, `validate`, `reset` et `clear`. Il n’exécute jamais un shell ni du JavaScript fourni par le joueur. Une commande invalide reste dans le champ pour correction, avec une lueur rouge et une aide lisible. Les préfixes encore en cours de saisie ne s’allument pas immédiatement en rouge.

Les quatre racks s’allument à mesure des réparations. Les connexions des nœuds rétablis transportent des paquets animés ; les avatars avancent sur leurs pistes dans la projection. Chaque validation réussie déclenche une courte célébration non bloquante. L’option système de réduction des animations est respectée. Les manuels externes peuvent s’ouvrir dans un nouvel onglet ; la navigation interne reste dans le même onglet.

**Les fichiers JSON sont un modèle pédagogique propre au jeu.** Ils ne sont pas des formats de configuration réels de ces hyperviseurs. Modifier le modèle ne change aucun BIOS, aucune licence et aucun équipement réel. Les capacités réseau, l’accès au stockage et les compatibilités CPU non détaillées sont des hypothèses explicites de l’inventaire de simulation.

## Configuration du serveur

Variables d’environnement :

| Variable | Par défaut | Usage |
|---|---|---|
| `PORT` | `5173` | Port HTTP |
| `HOST` | `0.0.0.0` | Adresse d’écoute |
| `ADMIN_PASSWORD` | Généré au lancement | Mot de passe de la console admin |
| `DATA_DIR` | `./data` | Dossier des salles, fichiers et résultats |
| `COOKIE_SECURE` | non activé | Définir `true` uniquement avec HTTPS |
| `PUBLIC_ORIGIN` | non défini | Origine HTTPS exacte si utilisé derrière un proxy |

Exemple PowerShell :

```powershell
$env:ADMIN_PASSWORD = "choisis-un-long-mot-de-passe"
npm start
```

Exemple Bash :

```sh
ADMIN_PASSWORD='choisis-un-long-mot-de-passe' npm start
```

Le serveur utilise un fichier JSON écrit par remplacement atomique. **Un seul processus serveur** doit utiliser un même dossier de données. Conserver `data/arena.json` pour retrouver les salles après un redémarrage. Les sessions admin expirent au redémarrage ; les sessions joueurs restent reconnues si leurs cookies existent. Une course active continue de compter le temps pendant l’arrêt du serveur ; mettre en pause avant une maintenance prévue.

Ce paquet vise un lab et un serveur npm unique. Pour un accès Internet, utiliser un hébergement Node.js avec stockage persistant et un reverse proxy HTTPS ; configurer `PUBLIC_ORIGIN` et `COOKIE_SECURE`. Un hébergement de fichiers statiques seul ne peut pas faire fonctionner le serveur multijoueur. Le dossier public est le seul contenu statique servi ; les données et les validateurs ne sont pas téléchargeables par les routes HTTP.

## Personnalisation

- `public/style.css` : présentation et couleurs.
- `public/app.js` : workspace joueur, terminal et admin.
- `lib/game.mjs` : contenu pédagogique et validateurs (côté serveur).
- `server.mjs` : sessions, salles, chronomètre, persistance et API.
- `tests/` : validations métier et test de course multijoueur.

Après une modification des missions, tester dans **une nouvelle salle** pour éviter d’appliquer une nouvelle définition à une progression déjà sauvegardée.

## Sources pédagogiques

Les missions contiennent des liens vers les documents utilisés. Les valeurs de l’inventaire et le scénario sont fictifs.

- KVM : https://www.redhat.com/en/topics/virtualization/what-is-KVM
- Architecture Xen : https://xenproject.org/projects/hypervisor/
- Architecture Hyper-V : https://learn.microsoft.com/en-us/windows-server/virtualization/hyper-v/architecture
- Secure Boot Gen2 : https://learn.microsoft.com/en-us/windows-server/virtualization/hyper-v/generation-2-virtual-machine-security-features
- Édition gratuite ESXi 8.0 U3e : https://knowledge.broadcom.com/external/article/399823/vmware-esxi-80-update-3e-now-available-a.html
- Préconditions VMware et lien vers la migration sans stockage partagé : https://knowledge.broadcom.com/external/article?articleNumber=376998
- Migration et transfert du stockage : https://libvirt.org/migration.html

Les conditions de licences décrites concernent la version ESXi explicitement citée. Vérifier les documents éditeur avant tout déploiement réel.

## Mise à jour depuis la version 1.0

1. Arrêter le serveur avec Ctrl+C.
2. Remplacer `public/`, `lib/`, `server.mjs`, `package.json`, `README.md` et `tests/` avec ceux du nouveau ZIP.
3. **Conserver le dossier `data/` existant** : il contient les salles, résultats et sessions joueurs. Aucun dossier `data/` n’est inclus dans le ZIP.
4. Relancer `npm start`, se reconnecter à `/admin`, puis rafraîchir le navigateur (Ctrl+F5 si nécessaire).

Les anciennes salles restent lisibles : les champs de profil absents reçoivent un avatar par défaut et le nom d’hôte « Hôte ». Le nom et l’avatar de l’hôte sont choisis lors de la création d’une nouvelle salle. Les joueurs choisissent leur avatar à l’inscription.

Les nouvelles animations ont été créées pour ce jeu. Le clip Instagram proposé comme référence n’a pas pu être consulté ; elles n’en sont pas une reproduction vérifiée.

## Suppression d’une session terminée (v1.1.1)

Après « Terminer la course », un bouton **Supprimer la session** apparaît dans la console globale et dans la projection pour un hôte connecté. Une confirmation explicite est demandée. Cette action supprime définitivement la salle, ses joueurs, leurs fichiers et les résultats du stockage serveur ; les autres salles sont conservées. Exporter les résultats avant de confirmer si nécessaire. La suppression d’une salle en attente, en cours ou en pause est refusée côté serveur. Les anciens liens deviennent indisponibles et le code mémorisé de cette salle est effacé dans l’onglet concerné.

## Apprentissage et disposition du poste (v1.2)

Sur ordinateur avec une fenêtre d’au moins 1000 px de large et 650 px de haut, le poste utilise trois colonnes : mission et indices à gauche, fichier + terminal + validation au centre, animation du datacenter et classement à droite. Les panneaux ont leur propre défilement ; l’éditeur et le terminal restent accessibles dans la fenêtre. Sur les écrans plus petits, quatre onglets « Mission & indices », « Fichier », « Terminal » et « Datacenter » évitent une longue page empilée. La projection garde sa grande disposition.

Chaque objectif possède une explication, un champ à examiner et un indice de commande dépliable. « Préparer cette commande » sélectionne le JSON modifiable et remplit le terminal sans exécuter la commande. Le joueur doit appuyer sur Entrée. Les coches indiquent l’état local du fichier ; elles ne remplacent pas la validation serveur. Les indices n’ajoutent aucune pénalité ; tous les joueurs ont la même aide.

Le bouton « Copier le brief IA » copie les règles du simulateur, les objectifs précis et le contenu actuel du JSON. Un fichier `brief-assistant.md` en lecture seule est également disponible dans chaque mission après le départ. Si le presse-papiers n’est pas disponible (par exemple en HTTP sur le réseau local), le brief est téléchargé en Markdown. Il n’inclut aucun mot de passe ni cookie.

La fiche de commandes explique notamment `cat`, `set`, les chemins avec des points et la différence entre `"true"` (texte) et `true` (booléen). Les fichiers demeurent des modèles pédagogiques, sans exécution de commandes système réelles.

## Collaboration et classement joueur (v1.3)

À la création d’une salle dans `/admin`, choisir **Solo** ou **Collaboration**. Les anciennes salles restent en solo. En solo, chaque joueur possède son laboratoire et progresse dans l’ordre. En collaboration, saisir un même nom d’équipe à l’inscription permet de partager un datacenter. Chaque équipe accepte 1, 2, 3 ou 4 membres. Aucun plafond de nombre d’équipes n’est imposé par le jeu ; la capacité réelle dépend du serveur et du réseau.

Les quatre postes KVM, Xen, Hyper-V et ESXi sont accessibles dès le départ en équipe. Répartissez-vous les postes ou aidez un coéquipier : fichiers, réparations, progression et temps final sont communs. Le panneau d’équipe indique les membres et leur poste courant. La première équipe qui valide les quatre réparations gagne. Les modifications sont synchronisées ; une sauvegarde ancienne est refusée pour éviter d’écraser le travail d’un autre membre. En cas de conflit, télécharger sa copie puis recharger la version partagée.

Le bouton **Voir mon classement** affiche une fenêtre dans le jeu avec le rang individuel ou celui de l’équipe (1er, 2e, etc.). Il ne conduit pas à la projection ni à la console admin. Les liens de navigation hôte sont masqués dans l’interface joueur. Les actions administratives restent protégées côté serveur. Les rangs des participants encore en course sont provisoires ; les égalités de progression sont affichées par nom.

Il s’agit de laboratoires simulés en JSON, pas de machines virtuelles réelles. Le partage réduit les états de laboratoire dupliqués ; aucun gain de charge chiffré ni capacité maximale n’a été mesuré. Pour mettre à jour, conserver `data/`, remplacer les fichiers du programme puis relancer `npm start`.

## Interface guidée Helpy (v1.4)

Les serveurs animés en haut sont les sélecteurs de poste. En équipe, les quatre sont accessibles ; en solo, la progression reste séquentielle. La zone de travail propose deux onglets : **Workspace** pour choisir et modifier un fichier, **Terminal** pour saisir une commande. Ils agissent sur le même fichier, sans nécessiter de répéter les modifications.

**Helpy** remplace la colonne de mission et le classement latéral pendant les réparations. Il propose le premier réglage encore incorrect, explique la valeur attendue et permet de préparer une commande sans l’exécuter. Les réglages locaux ne deviennent une réparation validée qu’après le test serveur. Les erreurs de syntaxe déclenchent une réaction d’aide ; une réparation réussie déclenche une célébration. Le classement reste disponible dans la fenêtre « Voir mon classement ».

Un guide de navigation apparaît à la première ouverture d’un poste actif dans l’onglet navigateur. Le bouton **? Guide** permet de le revoir. En petit écran, Helpy est placé au-dessus de la zone de travail. Les animations respectent la préférence de réduction des mouvements.

## Racks et aide contextuelle (v1.4.1)

Le panneau du datacenter reprend les quatre racks reliés et leurs paquets animés : les cabinets eux-mêmes sont cliquables. Les serveurs à réparer clignotent en rouge et les serveurs validés en vert ; le contour bleu indique le poste sélectionné. Le pourcentage et le statut Campus API suivent les réparations validées.

Helpy affiche une courte bulle adaptée au fichier sélectionné, au champ visé dans une commande `set`, à sa valeur, à la syntaxe et aux réglages restants. Ce guide repose sur des règles locales, sans modèle IA ni service externe. « Un exemple ? » révèle une commande ; « Préparer » remplit le terminal sans exécution. Workspace et Terminal utilisent des onglets plus compacts.

Le guide de démarrage met successivement les vrais contrôles en lumière avec une petite illustration, une explication courte et les boutons Retour / Suivant / Passer. Il sélectionne automatiquement Workspace ou Terminal pour montrer la bonne zone. Échap ferme le guide ; le bouton « ? Guide » le relance.

Les paquets verts circulent sur un lien uniquement lorsque **les deux serveurs voisins** sont validés. Deux serveurs restaurés non adjacents ne créent pas de lien actif entre eux.

## Éditeurs et Helpy séquencé (v1.5)

Dans le terminal simulé, `nano kvm.json` et `gedit kvm.json` ouvrent le fichier existant dans Workspace. Sans nom, ils ouvrent le fichier sélectionné. Aucun programme natif n’est lancé. Le joueur choisit librement l’édition directe ou les commandes `set` ; les deux modifient les mêmes fichiers partagés.

À la première visite de chaque serveur dans cet onglet, Helpy salue le joueur par son nom, résume la réparation puis propose d’ouvrir le JSON. Chaque page reste dix secondes ; une action du joueur interrompt l’introduction pour passer à l’aide contextuelle. Les longs messages sont découpés dans une bulle de taille fixe. La lecture s’arrête pendant le guide, une pause de salle ou lorsque l’onglet est masqué.

Après trois commandes invalides ou tests de réparation refusés sans progression, Helpy affiche automatiquement une commande correspondant au prochain réglage manquant. Un réglage corrigé remet ce compteur à zéro. Le petit robot bouge doucement, respecte la réduction des animations et son panneau est borné par la hauteur de la fenêtre.

## Missions avancées, contrôle global et durée (v1.6)

Créer une **nouvelle salle** pour cette version : les anciens fichiers sauvegardés peuvent ne pas contenir les nouveaux champs. Conserver `data/` pour garder les résultats précédents. Les missions ajoutent diagnostic.json en lecture seule, contraintes de mémoire, stockage, VLAN et calcul de débit. Toutes les valeurs appartiennent à un scénario fictif ; aucune VM, commande système ni connexion réseau réelle n’est exécutée.

Terminal est la vue initiale. Chaque membre peut éditer puis utiliser `systemctl restart SERVICE`, avec le service indiqué dans incident.log. `systemctl status` consulte l’état. Le redémarrage seul ne donne aucune progression. Les éditions directes ou les commandes set continuent d’agir sur les mêmes fichiers. Une nouvelle modification rend nécessaire un nouveau redémarrage du service.

En équipe, le bouton **Tester la réparation · 4 serveurs** apparaît sous la zone de travail. **Seul le créateur de l’équipe peut l’utiliser**, avec contrôle côté serveur. Le bouton teste les quatre services et les communications de la chaîne KVM ↔ Xen ↔ Hyper-V ↔ ESXi. Tout doit réussir : les liens deviennent verts, les paquets circulent et le temps final est enregistré. `ping VOISIN` reste disponible pour diagnostiquer les liaisons avant le test global, et `check network` est l’équivalent terminal du bouton. En solo, un `ping gateway` réussi après chaque redémarrage débloque le poste suivant.

À la création, l’hôte choisit la **durée limite en minutes**, de 1 à 240 ; 0 désactive la limite. La valeur initiale du formulaire est 20 minutes. Le temps restant s’affiche dans la barre de salle. À l’échéance, le serveur ferme la course et refuse les nouvelles éditions, commandes de redémarrage et contrôles finaux ; les résultats restent consultables. Les pauses admin suspendent le décompte. Parmi les équipes ayant réussi le contrôle final, la plus rapide gagne. Les équipes inachevées apparaissent ensuite selon leur progression.

Helpy donne d’abord des pistes sans commande de solution. L’exemple exact n’apparaît qu’après **plus de 20 secondes sans progrès**, si une erreur a été commise ou une aide demandée. Corriger un réglage remet ce délai à zéro. C’est une aide pédagogique locale, pas un dispositif anti-triche : code et fichiers restent consultables.

### Diagnostic préalable et test fonctionnel simulé

Les fichiers modifiables ne sont révélés qu’après un diagnostic léger : `diagnose` ou `systemctl status` dans le terminal. Le serveur refuse une édition directe avant cette étape. Le rapport distingue démarrage VM, stockage, réseau et service, puis débloque le manifeste à réparer.

Le contrôle global simule les vérifications de démarrage VM, accès aux données, interface/VLAN, service effectivement redémarré, échanges applicatifs entre nœuds et requête `GET /health` suivie d’une transaction lecture/écriture. Il exige un statut simulé 200 et un aller-retour de données réussi ; une simple connectivité réseau ne suffit pas. Ces contrôles sont calculés sur le modèle de jeu, **pas sur des VM réelles**. Helpy explique le diagnostic, la réparation, le redémarrage et le contrôle global.

## Sons et podium (v1.6.1)

Les messages de Helpy passent toutes les **5 secondes**. Le délai des indices de solution reste supérieur à 20 secondes de difficulté sans progression.

Les effets sonores locaux accompagnent les commandes invalides, les réparations refusées (petit grognement de Helpy), les services rétablis, la fin individuelle et l’expiration du temps. Ils sont synthétisés dans le navigateur, sans téléchargement audio. Le bouton « ♫ Son / Muet » conserve la préférence de l’appareil. Le navigateur doit avoir reçu une interaction du joueur pour autoriser le son.

Quand la salle est terminée ou que tous les participants ont fini, un podium révèle les participants ayant réussi dans l’ordre **3e, 2e, 1er**, avec une montée sonore et une animation plus marquées pour le premier. La cérémonie apparaît dans la projection et chez les joueurs ; la console admin reçoit aussi le podium lorsque la salle se termine pendant qu’elle est ouverte. « Voir le podium » permet de la revoir. Les participants n’ayant pas terminé ne reçoivent pas de place fictive sur le podium. Le classement et les règles de jeu restent inchangés. Les animations respectent la préférence de réduction des mouvements.

## Ambiance audio (v1.6.2)

Helpy émet une courte voix électronique lorsque sa bulle change de page. Une mélodie originale synthétisée accompagne le lobby ; elle s’arrête au départ. Les cinq dernières secondes du départ ont des bips distincts, suivis d’un son de lancement. Les quinze dernières secondes de la durée de session ont également un bip par seconde ; les cinq dernières utilisent une tonalité plus urgente, avant le son de fin.

Les effets passent maintenant par un bus audio amplifié, un compresseur et un limiteur. Le curseur de volume du jeu et le bouton Muet sont mémorisés localement. Le volume initial est 100 % ; le volume effectivement entendu dépend aussi du navigateur, du système et des haut-parleurs. Il n’existe pas de niveau unique « YouTube » garanti. Le son attend une première interaction dans la page. La musique s’arrête lorsque l’onglet est masqué, le jeu commence ou le podium s’ouvre. Les délais de Helpy restent 5 secondes et les indices de solution conservent leur délai supérieur à 20 secondes.

## Priorité des effets de réussite (v1.6.3)

Les sons de réussite d’un redémarrage, d’une communication ou de la fin du jeu ont priorité sur la voix de Helpy. Ils interrompent ses notes déjà en cours et bloquent les nouvelles syllabes jusqu’à la fin de l’effet. Un message de Helpy ne peut plus faire ignorer le son positif via le délai anti-répétition. Les sons de réussite ont aussi priorité dans l’attente de l’activation audio par le navigateur.
