# Le front

`apps/web`, Next.js App Router + React 19, en **TypeScript**. Le seul client de
l'api : aucun appel modèle, aucun accès base. Pour les endpoints qu'il consomme,
voir [api.md](api.md) ; pour ce qui se passe derrière, [pipeline.md](pipeline.md).

## Les routes

| Route | Fichier | Contenu |
|---|---|---|
| `/` | `app/page.tsx` | la page vitrine, bilingue fr/en, thème clair/sombre |
| `/login` | `app/login/page.tsx` | connexion, validation et visibilité du mot de passe ; cible de redirection quand la session expire |
| `/signup` | `app/signup/page.tsx` | inscription puis profil entreprise |
| `/dashboard` | `app/dashboard/page.tsx` | compteurs, dossiers récents, échéances et progression |
| `/dashboard/controle` | `app/dashboard/controle/page.tsx` | **Contrôle** : toutes les analyses lancées, leur trace, leurs jetons |
| `/dashboard/guide` | `app/dashboard/guide/page.tsx` | guide de démarrage |
| `/company` | `app/company/page.tsx` | profil entreprise, corpus, imports |
| `/tenders` | `app/tenders/page.tsx` | la liste des dossiers et leur verdict |
| `/tenders/new` | `app/tenders/new/page.tsx` | création du dossier et dépôt PDF |
| `/tenders/[id]` | `app/tenders/[id]/page.tsx` | un dossier : verdict, notation détaillée, risques, exigences et leur raison, sections, trace |

Il n'y a pas d'écran Paramètres : le compte, le thème, le guide de démarrage et la
déconnexion vivent dans le menu de compte, en bas du rail.

Les layouts de `/dashboard`, `/company` et `/tenders` utilisent `WorkspaceShell` :
session requise, rail flottant, menu mobile accessible et transitions respectant la
préférence de mouvement réduit. La connexion ouvre `/dashboard` ; l’inscription
ouvre `/company`. Un changement de compte efface les requêtes du compte précédent.

Les compteurs et échéances proviennent de `GET /tenders`, sans données fictives
dans l’application. La liste propose recherche et filtres de statut. Les analyses
actives déclenchent un rafraîchissement toutes les cinq secondes. Les états vides,
chargements et erreurs avec réessai sont affichés explicitement. Le profil
entreprise s’importe depuis un fichier JSON ; ses documents PDF restent séparés.

## La session

Le cookie de session est `httpOnly` et posé par l'api **sur une autre origine**
(web `:3100` → api `:3000`). Un middleware Next ne peut donc pas le lire : la
vérification se fait côté client, contre `GET /auth/me`, d'où
`components/auth/requireSession.tsx` plutôt qu'un middleware.

Sans lui, `/tenders` s'afficherait pour un visiteur déconnecté et chaque panneau
échouerait sur son propre 401 — une page d'erreur en forme de tableau de bord au
lieu du formulaire de connexion.

## Le chemin des données

```
composant ──▶ hooks/use[Nom].ts ──▶ lib/api/[entité].ts ──▶ lib/api/client.ts ──▶ api
                 TanStack Query          une fonction            un seul fetch
                                          par endpoint       credentials: "include"
```

- **`lib/api/client.ts` est le seul `fetch` de l'application.** Le mode
  d'authentification, la forme d'erreur (`ApiError { message, code }`) et le
  traitement JSON y sont définis une fois. Un `FormData` part tel quel, sans
  `content-type` : c'est au navigateur d'ajouter la frontière multipart.
- **Jamais `useEffect` + `fetch`.** Un hook + TanStack Query v5, toujours.
- **Une fabrique de clés par domaine** (`lib/keys/[feature]Keys.ts`), pour qu'une
  invalidation après mutation ne rate pas une clé sur une faute de frappe.
- `useMutation` invalide les clés concernées dans `onSuccess`.
- `QueryClient` : `staleTime` 30 s, pas de refetch au focus (`app/providers.tsx`).

### Le suivi d'une analyse

Deux transports, et le sondage est celui qui fait foi.

`hooks/useAnalysis.ts` **interroge** l'api toutes les secondes tant que le run est
`queued`, `running` ou `awaiting_human`, et s'arrête sinon. La trace vit en base
(`analysis_runs.node_trace`), donc elle survit à un rafraîchissement, à une
reconnexion et à un réseau qui mange le SSE.

`hooks/useRunStream.ts` ouvre en plus un `EventSource` sur
`GET /tenders/:id/analysis/stream` tant que le run est vivant. Il n'apporte qu'une
chose que le sondage ne peut pas donner : la ligne d'un outil **au moment où cet
outil rend la main**, alors que la trace durable n'est écrite qu'à la fin du nœud —
un nœud qui appelle six outils en vingt secondes se tait, puis dit tout d'un coup.

C'est un miroir, jamais une source de vérité : pas de reconnexion à la main, pas de
tampon, pas de surface d'erreur. Un flux coupé ramène l'écran à ce qu'il faisait
avant, avec une seconde de retard.

`hooks/useRuns.ts` sert `/dashboard/controle` : la liste se rafraîchit toutes les
trois secondes tant qu'un run est vivant, et le détail d'un run n'est chargé que
lorsque sa ligne est dépliée.

## Les types

Tout ce qui a un schéma zod est importé de `@tenderpilot/shared` et typé par
`z.infer`. `lib/types.ts` ne contient que les formes que l'api renvoie **sans**
schéma partagé (lignes de liste, enveloppe d'analyse). Un type dupliqué entre web et
api est un bug, pas un raccourci.

## Composants

- Server Components par défaut. `'use client'` seulement pour : hooks, API
  navigateur, gestionnaires d'événements, Context.
- Interface de props déclarée au-dessus du composant. `unknown` puis narrowing,
  jamais `any`.
- Chaque composant de données traite ses **trois** états : chargement (squelette sur
  les pages), erreur, succès.
- Formulaires : composants contrôlés + `useState`, `onClick` sur le bouton. Jamais
  `<form onSubmit>`. L'état de chargement et l'erreur viennent du résultat de la
  mutation.
- Fichiers en `camelCase.tsx`, composant en PascalCase à l'intérieur.
- État serveur : TanStack Query. État d'interface : `useState` / `useReducer`. Pas
  de Redux, pas de Zustand, pas de Jotai.

## Thème et couleurs

Les jetons de design vivent dans le bloc `@theme` de `app/globals.css`, pas dans
`tailwind.config.js`. Les couleurs passent toutes par des variables CSS — aucun hex,
aucune valeur arbitraire Tailwind. `--color-go` et `--color-no-go` sont des alias de
`--positive` / `--warning` : le verdict a un nom, pas une teinte codée en dur.

Thème via `next-themes` (`attribute="class"`, clair par défaut, pas de suivi
système), icônes Lucide, animations Framer Motion entre 0,15 s et 0,4 s avec
`AnimatePresence` pour les sorties, composition de classes par `cn()`
(`lib/utils/classNameUtils.ts`).

## Langue

La vitrine est bilingue : `lib/landing/fr.ts` et `en.ts`, sélection par
`?lang=fr|en` mémorisée en cookie (`lib/landing/getLocale.ts`). Français par défaut.
L'application, elle, est en français — les messages d'erreur viennent de l'api.

## Tests

`apps/web/tests/` en miroir du chemin source, `[nom].test.ts`, jamais à côté du
code. Les parcours Playwright vivent dans `apps/web/e2e/`, sélectionnés par
`data-testid` — jamais une classe CSS, jamais un texte qu'un changement de copie
casserait. Détails et état actuel : [testing.md](testing.md).
