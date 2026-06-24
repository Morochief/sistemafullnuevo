# Test Authentication Flow - Quick Guide

## Quick Test Steps

### 1. Start the Application
```bash
npm run dev
```

### 2. Open Browser Console
- Press F12 or right-click → Inspect
- Go to Console tab
- Keep it open during testing

### 3. Login
1. Navigate to http://localhost:3000
2. Login with credentials:
   - **Admin**: usuario: `admin`, password: `admin123`
   - **Kevin**: usuario: `kevin`, password: `kevin123`
   - **Rodrigo**: usuario: `rodrigo`, password: `rodrigo123`

### 4. Check Session in Console
Open console and type:
```javascript
JSON.parse(sessionStorage.getItem('afull_session'))
```

Expected output:
```json
{
  "nombre": "Kevin Delgado",
  "rol": "Operario",
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
}
```

If you see `null`, the session is not stored correctly.

### 5. Navigate to "Registro" Tab
Click on "Registro" in the navigation

### 6. Try to Add an Insumo
Fill in the form:
- **Cliente**: Select any client
- **Proyecto**: Select any project
- **Concepto**: Select "Insumo"
- **Descripción**: "Vinilo de prueba"
- **Cantidad**: 5
- **Precio Unitario**: 1000

Click "Agregar Registro"

### 7. Watch Console Logs

#### Success Case (Working Auth):
```
[APP] handleAddManualRegistro called with: {clienteId: "cli_1", ...}
[APP] Current session: {nombre: "Kevin Delgado", hasToken: true}
[authFetch] Making authenticated request to /api/registros - token length: 180
[authFetch] Response received: 201 Created for /api/registros
[APP] Server response: {success: true, data: {...}}
[APP] Database state updated successfully
```

#### Failure Case (Auth Error):
```
[APP] handleAddManualRegistro called with: {clienteId: "cli_1", ...}
[APP] Current session: {nombre: "Kevin Delgado", hasToken: true}
[authFetch] Making authenticated request to /api/registros - token length: 180
[authFetch] Response received: 401 Unauthorized for /api/registros
[authFetchJSON] Request failed: 401 Unauthorized for /api/registros
[authFetchJSON] Error details: {error: {code: "INVALID_TOKEN", message: "jwt expired"}}
[APP] Error creating registro: jwt expired
[APP] AUTH ERROR DETECTED - triggering logout
```

### 8. Check Server Console

#### Success Case:
```
[AUTH] Token received for POST /api/registros - length: 180
[AUTH] Token verified successfully - user: Kevin Delgado rol: Operario
```

#### Failure Case (Expired Token):
```
[AUTH] Token received for POST /api/registros - length: 180
[AUTH] Token verification failed on POST /api/registros - error: jwt expired
```

#### Failure Case (Missing Token):
```
[AUTH] Missing Authorization header on POST /api/registros
```

#### Failure Case (Wrong Format):
```
[AUTH] Invalid Authorization format on POST /api/registros - got: Basic xxxxx
```

---

## Common Issues & Solutions

### Issue 1: "Missing Authorization header"
**Cause**: Token not being sent from client  
**Check**:
```javascript
// In browser console:
JSON.parse(sessionStorage.getItem('afull_session'))
```
**Solution**: If null, session was cleared. Re-login.

### Issue 2: "jwt expired"
**Cause**: Token expired (24h lifetime)  
**Solution**: Either re-login OR extend token lifetime:

```typescript
// In server-auth.ts, line 15:
const JWT_EXPIRES_IN = '7d'; // Change from '24h' to '7d'
```

Then restart server and re-login to get new token.

### Issue 3: "invalid signature"
**Cause**: JWT_SECRET mismatch  
**Solution**: Check .env file or environment variable

### Issue 4: Token has correct length but still fails
**Cause**: Token was generated with different secret  
**Solution**: Re-login to generate new token with current secret

---

## Manual Token Inspection

### Decode JWT Token (Client-side)
```javascript
// In browser console:
const session = JSON.parse(sessionStorage.getItem('afull_session'));
const token = session.token;
const payload = JSON.parse(atob(token.split('.')[1]));
console.log('Token payload:', payload);
console.log('Issued at:', new Date(payload.iat * 1000));
console.log('Expires at:', new Date(payload.exp * 1000));
console.log('Time left:', (payload.exp * 1000 - Date.now()) / 1000 / 60, 'minutes');
```

Expected output:
```javascript
{
  usuario: "kevin",
  nombre: "Kevin Delgado",
  rol: "Operario",
  iat: 1234567890, // Issued timestamp
  exp: 1234654290  // Expiry timestamp (24h later)
}
```

### Check Token Expiration
```javascript
const session = JSON.parse(sessionStorage.getItem('afull_session'));
const payload = JSON.parse(atob(session.token.split('.')[1]));
const isExpired = payload.exp * 1000 < Date.now();
console.log('Token expired?', isExpired);
```

---

## Force Token Expiration (For Testing)

### Test Expired Token Handling
1. Login normally
2. In browser console, modify token expiration:
```javascript
// This won't actually work because token is signed
// But you can manually create expired token scenario:

// Option 1: Wait 24 hours
// Option 2: Change server token lifetime to 1 minute:
```

In `server-auth.ts`:
```typescript
const JWT_EXPIRES_IN = '1m'; // 1 minute for testing
```

Restart server, login, wait 1 minute, then try to add registro.

---

## Network Tab Verification

### Check Request Headers
1. Open DevTools → Network tab
2. Filter by "XHR" or "Fetch"
3. Try to add registro
4. Click on "/api/registros" request
5. Check **Request Headers**:

Should see:
```
Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
Content-Type: application/json
```

### Check Response
Click on Response tab:

**Success (201)**:
```json
{
  "success": true,
  "data": {
    "id": "reg_xxx",
    "clienteId": "cli_1",
    ...
  },
  "message": "Registro creado con éxito"
}
```

**Failure (401)**:
```json
{
  "success": false,
  "error": {
    "code": "INVALID_TOKEN",
    "message": "jwt expired"
  }
}
```

---

## Summary

With the logging enhancements, you will immediately see:
1. ✅ If token exists in session
2. ✅ If token is being sent in request
3. ✅ If server receives the token
4. ✅ Why token validation fails (expired/invalid/missing)
5. ✅ Exact error message for debugging

This makes it trivial to identify and fix the 401 issue.
