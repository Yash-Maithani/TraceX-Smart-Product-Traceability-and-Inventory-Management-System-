# Getting and Setting the API Keys (AI Audit and Google Sign-in)

TraceX runs fully without these keys. The AI dispatch audit and Google sign-in simply stay hidden until the keys are set, so you can add them at any time, including after the rest of the project is finished.

| Feature | Variable | Where it goes | Secret? |
|---|---|---|---|
| AI dispatch audit (main) | `GEMINI_API_KEY` | `backend/.env` | Yes |
| AI dispatch audit (backup) | `NVIDIA_API_KEY` | `backend/.env` | Yes |
| Google sign-in (server check) | `GOOGLE_CLIENT_ID` | `backend/.env` | No |
| Google sign-in (button) | `VITE_GOOGLE_CLIENT_ID` | `frontend/.env.local` | No |

You need at least one of the two AI keys for the AI audit. Gemini alone is enough; NVIDIA is only used if Gemini fails. Google sign-in needs both `GOOGLE_CLIENT_ID` and `VITE_GOOGLE_CLIENT_ID`, set to the same value.

## Rules for keeping the keys safe

1. Never commit a key. `backend/.env` and `frontend/.env.local` are already in `.gitignore`. Only `.env.example` files with empty values are pushed.
2. Never paste a real key into chat, a document, a screenshot or a commit message.
3. Never put a secret in a `VITE_` variable. Everything starting with `VITE_` is built into the public website code. The Google client ID is fine there because it is public by design; the AI keys are not.
4. The AI keys are only read by the backend, which calls Gemini or NVIDIA itself. The browser never sees them, and the backend never logs them.
5. If a key ever leaks, delete it on the provider's website and create a new one. It takes about a minute.

Before every commit you can check that no key slipped in:
```powershell
git status --short
git diff --cached | Select-String -Pattern "AIza|nvapi-"
```
The second command should print nothing. Gemini keys start with `AIza` and NVIDIA keys usually start with `nvapi-`.

## Step 1: Get a Gemini API key (free)

1. Open https://aistudio.google.com and sign in with your Google account.
2. Accept the terms if asked.
3. Click **Get API key**, then **Create API key**. Let it create a new Google Cloud project if it offers.
4. Copy the key (it starts with `AIza`).
5. Optional but recommended: open https://console.cloud.google.com/apis/credentials, choose the key, and under **API restrictions** select **Restrict key** and tick only **Generative Language API**.

The free tier has request limits per minute and per day, which is plenty for a demo. On the free tier Google may use what you send to improve its products; TraceX never sends farmer names, only batch codes, products, dates, quantities and villages.

## Step 2 (optional): Get an NVIDIA API key (free credits)

1. Open https://build.nvidia.com and sign in or create an NVIDIA account.
2. Open any model page (for example `meta/llama-3.1-70b-instruct`) and click **Get API Key**, then **Generate Key**.
3. Copy the key (it usually starts with `nvapi-`).

Free trial credits are limited; check your balance on the same site.

## Step 3 (optional): Get a Google OAuth client ID (free)

1. Open https://console.cloud.google.com and pick (or create) a project, for example the one AI Studio made.
2. Go to **APIs & Services > OAuth consent screen** (shown as **Google Auth Platform** in newer consoles).
   - User type: **External**.
   - App name: `TraceX`; add your email as the support and developer contact.
   - Leave the app in **Testing** and add every team member's Google address under **Test users**.
3. Go to **APIs & Services > Credentials > Create credentials > OAuth client ID**.
   - Application type: **Web application**.
   - **Authorized JavaScript origins**: add `http://localhost:5174`, and later your real site address (for example `https://tracex.<yourdomain>`).
   - No redirect URI is needed.
4. Copy the **Client ID** (it ends with `.apps.googleusercontent.com`). You do not need the client secret.

## Step 4: Put the keys on your laptop

1. In `backend/`, create a file named `.env` (no other name) with:
   ```text
   GEMINI_API_KEY=paste-your-gemini-key-here
   NVIDIA_API_KEY=paste-your-nvidia-key-here
   GOOGLE_CLIENT_ID=paste-your-client-id-here
   ```
   Leave out any line you do not have. The backend reads this file automatically when it starts from the `backend/` folder.
2. In `frontend/`, create a file named `.env.local` with:
   ```text
   VITE_GOOGLE_CLIENT_ID=paste-the-same-client-id-here
   ```
3. Restart both servers:
   ```powershell
   cd backend; .\mvnw.cmd spring-boot:run "-Dspring-boot.run.profiles=dev"
   cd frontend; npm run dev
   ```
4. Check it worked:
   - The **FEFO & Dispatch** page shows an **AI dispatch audit** card. Click **Run audit**.
   - The **Profile & Security** page shows **Google sign-in**. Link your Google account there, sign out, and use the Google button on the login page.
5. Run `git status --short` and confirm neither `.env` file appears in the list.

## Step 5: Put the keys on the live site (Phase 14)

Do not copy the `.env` files to the server. Instead:

- **Backend on Render**: open the service, go to **Environment**, and add `GEMINI_API_KEY`, `NVIDIA_API_KEY` and `GOOGLE_CLIENT_ID` as environment variables. Render keeps them out of the code and the logs.
- **Frontend build**: set `VITE_GOOGLE_CLIENT_ID` in the hosting provider's build settings before building.
- In the Google Cloud credentials page, add the live site address to **Authorized JavaScript origins**.

## What happens without keys

| Missing | What users see | What the API answers |
|---|---|---|
| Both AI keys | No AI card on the FEFO page | `POST /api/v1/ai/dispatch-audit`: `503 AI_UNAVAILABLE` |
| Google client ID | No Google button on login or Profile | `POST /api/v1/auth/google/token`: `503 GOOGLE_SIGN_IN_UNAVAILABLE` |
