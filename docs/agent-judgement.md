# Deux correctifs sur le jugement de l'agent

> **État : les deux sont appliqués.** `parseDate` accepte un suffixe horaire sur
> les trois formats et `parseTime` rend l'heure (`apps/api/src/lib/dates.js`,
> couvert par `tests/lib/dates.test.js`) ; `ASK_HUMAN_DESCRIPTION` est réécrite
> autour de l'arbitrage (`apps/api/src/prompts/askHuman.prompts.js`, couverte par
> `tests/prompts/askHuman.prompts.test.js`). Ce document garde le constat et le
> raisonnement, qui sont ce qui a de la valeur ensuite.

Deux problèmes distincts, la même racine : l'agent échoue à l'endroit où le
dossier réel ne ressemble pas au dossier idéal. Un outil refuse la forme sous
laquelle la date de dépôt est réellement écrite, et `ask_human` est décrit comme
un outil pour ce qu'on ignore alors qu'il devrait servir pour ce qu'on sait mais
qui ne tranche pas.

---

## 1. `compute_deadline` ne lit pas une date de dépôt

### Le constat

Sur **chaque** dossier du corpus, l'outil échoue au premier appel :

```
échec : Date illisible : "08/07/2026 09:30". Formats acceptes : 2026-03-12, 12/03/2026, "12 mars 2026".
```

Ce n'est pas un cas limite. C'est la forme normale d'une date limite dans un CPS
marocain — un dépôt de plis a une heure, toujours. Verbatim du corpus
(`AO-2026-003`) :

> Les plis doivent parvenir au bureau d'ordre du maître d'ouvrage au plus tard le
> **08/07/2026 à 09h30**
>
> Date de la séance publique **08/07/2026 à 10h00**

Le modèle lit cette phrase et passe la date telle qu'elle est écrite. L'outil la
rejette.

### La cause

`parseDate` dans [apps/api/src/lib/dates.js](../apps/api/src/lib/dates.js) ancre
deux de ses trois motifs sur `$` :

```js
const numeric = text.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{4})$/);
const long    = text.match(/^(\d{1,2})\s+([a-zéû]+)\s+(\d{4})$/);
```

Le motif ISO, lui, n'est ancré qu'au début — ce qui est précisément pourquoi
`2026-07-08T09:30:00Z` passe. Les trois formats n'ont pas la même tolérance, sans
raison.

Comportement actuel, vérifié :

| Entrée | Aujourd'hui |
|---|---|
| `2026-07-08` | ✅ |
| `2026-07-08T09:30:00Z` | ✅ |
| `08/07/2026` | ✅ |
| `8 juillet 2026` | ✅ |
| `08/07/2026 09:30` | ❌ |
| `08/07/2026 à 09h30` | ❌ |
| `08/07/2026 09h30` | ❌ |
| `8 juillet 2026 à 09h30` | ❌ |

### Pourquoi ça compte même si l'agent s'en sort

Il s'en sort : il rappelle l'outil sans l'heure et obtient sa réponse. Mais

- ça consomme un appel d'outil sur un budget borné (`MAX_TOOL_ROUNDS`), à chaque
  dossier, deux fois par analyse ;
- **`échec : Date illisible` s'affiche maintenant dans le fil de raisonnement**,
  sous les yeux de la personne à qui on demande de faire confiance à l'agent ;
- l'agent perd l'heure en chemin. Une échéance à 09h30 dépassée à 11h le jour même
  est traitée comme « il reste 0 jour », ce qui se lit comme « c'est encore
  possible ».

### Le correctif

**Un seul principe : la même tolérance pour les trois formats.** Une date peut
être suivie d'une heure, et l'heure est conservée puis rendue à l'appelant.

1. **Accepter un suffixe horaire** sur `numeric` et `long`. Remplacer l'ancre `$`
   par une frontière suivie d'une heure optionnelle, et non simplement la
   supprimer — sans frontière, `08/07/20261` parserait en `08/07/2026`, ce qui est
   exactement le genre de devinette que ce fichier refuse par ailleurs.

   Les formes à couvrir, toutes présentes dans le corpus ou produites par le
   modèle : `à 09h30`, `a 09h30`, `09h30`, `09:30`, `à 10h00`.

