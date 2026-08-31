# Timmy Tails Implementation Notes

## Approved feature update

### Pet-fidelity AI preview

- The selected pet photo is sent as inline image data to Vertex AI and is the generation request's only visual reference.
- The editing prompt preserves the pet's species, facial identity, coat color and markings, body shape, pose, framing, lighting, and background while applying an explicit per-style grooming definition.
- One fast vision-model check verifies the uploaded species before generation.
- The species classifier is deliberately profile-blind. It identifies the main visible animal without receiving the selected pet type; server code then requires an exact high-confidence match with the active pet context.
- Saved Pet and New Pet modes have isolated request contexts. A saved pet ID is never included when the customer is entering a new pet, so a previously selected saved dog cannot override a new cat form (or vice versa).
- The updated gallery verifies the source once and signs a one-hour token bound to the authenticated user, source hash, and species. Every style-generation request reuses that token.
- A second vision-model check compares the source and output for identity preservation, the selected style's defining visual features, species, and safe composition. A generic tidy-up cannot pass as a clearly different cut.
- A failed fidelity check returns a user-friendly `422` response for that card. Regeneration is customer-initiated, preventing a hidden second generation from doubling request time.
- Successful generations create a short-lived `AiPreview` record. Booking uses the trusted preview ID and revalidates ownership, expiry, pet, breed, species, and style.
- The appointment retains a copy of the selected preview so staff can still view it after the temporary preview record expires.

### Species filtering

- `Puppy Cut`, `Teddy Bear Cut`, `Summer Cut`, and `Asian Fusion` are dog-only.
- `Lion Cut`, `Comb Cut`, and `Teddy Bear Trim` are cat-only and carry coat-suitability/groomer-approval guidance.
- `Natural Trim` is available for dogs and cats.
- `Summer Cut` remains selectable for dogs year-round but is suggested only during the Hot/Dry Season from March through May.
- The API filters style lists and rejects incompatible recommendation, generation, and booking requests even if a client bypasses the UI.

### Philippine seasonal recommendations

The server determines the season in `Asia/Manila`:

| Key | Months | Recommendation focus |
|---|---|---|
| `hot-dry` | March–May | Airflow, manageable length, and conservative coat safety |
| `wet-rainy` | June–November | Easy drying, tidy paws/underside, and mat prevention |
| `cool-dry` | December–February | Comfortable length and polished holiday-season styles |

Styles are scored per season, but availability is controlled by species rather than season. Dog suggestions are Summer Cut/Natural Trim/Puppy Cut for Hot/Dry, Natural Trim/Puppy Cut/Teddy Bear Cut for Wet/Rainy, and Natural Trim/Teddy Bear Cut/Asian Fusion for Cool/Dry. Suitable medium- or long-haired cats receive Lion Cut/Comb Cut/Natural Trim for Hot/Dry, Comb Cut/Natural Trim for Wet/Rainy, and Teddy Bear Trim/Natural Trim for Cool/Dry. Short-haired cats receive only Natural Trim as a seasonal recommendation. Unsuggested compatible styles remain selectable with coat guidance. Double-coated dogs and short-haired cats receive stricter recommendation filtering.

### Booking UX

- The workflow is presented as Service and Pet, Style and Preview, Schedule, and Review.
- Style and Preview begins with a compact Philippine-season banner and upload area before any style selection.
- Style cards prioritize imagery, a selected state, seasonal recommendation labels, and relevant coat notes.
- Style cards start with blank upload placeholders instead of stock animal images.
- Recommended and additional styles appear in separate groups. After upload and consent, only the top seasonal suggestion generates automatically. Every other compatible card is generated on demand when the customer selects Generate preview.
- Selecting a completed card copies that exact trusted image into the large Generated style preview without making another model call.
- The selected preview is sticky beside the gallery on wide screens and appears inline after the selected card on smaller screens.
- Provider names, cache internals, hashes, model metadata, and other implementation details are hidden from customers.
- The schedule continues to use four fixed periods: 08:00–10:00, 10:00–12:00, 12:00–14:00, and 14:00–16:00.

## Backend configuration

Use `backend-express/.env.example` as the source of truth. The AI-specific settings are:

```env
GOOGLE_CLOUD_PROJECT=your_google_cloud_project_id
GOOGLE_CLOUD_LOCATION=global
GOOGLE_APPLICATION_CREDENTIALS=
GOOGLE_SERVICE_ACCOUNT_JSON=
GOOGLE_SERVICE_ACCOUNT_JSON_BASE64=
GOOGLE_CLOUD_ACCESS_TOKEN=

GEMINI_SOURCE_VERIFICATION_MODEL=gemini-2.5-flash-lite
GEMINI_SOURCE_VERIFICATION_FALLBACK_MODEL=gemini-2.5-flash
GEMINI_FIDELITY_MODEL=gemini-2.5-flash
GEMINI_IMAGE_MODEL=gemini-3.1-flash-image
GEMINI_IMAGE_SIZE=1K
GEMINI_IMAGE_ASPECT_RATIO=1:1
AI_IMAGE_TIMEOUT_MS=240000
AI_PHOTO_VERIFICATION_TIMEOUT_MS=30000
AI_SOURCE_VERIFICATION_MODEL_TIMEOUT_MS=12000
AI_PROVIDER_MAX_RETRIES=1
AI_PROVIDER_RETRY_DELAY_MS=4000
AI_PREVIEW_VERSION=2026-08-pet-fidelity-v5-fast-species-guard
AI_PREVIEW_RETENTION_DAYS=7
AI_FIDELITY_CHECK_ENABLED=true
AI_FIDELITY_MAX_GENERATION_ATTEMPTS=1
```

For local development, Application Default Credentials are the simplest option:

```bash
gcloud auth application-default login
```

Restart the Express server after changing environment values. Never place a Google access token or service-account JSON in the Vite environment.

## Compatibility and privacy

- Existing MongoDB collections are reused; all schema changes are additive.
- Legacy client-supplied generated-image fields are rejected; booking requires a trusted `aiPreviewId` created under the current source-species policy.
- Source and generated images are excluded from normal query results with Mongoose `select: false`.
- Temporary preview records expire automatically based on `AI_PREVIEW_RETENTION_DAYS`, while booked appointments keep the selected grooming reference.
- The browser cache expires after seven days and its key changes with the preview version, pet details, style, season, or source photo. Cache namespace `v7-fast-species-guard-cache` invalidates previews accepted under earlier source-verification policies.
- The automatic gallery generates only the top recommendation. Image generation and fidelity checks do not automatically repeat provider failures; `429` stops immediately, preserves successful previews, and waits for an explicit customer retry after capacity recovers.
- A preview is guidance for the groomer, not a guaranteed outcome.

## Validation commands

```bash
cd backend-express
npm test
```

```bash
cd frontend
npm test
npm run lint
npm run build
```

The backend test suite covers Philippine season boundaries, legacy season normalization, the species matrix, neutral high-confidence species verification, the 30-second overall timeout and stable fallback policy, and season-aware/safety-aware ordering. Frontend regression tests ensure New Pet mode cannot leak the selected saved pet ID and a global retry can start only one failed style.
