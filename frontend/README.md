# Timmy Tails Frontend

React/Vite interface for Timmy Tails.

```bash
npm install
copy .env.example .env
npm run dev
```

```env
VITE_API_URL=http://localhost:5000/api
VITE_GOOGLE_CLIENT_ID=your_google_web_client_id
```

The booking page has four customer-focused steps:

1. Select a service and dog/cat profile.
2. Use the upload-first style studio, let the top seasonal suggestion generate automatically, generate other compatible styles only when needed, and select a completed result.
3. Choose a fixed two-hour appointment period and add groomer notes.
4. Review and confirm.

The browser never calls Vertex AI directly. It verifies one upload through Express, generates only the top seasonal suggestion automatically, and creates other personalized cards on demand through one controlled request queue. The two groups have separate headings and concise season-specific reasons. Selecting a completed card shows the exact same image in a sticky desktop preview or an inline mobile preview without another model call. A quota response pauses the queue, preserves successful cards, and disables overlapping requests until the active request finishes. Results are cached for seven days and the selected trusted preview ID is submitted with the booking. Provider names, models, hashes, and verification internals are intentionally absent from the customer UI.

Validation:

```bash
npm run lint
npm run build
```