2. **Rendre l'heure**, ne pas seulement la tolérer. `parseDate` continue de rendre
   une `Date` à minuit UTC — l'arithmétique reste en jours, c'est suffisant et
   c'est testable sans fuseau. Ajouter à côté une fonction qui extrait l'heure
   quand elle est là, et la faire remonter dans la réponse de `computeDeadline` :

   ```
   { deadline: "2026-07-08", heureLimite: "09:30", joursCalendaires: 12, … }
   ```

   Le `note` de l'outil dit déjà que les jours fériés ne sont pas déduits. Il doit
   dire aussi, quand l'heure est connue, que le dernier jour n'est pas un jour
   entier.

3. **Ne pas déduire l'heure quand elle est absente.** Une date sans heure reste une
   date sans heure : `heureLimite: null`. Inventer « 23h59 » serait une précision
   que le CPS n'a pas donnée, et c'est le mode d'échec contre lequel tout ce
   produit est construit.

4. **Le message d'erreur doit montrer la forme qui vient d'échouer.** Aujourd'hui
   il liste trois formats dont aucun ne porte d'heure, ce qui apprend au modèle à
   retirer l'heure — donc à perdre l'information. Il doit citer
   `"12/03/2026 à 09h30"` parmi les formats acceptés.

### Tests

Dans [apps/api/tests/lib/dates.test.js](../apps/api/tests/lib/dates.test.js), qui
couvre déjà les trois formats nus :

- chacune des lignes ❌ du tableau ci-dessus rend la bonne date ;
- l'heure est extraite pour `09h30`, `09:30`, `à 10h00`, et `null` sans heure ;
- **`08/07/20261` et `08/07/2026 xyz` restent refusés** — c'est le test qui dit
  que la tolérance est une tolérance et non la suppression de l'ancre ;
- `31/02/2026` reste refusé (déjà couvert, ne pas régresser).

Côté `tools.service.test.js` : un appel `compute_deadline` avec
`"08/07/2026 à 09h30"` rend `joursCalendaires` et `heureLimite`, pas `{ error }`.

### Observation connexe, hors périmètre

`tenders.deadline` est **NULL sur les cinq dossiers du corpus**. L'agent extrait
la date du PDF à chaque analyse, mais rien ne l'écrit sur le dossier. C'est
pourquoi la carte « Prochaines échéances » du tableau de bord était toujours vide
avant d'être retirée, et pourquoi `shortDate(tender.deadline)` affiche « Non
renseignée » partout dans `Mes dossiers`.

Le nœud `extractRequirements` a la date sous les yeux. La persister
(`tenders.updateDeadline`) réglerait les deux écrans d'un coup et donnerait à
`compute_deadline` une source qui ne dépend pas du modèle pour retaper une date.
**Non inclus ici** : c'est un changement de pipeline, pas un correctif d'outil.
À décider séparément.

---

## 2. `ask_human` sert à trancher, pas à s'informer

### Le constat

La description actuelle
([apps/api/src/prompts/askHuman.prompts.js](../apps/api/src/prompts/askHuman.prompts.js))
dit :

> quand la réponse changerait ta conclusion et que **rien dans le dossier ni dans
> le profil ne permet de trancher**

C'est le cadrage « information manquante », et il est faux. Formulé ainsi,
l'outil se déclenche quand l'agent ne *sait* pas quelque chose — or quand l'agent
ne sait pas, il a dix autres outils pour aller voir. Sur le corpus, il n'appelle
jamais `ask_human` : il n'est jamais assez ignorant pour ça.

Le vrai moment est l'inverse. **L'agent a tous les faits, et les faits ne
décident pas.** La règle du CPS est ambiguë, ou le seuil est manqué de si peu
que deux personnes raisonnables trancheraient différemment — et la conséquence
est un no-go, c'est-à-dire un dossier auquel l'entreprise ne répondra pas.

### Les trois cas qui doivent déclencher l'outil

Ce sont les exemples réels, et ils appartiennent tous à la même famille :

1. **Validité dans le temps.** *Une attestation est expirée à la date limite de
   l'avis : est-ce un no-go, ou peut-on considérer qu'elle sera renouvelée avant
   le dépôt ?* Le fait est établi — la date est lue, elle est dépassée. Ce qui
   est en jeu est une pratique commerciale que l'agent n'a aucun moyen de
   connaître.

