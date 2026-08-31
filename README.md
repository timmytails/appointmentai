# Timmy Tails

Timmy Tails is a full-stack pet-grooming appointment system with pet-fidelity AI style previews. A customer can upload a photo, choose a species-appropriate cut, see an image-to-image preview of that same pet, and attach the verified preview to an appointment.

## Highlights

- React/Vite customer and administrator interfaces
- Express and MongoDB API
- Email/phone login, SMS OTP, and Google sign-in
- Saved dog and cat profiles
- Four-step booking flow with fixed two-hour periods from 08:00 to 16:00
- Vertex AI upload verification, image-to-image generation, and post-generation identity check
- Personalized style cards generated from the customer's uploaded pet instead of stock style photos
- Top seasonal suggestion generated automatically; other styles generated only when selected
- Style-specific generation definitions that make every dog and cat option visibly different, including Comb Cut and the cat-only Teddy Bear Trim
- Upload-first style studio with grouped recommendations and a sticky selected preview on desktop
- Server-enforced dog/cat style compatibility
- Philippine seasonal ranking using the `Asia/Manila` timezone
- Seven-day browser cache keyed by source image, pet, style, season, and preview-pipeline version
- Trusted preview records linked to appointments instead of accepting arbitrary client images
- Admin booking preview with enlarge view and seasonal context

## Grooming rules

| Style | Dog | Cat | Important note |
|---|:---:|:---:|---|
| Puppy Cut | Yes | No | A short, even dog trim |
| Teddy Bear Cut | Yes | No | Rounded dog face and body styling |
| Summer Cut | Yes | No | Suggested only during Hot/Dry Season; remains selectable with a double-coat warning |
| Asian Fusion | Yes | No | Stylized dog trim |
| Lion Cut | No | Yes | Intended for suitable long-haired cats; groomer approval is required |
| Comb Cut | No | Yes | Moderate even clip for suitable medium- or long-haired cats |
| Teddy Bear Trim | No | Yes | Fuller rounded cat shape for a coat that can safely hold the style |
| Natural Trim | Yes | Yes | Conservative tidy-up for either species |

Recommendations are ordered by the current Philippine season:

- Hot/Dry: March–May
- Wet/Rainy: June–November
- Cool/Dry “Ber” Months: December–February

The backend is authoritative for both species compatibility and season. Frontend filtering is a usability aid, not the security boundary.

Seasonal suggestions change for both species, but customers can freely choose any species-compatible style. During Wet/Rainy months, dogs receive Natural Trim, Puppy Cut, and Teddy Bear Cut suggestions while Summer Cut remains an unsuggested choice. During Cool/Dry months, Natural Trim, Teddy Bear Cut, and Asian Fusion are suggested. Suitable medium- or long-haired cats receive Lion Cut, Comb Cut, and Natural Trim suggestions in Hot/Dry months; Comb Cut and Natural Trim during Wet/Rainy months; and Teddy Bear Trim plus Natural Trim during Cool/Dry months. Short-haired cats receive only the conservative Natural Trim recommendation. Other cat styles remain selectable with visible coat-suitability and groomer-approval guidance.

## Run locally

### Backend

```bash
cd backend-express
npm install
copy .env.example .env
npm run dev
```

Required backend values:

```env
MONGO_URI=mongodb://127.0.0.1:27017/timmytails
JWT_SECRET=replace_with_a_long_random_secret
FRONTEND_URL=http://localhost:5173

GOOGLE_CLOUD_PROJECT=your_google_cloud_project_id
GOOGLE_CLOUD_LOCATION=global
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

MAX_BOOKING_DAYS=90
BOOKING_LEAD_MINUTES=60
BOOKING_CLOSED_DAYS=0
```

For local Vertex AI authentication, run:

```bash
gcloud auth application-default login
```

Production can use `GOOGLE_APPLICATION_CREDENTIALS`, `GOOGLE_SERVICE_ACCOUNT_JSON`, `GOOGLE_SERVICE_ACCOUNT_JSON_BASE64`, or `GOOGLE_CLOUD_ACCESS_TOKEN`. Keep all Google credentials on the backend.

SMS and Google sign-in values are documented in `backend-express/.env.example`.

### Frontend

```bash
cd frontend
npm install
copy .env.example .env
npm run dev
```

```env
VITE_API_URL=http://localhost:5000/api
VITE_GOOGLE_CLIENT_ID=your_google_web_client_id
```

The browser tab title is `Timmy Tails | Pet Grooming`.

## AI preview lifecycle

1. The customer selects a pet and eligible service, accepts processing, and uploads one clear photo.
2. `POST /api/ai/photo-verification` verifies the species once and returns a signed one-hour token bound to the user, species, and photo hash.
3. Blank style cards are ordered by seasonal recommendation. Only the top seasonal suggestion generates automatically; every other species-compatible card has an on-demand Generate preview action. This prevents a four- or five-image queue from blocking the customer and reduces provider quota spikes. Style generation does not automatically repeat a provider failure; the customer retries explicitly after the provider's cooldown.
4. Each `POST /api/ai/style-preview` reuses the signed token, so source verification is not charged again for every style.
5. Vertex AI uses the uploaded photo as the only visual reference and applies the selected cut's explicit fur-length, face, body, leg, ear, and tail definition while preserving identity, markings, pose, framing, and background.
6. A vision check compares each result with the source and verifies both identity and the requested style definition. A failed check stops that card and lets the customer retry manually, preventing a hidden second image generation from doubling the wait.
7. Selecting a completed card displays that exact image in the large Generated style preview without another generation request.
8. Booking submission sends the selected trusted preview ID. The backend validates ownership, expiry, pet, species, breed, and style before linking it to the appointment.

If Vertex AI returns `429 Resource exhausted`, the backend returns `AI_QUOTA_EXHAUSTED` without automatically repeating the paid image request. The frontend preserves successful images, prevents overlapping retry clicks, and lets the customer retry one unfinished style later.

AI previews are visual guides. Coat condition, matting, health, temperament, and groomer judgment can change the achievable result.

## Validation

```bash
cd backend-express
npm test
```

```bash
cd frontend
npm run lint
npm run build
```

See `AI_PREVIEW_UPDATE_TESTING.md` for end-to-end cases and `AI_GROOMING_PREVIEW_ARCHITECTURE.md` for the API and data-flow design.

## Existing database compatibility

Keep the same `MONGO_URI` to reuse existing records. New AI-preview fields are additive. Appointments created by older clients can still use the legacy preview-image field, while new clients use trusted preview IDs. Existing `homeAddress` strings also remain available as a compatibility fallback.

## 2026 UI redesign and admin account-status persistence

The application shell and administration workspace use the TimmyTails six-color interface palette defined in `frontend/src/index.css`:

- `#1B1931` Dark Navy
- `#44174E` Deep Purple
- `#662249` Plum
- `#A34054` Muted Rose
- `#ED9E5B` Soft Orange
- `#E9BCB9` Pale Pink

The redesign audit and layout map are documented in `REDESIGN_AUDIT.md`.

Customer enforcement now has one source of truth: `User.accountStatus` in MongoDB. The admin status endpoint validates and persists the account status before returning it, the customer list reads the persisted value directly, and login/booking checks no longer infer enforcement from notification wording. Notifications remain customer communication only.

Persistence verification is covered by:

```bash
node --test backend-express/tests/accountStatusPersistence.test.js
node --test backend-express/tests/adminBanEndToEnd.test.js
node --test frontend/tests/customerStatusPersistence.test.js
```
