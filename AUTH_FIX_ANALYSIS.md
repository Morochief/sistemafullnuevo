# 401 Unauthorized Error - Root Cause Analysis & Fix

## Problem Summary
When registering "insumos" (or any POST to `/api/registros`), the server returns **401 Unauthorized**, which triggers `handleLogout()` and redirects users to the dashboard/login screen.

## Root Cause Analysis

### What We Found:

1. **Authentication Flow is Correct**:
   - JWT tokens are generated with 24h expiration (`JWT_EXPIRES_IN = '24h'`)
   - Tokens are stored in `sessionStorage` under key `afull_session`
   - `authFetch` correctly adds `Authorization: Bearer <token>` header
   - `requireAuth` middleware validates the token

2. **Potential Issues**:
   - **Missing Logging**: No visibility into why authentication is failing
   - **Silent Failures**: Errors are not logged in detail
   - **Token Expiration**: 24h tokens might be expired if user session is old
   - **Session Storage**: May be cleared or corrupted
   - **CORS/Headers**: Token might not be sent correctly in some scenarios

### Most Likely Causes:

1. **Token Expiration**: User's token expired (24h lifetime)
2. **Session Cleared**: Browser cleared sessionStorage
3. **Token Corruption**: Token format issue or encoding problem
4. **Middleware Rejection**: Token validation failing for unknown reason

---

## Fixes Applied

### 1. Enhanced Logging in `requireAuth` Middleware (`server-auth.ts`)

**What Changed**:
- Added detailed console.error logs for missing Authorization header
- Log when Bearer format is incorrect
- Log token length when received
- Log successful token verification with user details
- Log exact error when token verification fails

**Why**: This will show exactly where and why authentication is failing on the server side.

```typescript
// Now logs:
// [AUTH] Missing Authorization header on POST /api/registros
// [AUTH] Invalid Authorization format on POST /api/registros - got: Basic xxxxx
// [AUTH] Token received for POST /api/registros - length: 180
// [AUTH] Token verified successfully - user: Kevin Delgado rol: Operario
// [AUTH] Token verification failed on POST /api/registros - error: jwt expired
```

### 2. Enhanced Logging in `authFetch` (`src/authFetch.ts`)

**What Changed**:
- Log when no session or token is found
- Log every authenticated request with URL and token length
- Log response status and statusText for every request
- Added detailed error logging in `authFetchJSON`

**Why**: This shows client-side token availability and request/response details.

```typescript
// Now logs:
// [authFetch] No session or token found for /api/registros
// [authFetch] Making authenticated request to /api/registros - token length: 180
// [authFetch] Response received: 401 Unauthorized for /api/registros
// [authFetchJSON] Request failed: 401 Unauthorized for /api/registros
// [authFetchJSON] Error details: { code: 'INVALID_TOKEN', message: '...' }
```

### 3. Enhanced Error Handling in `handleAddManualRegistro` (`src/App.tsx`)

**What Changed**:
- Log current session state when attempting to add registro
- Catch and identify authentication errors specifically
- Auto-logout on 401 errors with clear message
- Better user feedback

**Why**: Provides session visibility and proper error handling for auth failures.

```typescript
// Now logs:
// [APP] handleAddManualRegistro called with: {...}
// [APP] Current session: { nombre: 'Kevin Delgado', hasToken: true }
// [APP] AUTH ERROR DETECTED - triggering logout
```

---

## How to Test

### Step 1: Open Browser Console
Open Developer Tools → Console tab

### Step 2: Reproduce the Issue
1. Login as any user (admin/kevin/rodrigo)
2. Navigate to "Registro" tab
3. Try to add an "insumo" or manual registro
4. Watch the console for detailed logs

### Expected Console Output (Normal Flow):
```
[APP] handleAddManualRegistro called with: {...}
[APP] Current session: { nombre: 'Kevin Delgado', hasToken: true }
[authFetch] Making authenticated request to /api/registros - token length: 180
[authFetch] Response received: 201 Created for /api/registros
[APP] Server response: { success: true, data: {...} }
[APP] Database state updated successfully
```

### Expected Console Output (Auth Error):
```
[APP] handleAddManualRegistro called with: {...}
[APP] Current session: { nombre: 'Kevin Delgado', hasToken: true }
[authFetch] Making authenticated request to /api/registros - token length: 180
[authFetch] Response received: 401 Unauthorized for /api/registros
[authFetchJSON] Request failed: 401 Unauthorized for /api/registros
[authFetchJSON] Error details: { code: 'INVALID_TOKEN', message: 'jwt expired' }
[APP] Error creating registro: jwt expired
[APP] AUTH ERROR DETECTED - triggering logout
```

