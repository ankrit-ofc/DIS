# Google OAuth Setup — DISTRO

How to wire Google Sign-In for distro-web (and optionally distro-app). You only need this once per environment.

## 1. Create Google Cloud project

1. Go to https://console.cloud.google.com/
2. Top bar → **Select a project** → **New Project**
3. Name: `DISTRO` → **Create**
4. Wait for the project to finish provisioning, then select it.

## 2. Configure the OAuth consent screen

1. Left menu → **APIs & Services** → **OAuth consent screen**
2. **User Type:** External → **Create**
3. Fill in:
   - App name: `DISTRO`
   - User support email: your email
   - Developer contact: your email
4. **Save and continue** through **Scopes** (add `email`, `profile`, `openid`).
5. Back on the consent screen overview, add any test user emails while the app is in **Testing** mode. Only these emails can sign in until you publish the app.

## 3. Create the OAuth client IDs

Left menu → **APIs & Services** → **Credentials** → **Create Credentials** → **OAuth client ID**.

### 3a. Web Client ID (required — used by distro-web)

- Application type: **Web application**
- Name: `DISTRO Web`
- Authorised JavaScript origins:
  - `http://localhost:3000`
  - `https://YOUR-PRODUCTION-DOMAIN` (when you deploy)
- Authorised redirect URIs:
  - `http://localhost:3000`
  - `https://YOUR-PRODUCTION-DOMAIN`
- **Create** → copy the **Client ID**.

### 3b. Android Client ID (optional — only if you ship native Google Sign-In on mobile)

> Note: `distro-app` is an Expo **managed** workflow. Native `@react-native-google-signin/google-signin` requires an EAS build or prebuild / ejection. Skip 3b and 3c unless you are already on EAS.

- Application type: **Android**
- Name: `DISTRO Android`
- Package name: the `android.package` from `distro-app/app.json` (e.g. `com.distro.app`)
- SHA-1 certificate fingerprint: run `eas credentials` after configuring EAS, or use `keytool -list -v -keystore <path>` for the debug keystore.

### 3c. iOS Client ID (optional)

- Application type: **iOS**
- Name: `DISTRO iOS`
- Bundle ID: the `ios.bundleIdentifier` from `distro-app/app.json`

## 4. Add the Client IDs to environment files

### distro-web — `distro-web/.env.local`

```
NEXT_PUBLIC_GOOGLE_CLIENT_ID=YOUR_WEB_CLIENT_ID.apps.googleusercontent.com
```

### distro-api — `distro-api/.env`

```
GOOGLE_CLIENT_ID=YOUR_WEB_CLIENT_ID.apps.googleusercontent.com
```

> The API does not need the secret. It verifies the ID token via Google's public `tokeninfo` endpoint and checks that the token's `aud` matches this client ID.

### distro-app — `distro-app/.env` (only if you enabled 3b / 3c)

```
EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID=YOUR_WEB_CLIENT_ID.apps.googleusercontent.com
EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID=YOUR_ANDROID_CLIENT_ID.apps.googleusercontent.com
EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID=YOUR_IOS_CLIENT_ID.apps.googleusercontent.com
```

Restart all three dev servers after editing env files.

## 5. Verify end-to-end

1. `cd distro-api && npm run dev`
2. `cd distro-web && npm run dev`
3. Open http://localhost:3000/login → click **Continue with Google**.
4. Sign in with one of the test-user Google accounts from step 2.
5. First-time users land on `/onboarding` to complete phone / store / district, then get ACTIVE access. Returning users go straight to the catalogue.

### Troubleshooting

- **"Error 400: redirect_uri_mismatch"** — the origin you are loading from is not in **Authorised JavaScript origins**. Add it and wait ~30 seconds for Google to propagate.
- **"Access blocked: this app is not verified"** — the signing-in Google account is not on the test-users list while the consent screen is in Testing mode. Add the email or publish the app.
- **API returns 401 on `/auth/google`** — the ID token's `aud` does not match `GOOGLE_CLIENT_ID` on the API. Usually means the web and API `.env` files are using different client IDs.

## Publishing (later)

When you move the consent screen from **Testing** → **In production** you will need:
- A privacy policy URL (we publish `/privacy`).
- A terms URL (`/terms`).
- The app homepage URL.
- Verified domain ownership in Google Search Console for the production domain.

Keep the staging Client IDs distinct from production IDs — never share `.env` between environments.
