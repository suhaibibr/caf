# xBloom Local Backend + Recipe-to-Share CLI

This project runs fully local and does not depend on Supabase.

It includes:
- A simple Node.js backend (`npm start`)
- A one-shot CLI to parse natural-language recipes and return xBloom share links
- A browser UI at `http://localhost:8787/` for login + create + share

## What it does

1. Login with xBloom account
2. List/create/edit/delete recipes
3. Import from share URL
4. Create recipe from Arabic/English free text and return share URL
5. Persist encrypted session locally in `session.json`

## Run locally

```bash
cd xbloom-mcp-remote
cp .env.example .env
npm install
npm start
```

Server runs on `http://localhost:8787`.

Web UI:
- Open `http://localhost:8787/`
- Login with xBloom email/password
- أدخل الصبات يدويًا (3 صفوف افتراضيًا)
- كل صف يحتوي:
  - حجم الصبة `ml`
  - وقت الانتظار `sec`
- يمكنك حذف أي صف وإضافة صفوف جديدة
- Click `Create Recipe + Get Share Link`

## CLI usage

```bash
node create-recipe.js --name "Ethiopia V60" --dose 18 "40 مل وننتظر 30 ثانية، ثم 130 مل خلال 35 ثانية وننتظر 15 ثانية، ثم 210 مل خلال 30 ثانية وننتظر 15 ثانية، ثم 270 مل خلال 15 ثانية وينتهي الاستخلاص عند 2:20"
```

You can also pass recipe text via stdin:

```bash
echo "40 ml wait 30 sec, 130 ml over 35 sec wait 15 sec, 210 ml over 30 sec wait 15 sec, 270 ml over 15 sec end at 2:20" | node create-recipe.js --name "Test"
```

### CLI options

- `--name "Recipe Name"`
- `--dose 18`
- `--temp 92`
- `--grind 85`
- `--rpm 80`
- `--ratio 15` (optional override; otherwise calculated from total water / dose)
- `--flow 3.0`

## Example CLI success output

```json
{
  "success": true,
  "recipeName": "Ethiopia V60",
  "parsedRecipe": {
    "totalWaterMl": 270,
    "pours": [
      { "targetMl": 40, "durationSec": 0, "waitSec": 30 },
      { "targetMl": 130, "durationSec": 35, "waitSec": 15 },
      { "targetMl": 210, "durationSec": 30, "waitSec": 15 },
      { "targetMl": 270, "durationSec": 15, "waitSec": 0 }
    ],
    "drawdownTargetSec": 140
  },
  "warnings": [],
  "recipeId": 123456,
  "shareUrl": "https://share-h5.xbloom.com/?id=..."
}
```

## Session storage

- Local file: `session.json`
- Stores:
  - `access_token` (session token)
  - `encrypted_credentials` (AES encrypted xBloom member/token/email)
- No cloud database

## API endpoints

- `POST /login`
- `GET /recipes`
- `POST /recipes`
- `PATCH /recipes/:id`
- `DELETE /recipes/:id`
- `POST /recipes/import`
- `POST /recipes/:id/share`
- `POST /recipes/from-text`

All routes return JSON only.

## cURL examples

### Login

```bash
curl -X POST http://localhost:8787/login \
  -H "Content-Type: application/json" \
  -d '{"email":"you@example.com","password":"your-password"}'
```

### List

```bash
curl http://localhost:8787/recipes -H "X-Session-Token: <sessionToken>"
```

### Create

```bash
curl -X POST http://localhost:8787/recipes \
  -H "X-Session-Token: <sessionToken>" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Demo Recipe",
    "doseG": 18,
    "ratio": 15,
    "grindSize": 80,
    "grindRpm": 80,
    "pours": [
      { "name": "Bloom", "volumeMl": 40, "temperatureC": 92, "pauseSeconds": 30 },
      { "name": "Pour 2", "volumeMl": 90, "temperatureC": 92, "pauseSeconds": 15 },
      { "name": "Pour 3", "volumeMl": 80, "temperatureC": 92, "pauseSeconds": 15 },
      { "name": "Pour 4", "volumeMl": 60, "temperatureC": 92, "pauseSeconds": 0 }
    ]
  }'
```

### Share link

```bash
curl -X POST http://localhost:8787/recipes/12345/share -H "X-Session-Token: <sessionToken>"
```

### Create from free text (single-shot)

```bash
curl -X POST http://localhost:8787/recipes/from-text \
  -H "X-Session-Token: <sessionToken>" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Ethiopia V60",
    "dose": 18,
    "temp": 92,
    "grind": 70,
    "recipeText": "40 مل وننتظر 30 ثانية، ثم 130 مل خلال 35 ثانية وننتظر 15 ثانية، ثم 210 مل خلال 30 ثانية وننتظر 15 ثانية، ثم 270 مل خلال 15 ثانية"
  }'
```
