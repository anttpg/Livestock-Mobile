let sessionExpiredCallback = null;

export const setSessionExpiredCallback = (callback) => {
  sessionExpiredCallback = callback;
};

// List of endpoints that are expected to return 401/403
const AUTH_ENDPOINTS = [
  '/api/check-auth',
  '/api/login',
  '/api/auth/check',
  '/api/auth/register',
  '/api/auth/set-password',
  '/api/auth/email'
];

const originalFetch = window.fetch;
window.fetch = function(...args) {
  return originalFetch.apply(this, args)
    .then(response => {
      if (response.status === 403 || response.status === 401) {
        const url = args[0];
        if (typeof url === 'string' && url.startsWith('/api/')) {
          // Don't trigger session expired for auth-related endpoints
          const isAuthEndpoint = AUTH_ENDPOINTS.some(endpoint => url.includes(endpoint));
          
          if (isAuthEndpoint) {
            return response;
          }
          
          // For other endpoints, trigger session expired callback
          if (sessionExpiredCallback) {
            sessionExpiredCallback();
          }
        }
      }
      return response;
    })
    .catch(error => {
      throw error;
    });
};