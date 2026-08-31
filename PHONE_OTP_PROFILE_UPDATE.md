# Phone, OTP, Profile, and Frontend Naming Update

- Philippine mobile numbers now accept either `+639XXXXXXXXX` or `09XXXXXXXXX` and are stored as `+639XXXXXXXXX`.
- Google Complete Profile now sends an SMS OTP and requires the six-digit code before saving.
- A customer Profile page was added at `/profile`.
- First and last names are read-only on the Profile page and cannot be changed through the profile update API.
- Changing the saved mobile number requires OTP verification.
- Address fields are Street/House Number, Barangay, City, and Province; all are required.
- The frontend folder was renamed from `appml` to `frontend`.
- The browser title is now `Timmy Tails | Pet Grooming`, with a Timmy Tails paw favicon.

Run locally:

```powershell
cd backend-express
copy .env.example .env
npm install
npm run dev
```

```powershell
cd frontend
copy .env.example .env
npm install
npm run dev
```
