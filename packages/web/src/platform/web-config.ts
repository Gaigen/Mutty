import type { ConfigAdapter } from '@shared/platform/config';

const TOKEN_ENDPOINT = import.meta.env.VITE_TOKEN_ENDPOINT || 'http://127.0.0.1:4000/api/token';

export class WebConfig implements ConfigAdapter {
  getTokenEndpoint(): string {
    return TOKEN_ENDPOINT;
  }

  getDispatchEndpoint(): string {
    return TOKEN_ENDPOINT.replace('/api/token', '/api/agent/dispatch');
  }

  getWebAppUrl(): string {
    return window.location.origin;
  }
}
