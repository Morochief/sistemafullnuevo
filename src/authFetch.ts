/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * 
 * Authenticated Fetch Helper
 * SECURITY Phase 2 Fix #5: Works with httpOnly cookies (no token in localStorage)
 * SECURITY Phase 2 Fix #3: Includes CSRF token in all state-changing requests
 */

// SECURITY Phase 2 Fix #3: CSRF token cache
let csrfToken: string | null = null;
let csrfTokenPromise: Promise<string> | null = null;

/**
 * Get CSRF token from server
 * SECURITY Phase 2 Fix #3
 */
async function fetchCSRFToken(): Promise<string> {
  if (csrfToken) {
    return csrfToken;
  }
  if (csrfTokenPromise) {
    return csrfTokenPromise;
  }
  
  csrfTokenPromise = (async () => {
    try {
      const response = await fetch('/api/csrf-token', {
        credentials: 'include' // Include cookies
      });
      
      if (!response.ok) {
        throw new Error('Failed to fetch CSRF token');
      }
      
      const data = await response.json();
      csrfToken = data.data.csrfToken;
      return csrfToken!;
    } catch (error) {
      console.error('[CSRF] Failed to fetch CSRF token:', error);
      throw error;
    } finally {
      csrfTokenPromise = null;
    }
  })();

  return csrfTokenPromise;
}

/**
 * Fetch with automatic JWT authentication from httpOnly cookie
 * SECURITY Phase 2 Fix #5: No Authorization header needed - JWT in cookie
 * SECURITY Phase 2 Fix #3: Adds CSRF token for state-changing requests
 * Mobile Fix: Retry automático si el token CSRF expiró (OS mató el tab y lo reactivó)
 */
export async function authFetch(url: string, options: RequestInit = {}): Promise<Response> {
  const headers = new Headers(options.headers);
  const isMutating = options.method && !['GET', 'HEAD', 'OPTIONS'].includes(options.method.toUpperCase());

  // SECURITY Phase 2 Fix #3: Add CSRF token for state-changing requests
  if (isMutating) {
    try {
      const token = await fetchCSRFToken();
      headers.set('X-CSRF-Token', token);
    } catch (error) {
      console.error('[authFetch] Failed to get CSRF token:', error);
      throw new Error('Failed to get CSRF token');
    }
  }

  // SECURITY Phase 2 Fix #5: JWT automatically sent via httpOnly cookie
  const response = await fetch(url, {
    ...options,
    headers,
    credentials: 'include' // IMPORTANT: Include cookies in request
  });

  // Mobile Fix: Si el servidor rechaza el CSRF, limpiar cache y reintentar UNA sola vez.
  // Ocurre en mobile cuando el OS mata el tab y el servidor reinició (perdió el Map en memoria).
  if (response.status === 403 && isMutating) {
    try {
      const errorBody = await response.clone().json();
      const errorCode = errorBody?.error?.code;
      if (
        errorCode === 'CSRF_TOKEN_INVALID' ||
        errorCode === 'CSRF_TOKEN_MISSING' ||
        errorCode === 'CSRF_TOKEN_EXPIRED'
      ) {
        console.warn('[authFetch] CSRF token invalid/expired, refreshing and retrying once...');
        csrfToken = null; // invalidar cache
        csrfTokenPromise = null;
        const newToken = await fetchCSRFToken(); // obtener token fresco del servidor
        headers.set('X-CSRF-Token', newToken);
        // Reintentar la request original con el token nuevo (sin más retries)
        return fetch(url, {
          ...options,
          headers,
          credentials: 'include'
        });
      }
    } catch {
      // Si falla el parse del error body, devolver la response original sin reintentar
    }
  }

  return response;
}

/**
 * Fetch with automatic JWT + JSON handling
 * Returns parsed JSON or throws error
 */
export async function authFetchJSON<T = any>(
  url: string,
  options: RequestInit = {}
): Promise<T> {
  const response = await authFetch(url, options);
  
  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new Error(error.error?.message || error.message || `HTTP ${response.status}`);
  }
  
  return response.json();
}

/**
 * Clear CSRF token cache (call on logout)
 */
export function clearCSRFToken() {
  csrfToken = null;
}
