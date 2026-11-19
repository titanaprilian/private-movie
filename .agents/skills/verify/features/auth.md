# Authentication

Authentication verifies admin and user credential entry, JWT token issuance, session refresh, and route protection between public and protected admin routes.

## Sub-features

- `auth-login`: submit credentials on the admin login card and receive valid access/refresh tokens.
- `auth-redirect`: redirect authenticated users away from `/admin/login` to `/admin`.
- `auth-protect`: redirect unauthenticated requests to protected admin routes back to `/admin/login`.
- `auth-session`: refresh expired access tokens using the refresh token endpoint `/api/auth/refresh`.

## How to get to it (user POV)

- Navigate to `/admin/login` directly in the browser.
- Attempt to navigate to any protected route (e.g. `/admin`, `/admin/videos`, `/admin/storage`) while logged out.
- Send a `POST /api/auth/login` request to the backend.

## Driving it with control.sh

Preconditions:

- E2E database seeded with user `test@example.com` / `password123`.
- Backend running on `http://localhost:3000`.

- **Visit login page.** Navigate to `/admin/login`. Verify `[data-testid="admin-login-card"]` is visible.
- **Enter credentials.** Fill `#admin-email` with `test@example.com` and `#admin-password` with `password123`.
- **Submit login.** Click button `Enter Console`.
- **Verify redirect.** Assert URL path leaves `/login` and navigates to `/admin`.
- **API verification.** Send `POST http://localhost:3000/api/auth/login` with payload `{"email":"test@example.com","password":"password123"}`. Verify HTTP 200 and presence of `accessToken` and `refreshToken`.
- **Capture proof.** Capture screenshot of the logged-in admin dashboard into `artifacts/verify/auth/admin-dashboard.png`.

## Gotchas

- Password hashing uses bcrypt; always use the seeded password `password123`.
- Token cookies or localStorage must be preserved across page reloads during multi-step browser sessions.
- In headless tests, clear localStorage between tests to prevent leaked sessions.
