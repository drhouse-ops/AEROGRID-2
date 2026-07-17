# AEROGRID — Deploy to Google Cloud Run

The live demo is hosted on Cloud Run. This guide covers deploying from a machine
with `gcloud` + Docker (or via Google Cloud Build from source).

## Prerequisites
- A Google Cloud project (e.g. `helix-orbit-aerogrid`)
- `gcloud` CLI authenticated (`gcloud auth login`, `gcloud config set project <PROJECT>`)
- Region: `asia-southeast1` (matches existing live URL)

## One-shot deploy (build + push + deploy)
```bash
gcloud run deploy aerogrid \
  --source . \
  --region asia-southeast1 \
  --platform managed \
  --allow-unauthenticated \
  --port 3000 \
  --set-env-vars "DEMO_MODE=true" \
  --set-env-vars "GEMINI_API_KEY=$GEMINI_API_KEY" \
  --set-env-vars "FIRMS_MAP_KEY=$FIRMS_MAP_KEY" \
  --set-env-vars "GOOGLE_WEATHER_API_KEY=$GOOGLE_WEATHER_API_KEY" \
  --set-env-vars "DATA_GOV_IN_API_KEY=$DATA_GOV_IN_API_KEY"
```

Optional (enable when credentials are available):
```bash
  --set-env-vars "FIREBASE_SERVICE_ACCOUNT=$(cat firebase-service-account.json)" \
  --set-env-vars "GOOGLE_CLOUD_STT_KEY=$(cat stt-service-account.json)"
```

## Deploy via Cloud Build (cloudbuild.yaml)
```bash
gcloud builds submit --config cloudbuild.yaml --region asia-southeast1
gcloud run deploy aerogrid \
  --image asia-southeast1-docker.pkg.dev/$PROJECT_ID/aerogrid/aerogrid:$SHORT_SHA \
  --region asia-southeast1 --platform managed --allow-unauthenticated --port 3000
```

## Smoke test after deploy
```bash
URL=$(gcloud run services describe aerogrid --region asia-southeast1 --format 'value(status.url)')
curl $URL/api/v1/health          # => {"status":"HEALTHY",...}
```

## Notes
- `DEMO_MODE=true` keeps the seeded supporting report + simulated forecast for the demo.
  For a live pilot, set `DEMO_MODE=false` (services then return `available:false` when keys are missing).
- All external providers degrade gracefully: missing keys ⇒ `available:false`, never fabricated data.
- Firestore + Cloud STT are OPT-IN; the app runs fully without them (in-memory + Web Speech API).
