export const environment = {
  production: false,
  // Dev: Angular serves on :4200 and proxies /api → :8000 (see proxy.conf.json),
  // so cookies stay same-origin.
  apiUrl: '/api/v1',
};
