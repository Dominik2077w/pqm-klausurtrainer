# PQM Klausurtrainer

Static flashcard trainer for the PQM exam notes.

The app is designed for GitHub Pages and has no backend. Card data is exported from the local SQLite review database into `data/cards.json`.

## Local Preview

Open `index.html` directly, or serve the folder with any static file server.

## Update Cards

Run:

```powershell
python scripts/export_cards.py
```

The script reads:

`C:\Users\Dominik\Documents\GitHub\HSK_WI_KURS_ARS\26SS\QM\review\qm_exam_review.sqlite`

and rewrites:

`data/cards.json`
