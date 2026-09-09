#!/usr/bin/env bash
# One-time Cloudflare R2 setup for f1datastop blobs. Reads analysis/.env.r2:
#   R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, R2_BUCKET (default f1datastop),
#   BLOB_PUBLIC_BASE (public host, e.g. https://cdn.f1datastop.com — set after you enable
#   public access / a custom domain on the bucket in the Cloudflare dashboard)
# Steps: create bucket (S3 API) → CORS (downloads do a cross-origin fetch().blob()) →
#        GitHub Actions secrets → local web env.
set -euo pipefail
cd "$(dirname "$0")"
[ -f .env.r2 ] || { echo "missing analysis/.env.r2"; exit 1; }
set -a; . ./.env.r2; set +a
: "${R2_ACCOUNT_ID:?}" "${R2_ACCESS_KEY_ID:?}" "${R2_SECRET_ACCESS_KEY:?}"
R2_BUCKET="${R2_BUCKET:-f1datastop}"
EP="https://${R2_ACCOUNT_ID}.r2.cloudflarestorage.com"
export AWS_ACCESS_KEY_ID="$R2_ACCESS_KEY_ID" AWS_SECRET_ACCESS_KEY="$R2_SECRET_ACCESS_KEY" AWS_DEFAULT_REGION=auto

echo "== bucket $R2_BUCKET =="
aws s3api head-bucket --bucket "$R2_BUCKET" --endpoint-url "$EP" 2>/dev/null \
  && echo "exists" \
  || aws s3api create-bucket --bucket "$R2_BUCKET" --endpoint-url "$EP" && echo "created"

echo "== CORS (GET/HEAD from the site + local dev) =="
cat > /tmp/r2-cors.json <<'JSON'
{"CORSRules":[{"AllowedOrigins":["https://f1datastop.com","https://www.f1datastop.com","http://localhost:8080","http://localhost:5173"],
  "AllowedMethods":["GET","HEAD"],"AllowedHeaders":["*"],"ExposeHeaders":["Content-Length","Content-Type","Content-Encoding","ETag"],"MaxAgeSeconds":86400}]}
JSON
aws s3api put-bucket-cors --bucket "$R2_BUCKET" --endpoint-url "$EP" --cors-configuration file:///tmp/r2-cors.json && echo "cors set"

if [ -n "${BLOB_PUBLIC_BASE:-}" ]; then
  echo "== GitHub Actions secrets (repo ibrahimroshdy/f1datastop) =="
  for k in R2_ACCOUNT_ID R2_ACCESS_KEY_ID R2_SECRET_ACCESS_KEY R2_BUCKET BLOB_PUBLIC_BASE; do
    gh secret set "$k" --repo ibrahimroshdy/f1datastop --body "${!k}" && echo "  set $k"
  done
  echo "== web/.env VITE_BLOB_HOST =="
  if grep -q '^VITE_BLOB_HOST=' ../web/.env; then
    sed -i '' "s#^VITE_BLOB_HOST=.*#VITE_BLOB_HOST=${BLOB_PUBLIC_BASE}#" ../web/.env
  else
    printf '\n# Cloudflare R2 public host for charts/telemetry/replays/circuits (web/src/lib/blobUrl.ts)\nVITE_BLOB_HOST=%s\n' "$BLOB_PUBLIC_BASE" >> ../web/.env
  fi
  echo "  web/.env updated — ALSO add VITE_BLOB_HOST=${BLOB_PUBLIC_BASE} in Vercel → Settings → Environment Variables (Production) and redeploy."
else
  echo "BLOB_PUBLIC_BASE not set yet — enable public access / custom domain on bucket '$R2_BUCKET' in the Cloudflare dashboard, put the host in .env.r2, and re-run to push secrets + env."
fi
echo "done."
