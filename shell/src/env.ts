// Stub for Outline's env module
const env = {
  APP_NAME: 'ASuite',
  URL: typeof window !== 'undefined' ? window.location.origin : 'http://localhost:3101',
  CDN_URL: '',
  COLLABORATION_URL: '',
  SENTRY_DSN: '',
  SENTRY_TUNNEL: '',
  DEPLOYMENT: 'self-hosted',
  RELEASE: '0.1.0',
  ENVIRONMENT: 'production',
};
export default env;
