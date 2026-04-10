import { useState, useEffect, useCallback } from 'react';
import { usePlatform } from '@shared/platform';
import { Settings, X } from 'lucide-react';

interface ServerUrlSectionProps {
  onConfigured: (configured: boolean) => void;
}

export default function ServerUrlSection({ onConfigured }: ServerUrlSectionProps) {
  const { config } = usePlatform();
  const [serverUrl, setServerUrl] = useState('');
  const [serverError, setServerError] = useState('');
  const [showInput, setShowInput] = useState(false);
  const [configured, setConfigured] = useState(false);

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
        <p className="text-sm text-gray-500 text-center">
          Enter your server URL to get started
        </p>
        <div>
          <label htmlFor="server-url" className="block text-sm font-medium text-gray-400 mb-1">
            Server URL
          </label>
          <input
            type="text"
            id="server-url"
            value={serverUrl}
            onChange={(e) => { setServerUrl(e.target.value); setServerError(''); }}
            onKeyDown={(e) => { if (e.key === 'Enter') handleSave(); }}
            className="w-full px-4 py-2 bg-gray-800 border border-gray-700 rounded focus:ring-2 focus:ring-blue-500 focus:outline-none text-white placeholder-gray-500"
            placeholder="https://your-server.com"
            autoFocus
          />
          {serverError && (
            <p className="mt-1 text-xs text-red-400">{serverError}</p>
          )}
        </div>
        <button
          type="button"
          onClick={handleSave}
          className="w-full py-2 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded transition-colors"
        >
          Connect
        </button>
        <p className="text-xs text-gray-600 text-center">
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
          className="p-1.5 text-gray-500 hover:text-gray-300 transition-colors rounded hover:bg-gray-800"
          title="Change server"
        >
          <Settings size={16} />
        </button>
      </div>

      {showInput && (
        <div className="mb-4 p-3 bg-gray-800 rounded border border-gray-700">
          <div className="flex items-center justify-between mb-2">
            <label htmlFor="server-url" className="text-sm font-medium text-gray-400">
              Server URL
            </label>
            <button
              type="button"
              onClick={() => { setShowInput(false); setServerError(''); }}
              className="text-gray-500 hover:text-gray-300"
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
            className="w-full px-3 py-1.5 bg-gray-900 border border-gray-700 rounded focus:ring-2 focus:ring-blue-500 focus:outline-none text-white placeholder-gray-500 text-sm"
            placeholder="https://your-server.com"
            autoFocus
          />
          {serverError && (
            <p className="mt-1 text-xs text-red-400">{serverError}</p>
          )}
          <button
            type="button"
            onClick={handleSave}
            className="mt-2 w-full py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold rounded transition-colors"
          >
            Save
          </button>
        </div>
      )}
    </div>
  );
}
