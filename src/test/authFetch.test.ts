import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { authFetch, authFetchJSON, clearCSRFToken } from '../authFetch';

describe('authFetch', () => {
  beforeEach(() => {
    global.fetch = vi.fn();
    clearCSRFToken();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('CSRF Token Handling', () => {
    it('fetches CSRF token for POST requests', async () => {
      const mockCSRFResponse = {
        ok: true,
        json: async () => ({ success: true, data: { csrfToken: 'test-token-123' } })
      };

      const mockPostResponse = {
        ok: true,
        json: async () => ({ success: true })
      };

      (global.fetch as any)
        .mockResolvedValueOnce(mockCSRFResponse)
        .mockResolvedValueOnce(mockPostResponse);

      await authFetch('/api/test', { method: 'POST', body: JSON.stringify({ data: 'test' }) });

      expect(global.fetch).toHaveBeenCalledTimes(2);
      
      expect(global.fetch).toHaveBeenNthCalledWith(1, '/api/csrf-token', expect.objectContaining({
        credentials: 'include'
      }));
    });

    it('does not fetch CSRF token for GET requests', async () => {
      const mockGetResponse = {
        ok: true,
        json: async () => ({ data: 'test' })
      };

      (global.fetch as any).mockResolvedValueOnce(mockGetResponse);

      await authFetch('/api/test', { method: 'GET' });

      expect(global.fetch).toHaveBeenCalledTimes(1);
    });

    it('reuses cached CSRF token', async () => {
      const mockCSRFResponse = {
        ok: true,
        json: async () => ({ success: true, data: { csrfToken: 'cached-token' } })
      };

      const mockPostResponse = {
        ok: true,
        json: async () => ({ success: true })
      };

      (global.fetch as any)
        .mockResolvedValueOnce(mockCSRFResponse)
        .mockResolvedValueOnce(mockPostResponse)
        .mockResolvedValueOnce(mockPostResponse);

      await authFetch('/api/test1', { method: 'POST' });
      await authFetch('/api/test2', { method: 'POST' });

      expect(global.fetch).toHaveBeenCalledTimes(3);
    });
  });

  describe('authFetchJSON', () => {
    it('returns parsed JSON on success', async () => {
      const mockData = { users: ['user1', 'user2'] };
      const mockResponse = {
        ok: true,
        json: async () => mockData
      };

      (global.fetch as any).mockResolvedValueOnce(mockResponse);

      const result = await authFetchJSON('/api/users');

      expect(result).toEqual(mockData);
    });

    it('throws error with message on HTTP error', async () => {
      const mockError = {
        ok: false,
        status: 404,
        json: async () => ({
          error: {
            message: 'Resource not found'
          }
        })
      };

      (global.fetch as any).mockResolvedValueOnce(mockError);

      await expect(authFetchJSON('/api/notfound')).rejects.toThrow('Resource not found');
    });
  });

  describe('CSRF Token Error Handling', () => {
    it('throws error when CSRF token fetch fails', async () => {
      const mockCSRFResponse = {
        ok: false,
        status: 500
      };

      (global.fetch as any).mockResolvedValueOnce(mockCSRFResponse);

      await expect(authFetch('/api/test', { method: 'POST' })).rejects.toThrow('Failed to get CSRF token');
    });

    it('throws error when CSRF response has invalid structure', async () => {
      const mockCSRFResponse = {
        ok: true,
        json: async () => ({ invalid: 'structure' })
      };

      (global.fetch as any).mockResolvedValueOnce(mockCSRFResponse);

      await expect(authFetch('/api/test', { method: 'POST' })).rejects.toThrow();
    });

    it('clearCSRFToken() clears cached token', async () => {
      const mockCSRFResponse = {
        ok: true,
        json: async () => ({ success: true, data: { csrfToken: 'test-token' } })
      };

      const mockPostResponse = {
        ok: true,
        json: async () => ({ success: true })
      };

      (global.fetch as any)
        .mockResolvedValueOnce(mockCSRFResponse)
        .mockResolvedValueOnce(mockPostResponse)
        .mockResolvedValueOnce(mockCSRFResponse)
        .mockResolvedValueOnce(mockPostResponse);

      await authFetch('/api/test1', { method: 'POST' });
      expect(global.fetch).toHaveBeenCalledTimes(2);

      clearCSRFToken();

      await authFetch('/api/test2', { method: 'POST' });
      expect(global.fetch).toHaveBeenCalledTimes(4);
    });
  });

  describe('HTTP Methods', () => {
    it('adds CSRF token for PUT requests', async () => {
      const mockCSRFResponse = {
        ok: true,
        json: async () => ({ success: true, data: { csrfToken: 'put-token' } })
      };

      const mockPutResponse = {
        ok: true,
        json: async () => ({ success: true })
      };

      (global.fetch as any)
        .mockResolvedValueOnce(mockCSRFResponse)
        .mockResolvedValueOnce(mockPutResponse);

      await authFetch('/api/test', { method: 'PUT' });

      expect(global.fetch).toHaveBeenCalledTimes(2);
      expect(global.fetch).toHaveBeenNthCalledWith(2, '/api/test', expect.objectContaining({
        method: 'PUT',
        headers: expect.any(Headers)
      }));
    });

    it('adds CSRF token for DELETE requests', async () => {
      const mockCSRFResponse = {
        ok: true,
        json: async () => ({ success: true, data: { csrfToken: 'delete-token' } })
      };

      const mockDeleteResponse = {
        ok: true,
        json: async () => ({ success: true })
      };

      (global.fetch as any)
        .mockResolvedValueOnce(mockCSRFResponse)
        .mockResolvedValueOnce(mockDeleteResponse);

      await authFetch('/api/test', { method: 'DELETE' });

      expect(global.fetch).toHaveBeenCalledTimes(2);
      expect(global.fetch).toHaveBeenNthCalledWith(2, '/api/test', expect.objectContaining({
        method: 'DELETE'
      }));
    });

    it('adds CSRF token for PATCH requests', async () => {
      const mockCSRFResponse = {
        ok: true,
        json: async () => ({ success: true, data: { csrfToken: 'patch-token' } })
      };

      const mockPatchResponse = {
        ok: true,
        json: async () => ({ success: true })
      };

      (global.fetch as any)
        .mockResolvedValueOnce(mockCSRFResponse)
        .mockResolvedValueOnce(mockPatchResponse);

      await authFetch('/api/test', { method: 'PATCH' });

      expect(global.fetch).toHaveBeenCalledTimes(2);
      expect(global.fetch).toHaveBeenNthCalledWith(2, '/api/test', expect.objectContaining({
        method: 'PATCH'
      }));
    });

    it('does not fetch CSRF for HEAD requests', async () => {
      const mockHeadResponse = {
        ok: true,
        json: async () => ({ success: true })
      };

      (global.fetch as any).mockResolvedValueOnce(mockHeadResponse);

      await authFetch('/api/test', { method: 'HEAD' });

      expect(global.fetch).toHaveBeenCalledTimes(1);
      expect(global.fetch).toHaveBeenCalledWith('/api/test', expect.objectContaining({
        method: 'HEAD',
        credentials: 'include'
      }));
    });

    it('does not fetch CSRF for OPTIONS requests', async () => {
      const mockOptionsResponse = {
        ok: true,
        json: async () => ({ success: true })
      };

      (global.fetch as any).mockResolvedValueOnce(mockOptionsResponse);

      await authFetch('/api/test', { method: 'OPTIONS' });

      expect(global.fetch).toHaveBeenCalledTimes(1);
      expect(global.fetch).toHaveBeenCalledWith('/api/test', expect.objectContaining({
        method: 'OPTIONS'
      }));
    });

    it('handles lowercase http methods correctly', async () => {
      const mockCSRFResponse = {
        ok: true,
        json: async () => ({ success: true, data: { csrfToken: 'lowercase-token' } })
      };

      const mockPostResponse = {
        ok: true,
        json: async () => ({ success: true })
      };

      (global.fetch as any)
        .mockResolvedValueOnce(mockCSRFResponse)
        .mockResolvedValueOnce(mockPostResponse);

      await authFetch('/api/test', { method: 'post' });

      expect(global.fetch).toHaveBeenCalledTimes(2);
    });
  });

  describe('Credentials & Security', () => {
    it('includes credentials in all requests', async () => {
      const mockGetResponse = {
        ok: true,
        json: async () => ({ data: 'test' })
      };

      (global.fetch as any).mockResolvedValueOnce(mockGetResponse);

      await authFetch('/api/test', { method: 'GET' });

      expect(global.fetch).toHaveBeenCalledWith('/api/test', expect.objectContaining({
        credentials: 'include'
      }));
    });

    it('sets X-CSRF-Token header for POST', async () => {
      const mockCSRFResponse = {
        ok: true,
        json: async () => ({ success: true, data: { csrfToken: 'security-token' } })
      };

      const mockPostResponse = {
        ok: true,
        json: async () => ({ success: true })
      };

      (global.fetch as any)
        .mockResolvedValueOnce(mockCSRFResponse)
        .mockResolvedValueOnce(mockPostResponse);

      await authFetch('/api/test', { method: 'POST' });

      const postCall = (global.fetch as any).mock.calls[1];
      const headers = postCall[1].headers;
      expect(headers.get('X-CSRF-Token')).toBe('security-token');
    });

    it('preserves existing headers', async () => {
      const mockCSRFResponse = {
        ok: true,
        json: async () => ({ success: true, data: { csrfToken: 'test-token' } })
      };

      const mockPostResponse = {
        ok: true,
        json: async () => ({ success: true })
      };

      (global.fetch as any)
        .mockResolvedValueOnce(mockCSRFResponse)
        .mockResolvedValueOnce(mockPostResponse);

      await authFetch('/api/test', { 
        method: 'POST',
        headers: { 'Custom-Header': 'custom-value' }
      });

      const postCall = (global.fetch as any).mock.calls[1];
      const headers = postCall[1].headers;
      expect(headers.get('Custom-Header')).toBe('custom-value');
      expect(headers.get('X-CSRF-Token')).toBe('test-token');
    });
  });

  describe('authFetchJSON Error Handling', () => {
    it('throws error when JSON parsing fails', async () => {
      const mockResponse = {
        ok: false,
        status: 500,
        json: async () => { throw new Error('Invalid JSON'); }
      };

      (global.fetch as any).mockResolvedValueOnce(mockResponse);

      await expect(authFetchJSON('/api/test')).rejects.toThrow();
    });

    it('falls back to status code when no error message', async () => {
      const mockResponse = {
        ok: false,
        status: 500,
        json: async () => ({})
      };

      (global.fetch as any).mockResolvedValueOnce(mockResponse);

      await expect(authFetchJSON('/api/test')).rejects.toThrow('HTTP 500');
    });

    it('handles error response with different structure', async () => {
      const mockResponse = {
        ok: false,
        status: 400,
        json: async () => ({ message: 'Direct message' })
      };

      (global.fetch as any).mockResolvedValueOnce(mockResponse);

      await expect(authFetchJSON('/api/test')).rejects.toThrow('Direct message');
    });
  });

  describe('Edge Cases & Network Errors', () => {
    it('handles network errors in authFetch', async () => {
      (global.fetch as any).mockRejectedValueOnce(new Error('Network failure'));

      await expect(authFetch('/api/test')).rejects.toThrow('Network failure');
    });

    it('handles network errors in CSRF fetch', async () => {
      (global.fetch as any).mockRejectedValueOnce(new Error('CSRF network error'));

      await expect(authFetch('/api/test', { method: 'POST' })).rejects.toThrow('Failed to get CSRF token');
    });

    it('handles undefined method option', async () => {
      const mockGetResponse = {
        ok: true,
        json: async () => ({ data: 'test' })
      };

      (global.fetch as any).mockResolvedValueOnce(mockGetResponse);

      await authFetch('/api/test');

      expect(global.fetch).toHaveBeenCalledTimes(1);
      expect(global.fetch).toHaveBeenCalledWith('/api/test', expect.objectContaining({
        credentials: 'include'
      }));
    });
  });
});
