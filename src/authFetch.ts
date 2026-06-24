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

/**
 * Get CSRF token from server
 * SECURITY Phase 2 Fix #3
 */
async function fetchCSRFToken(): Promise<string> {
  if (csrfToken) {
    return csrfToken;
  }
  
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
  }
}

/**
 * Fetch with automatic JWT authentication from httpOnly cookie
 * SECURITY Phase 2 Fix #5: No Authorization header needed - JWT in cookie
 * SECURITY Phase 2 Fix #3: Adds CSRF token for state-changing requests
 */
export async function authFetch(url: string, options: RequestInit = {}): Promise<Response> {
  const headers = new Headers(options.headers);
  
  // SECURITY Phase 2 Fix #3: Add CSRF token for state-changing requests
  if (options.method && !['GET', 'HEAD', 'OPTIONS'].includes(options.method.toUpperCase())) {
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
