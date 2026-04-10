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
}
