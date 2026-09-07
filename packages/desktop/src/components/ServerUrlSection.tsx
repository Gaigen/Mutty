import { useState, useEffect, useCallback } from 'react';
import { usePlatform } from '@shared/platform';
import { Settings, X } from 'lucide-react';

interface ServerUrlSectionProps {
  onConfigured: (configured: boolean) => void;
}

/**
 * Picks the scheme for both the token endpoint and the LiveKit WebSocket URL.
 * The token server dictates the ws URL it hands back, so without this there is no
 * way to try the other scheme against an existing deployment.
 */
function SecurityToggle({
  secure,
  onChange,
}: {
  secure: boolean;
  onChange: (secure: boolean) => void;
}) {
  const options = [
    { value: true, label: 'Secure', hint: 'https / wss' },
    { value: false, label: 'Insecure', hint: 'http / ws' },
  ];
  return (
    <fieldset>
      <legend className="block text-sm font-medium text-[var(--mutty-fg-2)] mb-1">
        Connection
      </legend>
      <div className="flex gap-2">
        {options.map((opt) => (
          <label
            key={String(opt.value)}
            className={`flex-1 flex items-center gap-2 px-3 py-2 rounded border cursor-pointer transition-colors ${
              secure === opt.value
                ? 'border-[var(--mutty-accent-1)] bg-[var(--mutty-surface-2)]'
                : 'border-[var(--mutty-border-2)] hover:bg-[var(--mutty-surface-1)]'
            }`}
          >
            <input
              type="radio"
              name="server-security"
              className="accent-[var(--mutty-accent-1)]"
              checked={secure === opt.value}
              onChange={() => onChange(opt.value)}
            />
            <span className="text-sm text-[var(--mutty-fg-1)]">{opt.label}</span>
            <span className="text-xs text-[var(--mutty-fg-3)] ml-auto">{opt.hint}</span>
          </label>
        ))}
      </div>
    </fieldset>
  );
}

export default function ServerUrlSection({ onConfigured }: ServerUrlSectionProps) {
  const { config } = usePlatform();
  const [serverUrl, setServerUrl] = useState('');
  const [serverError, setServerError] = useState('');
  const [showInput, setShowInput] = useState(false);
  const [configured, setConfigured] = useState(false);
  const [secure, setSecure] = useState(() => config.isSecure?.() ?? true);

  const handleSecureChange = useCallback(async (next: boolean) => {
    setSecure(next);
    setServerError('');
    await config.setSecure?.(next);
  }, [config]);

  useEffect(() => {
    const endpoint = config.getTokenEndpoint();
    if (endpoint) {
      // Strip /api/token to get base URL
      const base = endpoint.replace(/\/api\/token$/, '');
      setServerUrl(base);
      setConfigured(true);
      onConfigured(true);
    } else {
      setConfigured(false);
      onConfigured(false);
    }
  }, [config, onConfigured]);

  const handleSave = useCallback(async () => {
    if (!config.isValidServerUrl?.(serverUrl)) {
      setServerError('Please enter a valid URL (e.g. https://your-server.com)');
      return;
    }
    setServerError('');
    await config.setServerUrl?.(serverUrl.trim());
    setConfigured(true);
    setShowInput(false);
    onConfigured(true);
  }, [config, serverUrl, onConfigured]);

  const handleChange = useCallback(async () => {
    await config.clearServerUrl?.();
    setConfigured(false);
    setShowInput(true);
    onConfigured(false);
  }, [config, onConfigured]);

  // Not configured — full-screen setup prompt
  if (!configured && !showInput) {
    return (
      <div className="flex flex-col gap-4">
        <p className="text-sm text-[var(--mutty-fg-3)] text-center">
          Enter your server URL to get started
        </p>
        <div>
          <label htmlFor="server-url" className="block text-sm font-medium text-[var(--mutty-fg-2)] mb-1">
            Server URL
          </label>
          <input
            type="text"
            id="server-url"
            value={serverUrl}
            onChange={(e) => { setServerUrl(e.target.value); setServerError(''); }}
            onKeyDown={(e) => { if (e.key === 'Enter') handleSave(); }}
            className="w-full px-4 py-2 bg-[var(--mutty-surface-1)] border border-[var(--mutty-border-2)] rounded focus:ring-2 focus:ring-[var(--mutty-accent-1)] focus:outline-none text-[var(--mutty-fg-1)] placeholder-[var(--mutty-fg-3)]"
            placeholder="your-server.com"
            autoFocus
          />
          {serverError && (
            <p className="mt-1 text-xs text-[var(--mutty-danger)]">{serverError}</p>
          )}
        </div>
        <SecurityToggle secure={secure} onChange={handleSecureChange} />
        <button
          type="button"
          onClick={handleSave}
          className="w-full py-2 bg-[var(--mutty-accent-1)] hover:bg-[var(--mutty-accent-2)] text-[var(--mutty-fg-10)] font-semibold rounded transition-colors"
        >
          Connect
        </button>
        <p className="text-xs text-[var(--mutty-fg-3)] text-center">
          This should be the URL of your LiveKit token server
        </p>
      </div>
    );
  }

  // Configured — show settings gear + optional inline edit
  return (
    <div className="mb-4">
      <div className="flex items-center justify-end -mt-2 mb-2">
        <button
          type="button"
          onClick={handleChange}
          className="p-1.5 text-[var(--mutty-fg-3)] hover:text-[var(--mutty-fg-1)] transition-colors rounded hover:bg-[var(--mutty-surface-1)]"
          title="Change server"
        >
          <Settings size={16} />
        </button>
      </div>

      {showInput && (
        <div className="mb-4 p-3 bg-[var(--mutty-surface-1)] rounded border border-[var(--mutty-border-2)]">
          <div className="flex items-center justify-between mb-2">
            <label htmlFor="server-url" className="text-sm font-medium text-[var(--mutty-fg-2)]">
              Server URL
            </label>
            <button
              type="button"
              onClick={() => { setShowInput(false); setServerError(''); }}
              className="text-[var(--mutty-fg-3)] hover:text-[var(--mutty-fg-1)]"
            >
              <X size={14} />
            </button>
          </div>
          <input
            type="text"
            id="server-url"
            value={serverUrl}
            onChange={(e) => { setServerUrl(e.target.value); setServerError(''); }}
            onKeyDown={(e) => { if (e.key === 'Enter') handleSave(); }}
            className="w-full px-3 py-1.5 bg-[var(--mutty-surface-2)] border border-[var(--mutty-border-2)] rounded focus:ring-2 focus:ring-[var(--mutty-accent-1)] focus:outline-none text-[var(--mutty-fg-1)] placeholder-[var(--mutty-fg-3)] text-sm"
            placeholder="your-server.com"
            autoFocus
          />
          {serverError && (
            <p className="mt-1 text-xs text-[var(--mutty-danger)]">{serverError}</p>
          )}
          <div className="mt-2">
            <SecurityToggle secure={secure} onChange={handleSecureChange} />
          </div>
          <button
            type="button"
            onClick={handleSave}
            className="mt-2 w-full py-1.5 bg-[var(--mutty-accent-1)] hover:bg-[var(--mutty-accent-2)] text-[var(--mutty-fg-10)] text-sm font-semibold rounded transition-colors"
          >
            Save
          </button>
        </div>
      )}
    </div>
  );
}
