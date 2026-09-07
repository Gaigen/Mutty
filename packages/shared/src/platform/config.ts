export interface ConfigAdapter {
  getTokenEndpoint(): string | null;
  getDispatchEndpoint(): string | null;
  getWebAppUrl(): string;
  /** Desktop only: set server URL at runtime */
  setServerUrl?(url: string): Promise<void>;
  /** Desktop only: clear stored server URL */
  clearServerUrl?(): Promise<void>;
  /** Desktop only: validate URL format */
  isValidServerUrl?(url: string): boolean;
  /**
   * Desktop only: rewrite the scheme of the WebSocket URL returned by the token
   * server (it hands back LIVEKIT_PUBLIC_WS_URL, which the client cannot otherwise
   * influence). Adapters that do not implement this leave the URL untouched.
   */
  normalizeWsUrl?(url: string): string;
  /** Desktop only: current secure/insecure preference */
  isSecure?(): boolean;
  /** Desktop only: switch between https+wss and http+ws */
  setSecure?(secure: boolean): Promise<void>;
}