2. **Seuil manqué de peu.** *L'avis exige un chef de projet avec 13 ans
   d'expérience, le meilleur CV en a 12 : éliminatoire, ou risque sur la note
   technique ?* Le chiffre n'est pas incertain. C'est la **nature** de l'exigence
   qui l'est, et `docs/agents.md` explique déjà que `capacite` écarte et
   `notation` non. Un an d'écart sur une exigence classée `capacite` supprime le
   dossier ; classée `notation`, elle coûte quelques points.

3. **Preuve non jointe.** *Peut-on considérer les certifications du profil
   (ISO 9001, ISO 27001, Qualiopi) comme valides, sans certificat daté fourni ?*
   Le profil les déclare, le dossier ne les prouve pas. Retenir la déclaration,
   c'est risquer un rejet sur pièce ; l'écarter, c'est un no-go sur une
   certification que l'entreprise détient peut-être réellement.

**Le dénominateur commun : un fait établi, une règle qui ne le tranche pas, et un
no-go au bout.** C'est ça, la description à écrire.

### Ce qui ne doit PAS déclencher l'outil

Aussi important, et à écrire explicitement dans la description — un outil
présenté comme « demande quand tu hésites » devient un outil qui demande tout le
temps :

- « Détenez-vous la certification X ? » → `get_company_facts`, la réponse est en
  base ;
- « Ce document est-il au dossier ? » → `check_dossier_checklist` ;
- « Que dit l'article 5 ? » → `read_source_page` ;
- confirmer une conclusion dont l'agent est déjà sûr ;
- toute question dont la réponse ne changerait pas le verdict.

### Le correctif

Tout se passe dans `prompts/askHuman.prompts.js` — la description de l'outil est
du texte de prompt et n'a qu'un seul domicile. **Aucun changement de code**, la
mécanique de pause est en place et testée.

1. **Réécrire `ASK_HUMAN_DESCRIPTION`** autour du bon déclencheur : *tu as le
   fait, la règle ne le tranche pas, et la réponse décide d'un no-go.* Nommer les
   trois familles — validité dans le temps, seuil manqué de peu, preuve déclarée
   mais non jointe — parce qu'un modèle reconnaît un cas nommé bien mieux qu'un
   critère abstrait.

2. **Ajouter la liste de ce qui n'est pas une question pour l'humain**, en
   renvoyant explicitement vers l'outil qui répond à la place.

3. **Exiger que la question porte l'enjeu.** Une bonne question dit ce qui se
   passe dans chaque cas : « L'attestation fiscale expire le 12/06, avant la date
   limite du 08/07. Si je la considère expirée, le dossier passe en no-go. » Sans
   l'enjeu, le dirigeant répond à une question de forme sans savoir qu'il décide
   d'un abandon.

4. **Les options doivent être les décisions, pas des oui/non.** Pour le cas du
   seuil : `{ eliminatoire | risque_note | je_ne_sais_pas }`, pas `{ oui | non }`.
   `ASK_HUMAN_OPTIONS` demande déjà de couvrir le cas réel ; il doit dire que les
   options sont les issues possibles de l'arbitrage.

5. **Garder `MAX_HUMAN_ASKS = 3`.** Élargir le déclencheur sans garder la borne,
   c'est un dossier qui s'arrête quatre fois. La borne reste dans le code, jamais
   dans le prompt.

### Tests

La mécanique est déjà couverte (`tools.service.test.js`, `traced.test.js`). Ce
correctif est du texte, et le texte se vérifie autrement :

- un test d'assertion faible mais utile : `ASK_HUMAN_DESCRIPTION` nomme les trois
  familles et cite au moins deux outils vers lesquels rediriger. Il ne prouve pas
  que le modèle se comportera bien ; il empêche une réécriture de perdre la
  moitié de la consigne sans que personne le voie ;
- **la vraie vérification est manuelle** et doit être faite sur `AO-2026-002`, le
  no-go du corpus, dont le point bloquant est une certification ISO 22301 non
  détenue. C'est exactement le cas n° 3. Si l'agent ne demande rien sur ce
  dossier, la description n'est pas encore bonne.

---

## Ordre d'exécution

`compute_deadline` d'abord : c'est borné, testable, et ça retire un `échec` bien
visible du fil de raisonnement. `ask_human` ensuite, parce que la vérification
est une boucle manuelle contre le vrai modèle et qu'elle demandera sans doute
deux ou trois passes sur le texte.
