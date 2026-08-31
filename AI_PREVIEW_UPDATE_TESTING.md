# Timmy Tails AI Preview Test Guide

## Test environment

Configure the backend with Vertex AI credentials and these values:

```env
GOOGLE_CLOUD_PROJECT=your_project_id
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
```

For local development:

```bash
gcloud auth application-default login
```

Restart the backend after changing `.env`.

## Automated checks

```bash
cd backend-express
npm test
```

Expected: all season and grooming-rule tests pass.

```bash
cd frontend
npm test
npm run lint
npm run build
```

Expected: lint completes without errors and Vite creates a production build.

## 1. Pet-fidelity generation

1. Choose Full Grooming or Custom Styling.
2. Select a saved dog or cat with a breed.
3. Confirm that every style card starts with a blank upload placeholder.
4. Upload a clear front or three-quarter JPG, PNG, or WEBP photo no larger than 7 MB and accept photo processing.
5. Wait while the top seasonal suggestion generates, then select Generate preview on another recommended or compatible card.

Expected:

- The source is verified once, then completed personalized cards appear progressively.
- Only the top seasonal suggestion starts automatically.
- Other suggested and compatible cards remain ready for on-demand generation and make no request until selected.
- Recommended cards display generated images of the uploaded pet, never generic style examples.
- The result shows the same pet: matching species, face, coat colors/markings, body proportions, pose, framing, and background.
- The selected cut is visibly applied.
- Selecting a completed card displays that exact card image in Generated style preview without another network generation request.
- The customer sees no provider, model, hash, or cache terminology.

Repeat with distinctive pets such as a multicolored coat, facial patch, or unusual ear shape. Identity-specific details should remain recognizable.

## 2. Style differentiation

Using the same clear long-haired dog photo, generate Natural Trim, Puppy Cut, Teddy Bear Cut, Summer Cut, and Asian Fusion previews. For a suitable medium- or long-haired cat, compare Natural Trim, Comb Cut, Teddy Bear Trim, and Lion Cut.

Expected:

- Natural Trim preserves most original coat length and only cleans the outline, face, and paws.
- Puppy Cut has a visibly uniform medium-short body and leg length with a softly rounded head.
- Teddy Bear Cut has a fuller circular face and plush body rather than looking like Puppy Cut.
- Summer Cut is visibly shorter without shaving to skin or removing protective double-coat structure.
- Asian Fusion shows a compact body with clearly fuller sculpted legs.
- Lion Cut shows a mane, shorter body, fuller lower paws, and tail-tip tuft.
- Comb Cut shows an even medium-short plush body and legs, with a natural head and full tail; it is fuller than Lion Cut but more trimmed than Natural Trim.
- Teddy Bear Trim shows a fuller rounded face, softly shaped body, blended legs, and rounded paws without a close body clip.
- A result that preserves identity but misses the requested style definition fails verification and retries once.

## 3. Wrong animal or unclear photo

Try each case:

- Dog profile with a cat photo
- Cat profile with a dog photo
- Photo with no animal
- Photo with several animals and no clear main subject
- Heavily blurred or obstructed pet

Expected: generation is rejected before the image model is called and the user is asked for a clear photo of the selected species.

Regression check: select a cat profile and upload a clear dog photo. The server must return `422 PET_PHOTO_MISMATCH`, the gallery must remain empty, and no style-generation request may start. Repeat with a dog profile and a clear cat photo. Source classification is intentionally profile-blind; the selected species is compared only after the vision model identifies the visible animal.

New Pet regression check: keep a saved dog selected, switch to New Pet, enter a cat and upload a cat photo. The verification request must send `petId: null` and `petType: cat`; it must never resolve the hidden saved dog. Repeat with a saved cat followed by a new dog.

## 4. Post-generation fidelity rejection

This is normally exercised by the live vision check. To inspect behavior, monitor the network request and backend log while using difficult source images.

Expected:

- A failed comparison returns HTTP `422` with code `AI_PREVIEW_FIDELITY_FAILED` without silently generating a second paid image.
- The customer can explicitly retry only that failed card.
- No failed image is saved as a trusted preview or shown as successful.

Temporarily setting `AI_FIDELITY_CHECK_ENABLED=false` is acceptable only for isolated troubleshooting, not normal deployment.

## 5. Species filtering and server enforcement

| Selected species | Styles that should appear |
|---|---|
| Dog during Hot/Dry | Puppy Cut, Teddy Bear Cut, Summer Cut, Asian Fusion, Natural Trim |
| Dog during Wet/Rainy or Cool/Dry | Puppy Cut, Teddy Bear Cut, Summer Cut, Asian Fusion, Natural Trim; Summer Cut is available but not suggested |
| Cat | Lion Cut, Comb Cut, Teddy Bear Trim, Natural Trim |

