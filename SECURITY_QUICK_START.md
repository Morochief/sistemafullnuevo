# Security Phase 1 - Quick Start Guide

## ⚡ Immediate Actions Required

### 1. Generate and Set JWT_SECRET

**⚠️ CRITICAL: The server will NOT start without a proper JWT_SECRET!**

```bash
# Generate a secure JWT secret (choose one):

# Option A: OpenSSL (Unix/Linux/macOS)
openssl rand -base64 32

# Option B: Node.js
node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"

# Option C: PowerShell (Windows)
[Convert]::ToBase64String((1..32 | ForEach-Object { Get-Random -Min 0 -Max 256 }))
```

**Add to your `.env` file:**
```env
JWT_SECRET="paste-your-generated-secret-here"
GEMINI_API_KEY="your-gemini-api-key"
APP_URL="http://localhost:3000"
```

### 2. Verify Security Setup

```bash
# Check database permissions (Unix/Linux/macOS only)
ls -la database.json
# Expected: -rw------- (600)

# Start the server
npm run dev
# Server will throw error if JWT_SECRET is invalid

# Build for production
npm run build
npm start
```

---

## 🔒 What Was Fixed

| Task | Status | Impact |
|------|--------|--------|
| **1. JWT_SECRET** | ✅ Fixed | No more hardcoded fallback - server validates on startup |
| **2. Client Credentials** | ✅ Removed | Demo users removed from browser bundle |
| **3. Database Permissions** | ✅ Set | database.json now restricted to owner only (Unix) |
| **4. Rate Limiting** | ✅ Added | Login limited to 5 attempts per 15 minutes |
| **5. Gemini API Key** | ✅ Hardened | Generic error messages, no info leak |
| **6. HTTPS Enforcement** | ✅ Added | Production automatically redirects to HTTPS |

---

## 🧪 Quick Test

### Test Rate Limiting
```bash
# Try logging in 6 times with wrong password
# Attempts 1-5: 401 (invalid credentials)
# Attempt 6+: 429 (rate limit exceeded)

for i in {1..6}; do
  curl -X POST http://localhost:3000/api/auth/login \
    -H "Content-Type: application/json" \
    -d '{"usuario":"wrong","password":"wrong"}' \
    -w "\nStatus: %{http_code}\n"
  sleep 1
done
```

### Test JWT_SECRET Validation
```bash
# Comment out JWT_SECRET in .env, then:
npm run dev
# Expected: Error about JWT_SECRET required
```

### Test Client Security
```bash
# Build and check that credentials are NOT in bundle
npm run build
grep -r "admin123" dist/  # Should return nothing
```

---

## 📋 Login Credentials

**For testing purposes only** (server-side hashed):

| User | Password | Role |
|------|----------|------|
| admin | admin123 | Admin |
| kevin | kevin123 | Operario |
| rodrigo | rodrigo123 | Técnico |

**Note:** These are no longer visible in the client code. All authentication is server-side only.

---

## 🚨 Production Checklist

Before deploying to production:

- [ ] `JWT_SECRET` is set to a unique 32+ character random string
- [ ] `JWT_SECRET` is NOT the example value from `.env.example`
- [ ] `GEMINI_API_KEY` is set (if using AI features)
- [ ] `NODE_ENV=production` is set
- [ ] Database file permissions are 600 (Unix) or properly secured (Windows)
- [ ] HTTPS is enabled (certificate configured)
- [ ] Rate limiting is working (test with failed logins)
- [ ] Demo credentials are changed or disabled

---

## 🆘 Troubleshooting

### Server won't start
**Error:** `SECURITY ERROR: JWT_SECRET must be set...`  
**Fix:** Generate and set JWT_SECRET in `.env` file

### "Too many login attempts"
**Cause:** Rate limiter active (5 attempts per 15 minutes)  
**Fix:** Wait 15 minutes or restart server (dev only)

### Database permission warning
**OS:** Windows  
**Info:** File permissions not enforced on Windows - use NTFS permissions manually

### Gemini API not working
**Error:** `El servicio de IA no está disponible...`  
**Fix:** Set valid GEMINI_API_KEY (min 20 characters)

---

## 📚 Full Documentation

See `SECURITY_PHASE1_IMPLEMENTATION.md` for:
- Detailed implementation notes
- Complete testing instructions
- Code examples
- Phase 2 recommendations

---

**Status:** ✅ Ready for Production  
**Security Level:** Phase 1 CRITICAL fixes completed  
**Next:** Consider Phase 2 enhancements (audit logging, session management, etc.)
