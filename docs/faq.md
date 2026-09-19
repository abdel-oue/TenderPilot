# FAQ — les choix que j'assume

Le cahier des charges autorise de sortir du socle recommandé « à condition de
l'assumer en soutenance ». Ce document est cette soutenance, écrite. Chaque
réponse dit ce que j'ai choisi, contre quoi, et ce que ça m'a coûté.

| | |
|---|---|
| **Écarts au socle recommandé** | [JavaScript plutôt que TypeScript](#pourquoi-javascript-plutôt-que-typescript-sur-lapi-) · [Next.js plutôt que React + Vite](#pourquoi-nextjs-plutôt-quune-spa-react--vite-) · [Node 22 plutôt que Node 20](#pourquoi-node-22-plutôt-que-node-20-) · [Drizzle plutôt qu'un client SQL brut](#pourquoi-drizzle-et-pas-du-sql-brut-ou-un-orm-complet-) |
| **Architecture** | [Les bornes dans l'arête](#pourquoi-borner-les-boucles-dans-larête-et-pas-dans-le-prompt-) · [L'OCR page par page](#pourquoi-une-décision-docr-par-page-et-pas-par-document-) · [Une colonne `nature`](#pourquoi-une-colonne-nature-à-trois-valeurs-plutôt-quun-booléen-éliminatoire-) · [Sondage **et** SSE](#pourquoi-garder-un-sondage-alors-quil-y-a-déjà-un-flux-sse-) |
| **Déploiement** | [Une instance en ligne](#pourquoi-une-instance-en-ligne-alors-que-le-sujet-ne-demande-que-docker-compose-up-) |

---

## Écarts au socle recommandé

### Pourquoi JavaScript plutôt que TypeScript sur l'api ?

J'ai choisi JavaScript plutôt que TypeScript parce que sur un hackathon solo de
55 h, le coût du typage statique a un ROI négatif — j'ai gardé la sécurité en
validant aux entrées de l'api plutôt qu'à la compilation.

Concrètement, ce que TypeScript m'aurait coûté ici : une étape de build entre
moi et l'exécution, des types à réécrire à chaque changement de forme pendant que
la forme change encore toutes les heures, et du temps passé à satisfaire le
compilateur sur du code que je vais jeter.

Ce que j'ai mis à la place n'est pas « rien » : **zod à chaque frontière**, et
c'est une règle, pas une intention. Un corps HTTP, une sortie de modèle, un
fichier sur disque, une variable d'environnement — tout est `parse` ou
`safeParse` au moment où ça entre. À l'intérieur, la valeur est de confiance.

C'est un meilleur filet que le typage statique sur la partie qui casse vraiment
dans ce produit : un modèle qui renvoie un JSON différent de celui qu'il a promis.
TypeScript ne voit rien de ce qui arrive à l'exécution ; `safeParse` le voit,
journalise les `issues`, relance une fois avec les erreurs réinjectées dans le
prompt, puis échoue bruyamment en `SCHEMA_VALIDATION_FAILED`.

**Ce que ça me coûte, et que j'assume :** un renommage ne se propage pas tout
seul, et rien ne rattrape un `await` oublié — c'est une revue, pas un
compilateur. Je l'ai payé en tests : chaque schéma zod est aussi testé avec une
charge malformée, et 399 tests unitaires tournent sans réseau ni base.

Le web, lui, **est** en TypeScript : les schémas partagés vivent en JavaScript
dans `packages/shared`, l'api les importe directement, et le front en tire ses
types par `z.infer`. Une seule définition, deux langages.

### Pourquoi Next.js plutôt qu'une SPA React + Vite ?

Le socle recommande React 18 + Vite. J'ai pris Next.js 16 + React 19 pour trois
raisons, dans cet ordre :

1. **Le routage et la structure sont donnés.** `app/tenders/[id]/page.tsx` est une
   route, sans routeur à câbler, sans layout à réinventer. Sur 55 h, chaque heure
   passée sur de la plomberie est une heure qui ne va pas à l'agent, qui pèse 30 %
   de la note.
2. **La vitrine et l'application vivent dans la même application.** La page
   publique est rendue côté serveur, bilingue, et l'espace de travail est une SPA
   authentifiée derrière la même origine.
3. **Le déploiement.** Vercel construit le dépôt tel quel ; je n'ai pas eu à
   fabriquer un pipeline pour avoir une URL à montrer.

**Ce que ça ne change pas :** l'application ne fait **aucun appel serveur vers
l'api**. Tous les composants qui chargent des données sont des composants client,
et ils passent par un unique `lib/api/client.ts`. Le navigateur reste le seul
client que l'api ait jamais — donc le contrat entre les deux moitiés est resté
celui d'une SPA, CORS et cookie compris.

### Pourquoi Node 22 plutôt que Node 20 ?

Parce que Node 22 me donne, sans aucune dépendance : `--env-file` (donc pas de
`dotenv`), `fetch` natif (pas de `node-fetch`), `crypto.randomUUID` (pas de
`uuid`), `import.meta.dirname` (pas de `fileURLToPath(import.meta.url)` partout)
et `--watch` (pas de `nodemon`). Cinq paquets en moins, cinq choses de moins à
expliquer.

Le risque était la compatibilité des bibliothèques du socle — LangGraph, Fastify,
BullMQ, `postgres` — et aucune n'a bronché. L'image Docker est
`node:22-alpine`, épinglée, donc la version que le jury exécute est la mienne.

### Pourquoi Drizzle, et pas du SQL brut ou un ORM complet ?

Il me fallait trois choses : des requêtes lisibles, `pgvector` utilisable, et
des migrations versionnées. Drizzle donne les trois sans couche magique — le
constructeur de requêtes est proche du SQL, et là où il ne suffit pas (la
similarité vectorielle, une sous-requête corrélée), j'écris du `sql\`\`` dans le
même fichier `.repository.js`, avec un commentaire qui dit pourquoi.

Un ORM complet aurait apporté des relations paresseuses et un cache d'identité
dont je n'ai pas besoin. Du SQL brut m'aurait coûté les migrations générées, qui
sont exactement ce qui rend le dépôt rejouable chez quelqu'un d'autre.

**La règle qui va avec :** tout le SQL vit dans `repositories/[entité].repository.js`.
Une requête écrite ailleurs est un bug, pas un raccourci.

---

## Architecture

### Pourquoi borner les boucles dans l'arête et pas dans le prompt ?

Un prompt qui dit « n'essaie pas plus de deux fois » est une demande polie. Le
modèle peut l'ignorer, et rien ne le rattrape.

`MAX_REDRAFTS = 2` et `MAX_HUMAN_ASKS = 3` sont évalués en JavaScript, dans la
condition d'arête et dans l'outil. Ils tiennent même quand le modèle dérape. Une
boucle d'agent non bornée pendant une démonstration en direct n'est pas un
incident improbable : c'est le mode de panne le plus probable.

### Pourquoi une décision d'OCR par page et pas par document ?

Parce qu'un dossier est rarement d'une seule matière. Un CPS de 60 pages avec
cinq annexes scannées est mixte, et décider par document force un choix perdant
dans les deux sens : tout OCRiser (lent et inutile), ou se fier à la couche texte
(les cinq annexes disparaissent sans que personne le voie).

Chaque page est donc lue sans OCR d'abord ; seules celles dont le texte n'est pas
exploitable sont rastérisées et passées à Tesseract. Les pages à OCRiser sont
regroupées en plages contiguës, donc un scan intégral reste une seule
rastérisation.

Une page que l'OCR n'a pas su lire **reste une ligne**, marquée `unread`. Jamais
supprimée, jamais renvoyée comme page vide : vide se lirait « cette page ne dit
rien », et c'est comme ça qu'un agent invente des exigences pour un scan.

### Pourquoi une colonne `nature` à trois valeurs plutôt qu'un booléen `éliminatoire` ?

Parce que les trois cas n'ont pas la même conséquence, et qu'un booléen posé à
côté d'une `obligation` peut se contredire.

Seule une **capacité** exigée et non satisfaite écarte l'entreprise. « Déposer le
pli avant le 12/03 à 09h30 » est une **procédure** : une tâche de la réponse, pas
une preuve d'inéligibilité — l'entreprise ne peut pas échouer aujourd'hui à une
tâche future. « Obtenir 60 points sur 85 » est une **notation**, tranchée par la
commission après le dépôt.

Sans cette distinction, chaque dossier revenait en no-go parce que le profil ne
disait rien d'une date de dépôt. Le corpus contient six dossiers jouables et
quatre perdus : un agent qui répond « non » systématiquement se trompe six fois
sur dix.

### Pourquoi garder un sondage alors qu'il y a déjà un flux SSE ?

Parce qu'ils ne répondent pas à la même question.

La trace durable est écrite **à la fin de chaque nœud**. Un nœud qui appelle six
outils en vingt secondes se tait, puis dit tout d'un coup : l'écran montre un
spinner, puis un mur de texte. Le flux SSE existe pour ça, et pour ça seulement —
il porte la ligne d'un outil **au moment où cet outil rend la main**.

Mais il ne fait jamais foi. Tout ce qu'il transporte est aussi en base et arrive
de toute façon sur le sondage d'une seconde. Un flux coupé, un Redis absent, un
proxy qui n'aime pas SSE : l'écran redevient ce qu'il était avant, avec une
seconde de retard. Pas de logique de reconnexion, pas de tampon, pas de surface
d'erreur — c'est ce qui rend cette fonctionnalité petite.

---

## Déploiement

### Pourquoi une instance en ligne alors que le sujet ne demande que `docker compose up` ?

Le sujet est clair : « le jury clone, fait `docker compose up`, et teste ». C'est
la voie officielle et elle marche — c'est le test d'acceptation de
[deployment.md](deployment.md), et `npm run up` sur un clone propre démarre les
cinq services, applique les migrations et sème la base.

L'instance en ligne ne la remplace pas. Elle existe parce qu'une URL qu'on ouvre
en dix secondes est le moyen le plus court de montrer le produit — dans une
soutenance de deux minutes, un build Docker qui démarre pendant qu'on parle
consomme la moitié du temps.

Deux moitiés séparées : le web est construit par Vercel sur
`tenderpilot.ouedghiri.dev`, et le VPS ne fait tourner que l'api, le worker,
postgres et redis derrière nginx sur `api.tenderpilot.ouedghiri.dev`. Les deux
partagent le domaine `ouedghiri.dev`, donc le cookie de session reste
`SameSite=Lax` : un front sur une URL `*.vercel.app` aurait imposé
`SameSite=None`, c'est-à-dire une vraie perte de protection CSRF pour une
commodité.

**Ce que ça ne m'a pas coûté :** rien dans le code. Le compose de production est
une surcharge de quinze lignes qui gare le service `web`, et la même image
d'api tourne en local et sur le VPS.
