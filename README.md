# TenderPilot

Tender analysis pipeline. See [CLAUDE.md](CLAUDE.md) for the coding rulebook.

## Run

```
cp .env.example .env   # fill it
# drop the fixture corpus into data/  (gitignored)
docker compose up
```

Migrations and the seed run on api startup. api on :3000, web on :3100.
