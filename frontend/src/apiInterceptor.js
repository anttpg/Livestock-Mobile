let sessionExpiredCallback = null;

export const setSessionExpiredCallback = (callback) => {
  sessionExpiredCallback = callback;
};

const originalFetch = window.fetch;
window.fetch = function(...args) {
  return originalFetch.apply(this, args)
    .then(response => {
      if (response.status === 403 || response.status === 401) {
        const url = args[0];
        if (typeof url === 'string' && url.startsWith('/api/')) {
          // Don't trigger session expired for auth check endpoint
          // or login endpoint - these are expected to return 401
          if (url === '/api/check-auth' || url === '/api/login') {
            return response;
          }
          
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