### Server-Side Logs:
Check terminal/server console for:
```
[AUTH] Token received for POST /api/registros - length: 180
[AUTH] Token verification failed on POST /api/registros - error: jwt expired
```

OR if token is missing:
```
[AUTH] Missing Authorization header on POST /api/registros
```

---

## Possible Fixes Based on Root Cause

### If Issue: **Token Expiration**
**Symptom**: Logs show `jwt expired` error  
**Fix**: Extend token lifetime or implement token refresh

```typescript
// In server-auth.ts, change:
const JWT_EXPIRES_IN = '24h';
// To:
const JWT_EXPIRES_IN = '7d'; // 7 days
```

### If Issue: **Token Not Being Sent**
**Symptom**: Server logs show `Missing Authorization header`  
**Fix**: Check if session is being cleared or not persisted

```typescript
// Verify sessionStorage is working:
console.log('Session storage:', sessionStorage.getItem('afull_session'));
```

### If Issue: **Token Format Problem**
**Symptom**: Server logs show `Invalid Authorization format`  
**Fix**: Check token encoding/decoding

```typescript
// In authFetch.ts, verify token format:
console.log('Token preview:', session.token.substring(0, 30) + '...');
```

### If Issue: **JWT Secret Mismatch**
**Symptom**: Server logs show `invalid signature`  
**Fix**: Ensure JWT_SECRET is consistent

```bash
# Check .env file for JWT_SECRET
# Should match between token generation and verification
```

### If Issue: **Middleware Not Receiving Token**
**Symptom**: Token sent but server doesn't receive it  
**Fix**: Check headers are being forwarded correctly

```typescript
// In authFetch, verify headers:
console.log('Request headers:', Object.fromEntries(headers.entries()));
```

---

## Additional Improvements

### 1. Token Refresh Mechanism (Optional)
Implement automatic token refresh before expiration:

```typescript
// In App.tsx, add token refresh check:
useEffect(() => {
  if (!session?.token) return;
  
  // Decode token to check expiration
  const payload = JSON.parse(atob(session.token.split('.')[1]));
  const expiresAt = payload.exp * 1000; // Convert to ms
  const now = Date.now();
  const timeLeft = expiresAt - now;
  
  // Refresh if less than 1 hour remaining
  if (timeLeft < 3600000) {
    // Call refresh endpoint
    refreshToken();
  }
}, [session]);
```

### 2. Better Session Persistence (Optional)
Use localStorage instead of sessionStorage for longer persistence:

```typescript
// In authFetch.ts:
const SESSION_KEY = 'afull_session';
// Change from sessionStorage to localStorage:
localStorage.setItem(SESSION_KEY, JSON.stringify(session));
localStorage.getItem(SESSION_KEY);
```

### 3. Automatic Re-authentication (Optional)
Store username (not password) to allow quick re-login:

```typescript
// Show re-login modal instead of full logout
// Preserve user's work in progress
```

---

## Testing Checklist

- [x] Added detailed logging to `requireAuth` middleware
- [x] Added detailed logging to `authFetch` and `authFetchJSON`
- [x] Enhanced error handling in `handleAddManualRegistro`
- [ ] Test with valid token (should work normally)
- [ ] Test with expired token (should show jwt expired and logout)
- [ ] Test with missing token (should show missing auth header)
- [ ] Test with invalid token (should show invalid token error)
- [ ] Verify console logs show clear error messages

---

## Next Steps

1. **Run the application** and monitor console logs
2. **Reproduce the 401 error** by adding an insumo
3. **Read the console logs** to identify exact failure point
4. **Apply specific fix** based on the error message:
   - Expired token → Extend JWT lifetime
   - Missing token → Check session storage
   - Invalid token → Check JWT secret consistency
   - Format error → Verify token encoding

5. **Verify the fix** by successfully adding an insumo

---

## Summary

The fixes add comprehensive logging at every step of the authentication flow:
1. Client-side: Session availability, token presence, request/response
2. Server-side: Token receipt, validation, and rejection reasons

This will immediately reveal the exact cause of the 401 error, allowing for a targeted fix.