Expected:

- Switching species clears any previously selected incompatible style and preview.
- Cat imagery is never used for a dog-only card and vice versa.
- Blank placeholders remain until previews of the uploaded pet are ready; no stock style photo is shown.
- Calling generation or booking manually with an incompatible style returns a validation error.
- Summer Cut remains selectable outside March–May but does not receive a Suggested badge.
- Double-coated dog data displays the Summer Cut safety note.
- Lion Cut, Comb Cut, and Teddy Bear Trim display coat-suitability/groomer-approval guidance.

## 6. Philippine seasons

The backend test suite verifies boundaries, but manual API/UI checks can be done with a controlled server date or isolated season helper.

| Manila date | Expected season |
|---|---|
| March 1 through May 31 | Hot/Dry |
| June 1 through November 30 | Wet/Rainy |
| December 1 through February 28/29 | Cool/Dry “Ber” Months |

Expected:

- Only species-compatible styles are ranked.
- Up to three styles are labeled as suggestions.
- Recommendation reasons refer to practical seasonal grooming needs.
- The backend season is authoritative even if a request sends a different season value.
- Wet/Rainy dog suggestions are Natural Trim, Puppy Cut, and Teddy Bear Cut; Summer Cut remains an unsuggested selectable style.
- Cool/Dry dog suggestions are Natural Trim, Teddy Bear Cut, and Asian Fusion.
- Hot/Dry longer-haired cat suggestions are Lion Cut, Comb Cut, and Natural Trim.
- Wet/Rainy longer-haired cat suggestions are Comb Cut and Natural Trim.
- Cool/Dry longer-haired cat suggestions are Teddy Bear Trim and Natural Trim.
- Short-haired cat suggestions contain only Natural Trim in every season.

## 7. Browser preview cache

1. Upload a pet photo and allow the personalized gallery to finish.
2. Select several completed style cards.
3. Return to the first style.

Expected: switching cards never generates again. Reloading the same pet/photo/season combination loads valid results from IndexedDB without another Vertex generation call.

The key includes preview version, photo SHA-256, species, breed, style, and season. Entries expire after seven days. Changing any key input must not reuse the old result. Version `2026-08-pet-fidelity-v5-fast-species-guard` and cache namespace `v7-fast-species-guard-cache` must not reuse previews created under an earlier species-check policy.

## 8. Trusted preview booking

1. Generate a successful preview.
2. Choose a date and fixed time period.
3. Confirm the booking.

Expected:

- The request submits `aiPreviewId`.
- The backend revalidates preview ownership, expiry, pet, species, breed, and style.
- An altered, expired, incompatible, or another user's ID is rejected.
- A preview created under an older source-species policy is rejected and must be regenerated.
- The legacy client-supplied `aiPreviewImage` field is rejected because its species and source verification cannot be trusted.
- The appointment stores the validated preview reference and server metadata.
- The preview image is omitted from ordinary appointment list payloads.

Also verify booking a non-AI service; it should not require a style or preview.

## 9. One-time source verification and generation order

Use the browser network panel for a fresh uncached dog photo.

Expected:

- Exactly one `/api/ai/photo-verification` request succeeds before generation.
- Every `/api/ai/style-preview` request carries the returned verification token.
- Exactly one top-suggestion style request starts automatically.
- Other cards make no request until the customer selects Generate preview.
- An on-demand request starts only after the current request finishes, so exactly one style-generation request is active at a time.
- Selecting a completed card causes no `/style-preview` request.
- Retrying a failed card keeps successful cards intact.
- Retry controls are disabled while any style request is active, so repeated clicks cannot create overlapping runs.

To test quota behavior, use an isolated test project or mock a Vertex `429`; do not intentionally exhaust production quota. Expected: the backend returns HTTP `429` with code `AI_QUOTA_EXHAUSTED` without an automatic repeat, preserves successful cards, and waits for an explicit retry after capacity recovers.

## 10. Admin grooming reference

1. Sign in as an administrator.
2. Open Bookings and select the AI-assisted appointment.

Expected:

- The hairstyle and Philippine season are visible.
- The Grooming Reference image can be enlarged.
- Internal fidelity details remain hidden.
- Older appointments without a saved image remain readable and do not need migration.

## 11. Responsive and accessible interaction

Test at phone, tablet, and desktop widths using keyboard-only navigation.

Expected:

- The four-step hierarchy stays understandable.
- Upload and consent appear before the recommended and additional style groups.
- The selected preview remains sticky beside the gallery on wide screens and appears inline after its selected card on smaller screens.
- Style cards expose selected state and visible focus.
- Photo input, consent, generation, date, time, and confirmation are keyboard reachable.
- Before/after images have meaningful alternative text.
- Long breed names, recommendation reasons, and safety notes wrap without overlapping controls.
