# TenderPilot landing

Run from the repository root:

```sh
npm run dev:web
```

Open http://localhost:4100. French and the light theme are the defaults. The language
switch updates `?lang=fr` / `?lang=en` and remembers the choice in a cookie. Theme
preferences are saved by `next-themes`. Both preferences work independently.

The page keeps the template's sequence: navigation, hero, features, walkthrough,
dossier overview, decision checkpoints, documents, trust, interactive example,
call to action, footer. The original template remains untouched and untracked.

Copy lives in `lib/landing/fr.ts` and `en.ts`; page sections live in
`components/landing/`. Colors and fonts are defined in `app/globals.css`. The
supplied PNG logos are in `public/brand/`. CSS adapts their appearance for each theme
without changing the original images. Fonts use local system stacks, so no external
font request is needed.

The walkthrough and analysis are illustrative. They do not upload files, run an
analysis, collect leads, or call the API. The main buttons open the example analysis;
its sources are explicitly fictional. Connect a real product or sign-up flow when
that destination is available.

## Verification

```sh
npm run lint -w @tenderpilot/web
npm run build
npm run test:landing -w @tenderpilot/web
npx playwright install chromium
npm run test:e2e:landing -w @tenderpilot/web
```

The focused unit command uses the shared Vitest installation and bypasses the root
`vitest.config.js`, which is currently only a TODO. The landing's separate Playwright
configuration runs its UI checks without needing the database or an LLM. It starts
the web app if needed and covers desktop/mobile navigation, language and theme
persistence, the walkthrough, source inspection, and keyboard navigation.
