// Collaborative whiteboard using tldraw + LiveKit data channel. No Yjs.

import * as React from 'react';
import {
  Tldraw,
  createTLStore,
  defaultShapeUtils,
} from '@tldraw/tldraw';
import '@tldraw/tldraw/tldraw.css';
import { useFloatingWindow, FloatingWindow } from '../../floating';
import { useModuleToggle } from '../../hooks';
import { useTheme } from '../../context/ThemeContext';
import { useTldrawSync } from './useTldrawSync';
import { iconTypes } from '@tldraw/tldraw';

export const TLDRAW_ID = 'tldraw';

// Self-hosted assets — served from /tldraw-assets/ (copied from @tldraw/assets at build time)
const BASE = '/tldraw-assets';
const assetUrls = {
  fonts: {
    tldraw_mono: `${BASE}/fonts/IBMPlexMono-Medium.woff2`,
    tldraw_mono_bold: `${BASE}/fonts/IBMPlexMono-Bold.woff2`,
    tldraw_mono_italic: `${BASE}/fonts/IBMPlexMono-MediumItalic.woff2`,
    tldraw_mono_italic_bold: `${BASE}/fonts/IBMPlexMono-BoldItalic.woff2`,
    tldraw_sans: `${BASE}/fonts/IBMPlexSans-Medium.woff2`,
    tldraw_sans_bold: `${BASE}/fonts/IBMPlexSans-Bold.woff2`,
    tldraw_sans_italic: `${BASE}/fonts/IBMPlexSans-MediumItalic.woff2`,
    tldraw_sans_italic_bold: `${BASE}/fonts/IBMPlexSans-BoldItalic.woff2`,
    tldraw_serif: `${BASE}/fonts/IBMPlexSerif-Medium.woff2`,
    tldraw_serif_bold: `${BASE}/fonts/IBMPlexSerif-Bold.woff2`,
    tldraw_serif_italic: `${BASE}/fonts/IBMPlexSerif-MediumItalic.woff2`,
    tldraw_serif_italic_bold: `${BASE}/fonts/IBMPlexSerif-BoldItalic.woff2`,
    tldraw_draw: `${BASE}/fonts/Shantell_Sans-Informal_Regular.woff2`,
    tldraw_draw_bold: `${BASE}/fonts/Shantell_Sans-Informal_Bold.woff2`,
    tldraw_draw_italic: `${BASE}/fonts/Shantell_Sans-Informal_Regular_Italic.woff2`,
    tldraw_draw_italic_bold: `${BASE}/fonts/Shantell_Sans-Informal_Bold_Italic.woff2`,
  },
  icons: Object.fromEntries(
    iconTypes.map((name) => [name, `${BASE}/icons/icon/0_merged.svg#${name}`])
  ),
  translations: {
    ar: `${BASE}/translations/ar.json`, bn: `${BASE}/translations/bn.json`,
    ca: `${BASE}/translations/ca.json`, cs: `${BASE}/translations/cs.json`,
    da: `${BASE}/translations/da.json`, de: `${BASE}/translations/de.json`,
    el: `${BASE}/translations/el.json`, en: `${BASE}/translations/en.json`,
    es: `${BASE}/translations/es.json`, fa: `${BASE}/translations/fa.json`,
    fi: `${BASE}/translations/fi.json`, fr: `${BASE}/translations/fr.json`,
    gl: `${BASE}/translations/gl.json`, 'gu-in': `${BASE}/translations/gu-in.json`,
    he: `${BASE}/translations/he.json`, 'hi-in': `${BASE}/translations/hi-in.json`,
    hr: `${BASE}/translations/hr.json`, hu: `${BASE}/translations/hu.json`,
    id: `${BASE}/translations/id.json`, it: `${BASE}/translations/it.json`,
    ja: `${BASE}/translations/ja.json`, 'km-kh': `${BASE}/translations/km-kh.json`,
    kn: `${BASE}/translations/kn.json`, 'ko-kr': `${BASE}/translations/ko-kr.json`,
    ku: `${BASE}/translations/ku.json`, languages: `${BASE}/translations/languages.json`,
    main: `${BASE}/translations/main.json`, ml: `${BASE}/translations/ml.json`,
    mr: `${BASE}/translations/mr.json`, ms: `${BASE}/translations/ms.json`,
    my: `${BASE}/translations/my.json`, ne: `${BASE}/translations/ne.json`,
    nl: `${BASE}/translations/nl.json`, no: `${BASE}/translations/no.json`,
    pa: `${BASE}/translations/pa.json`, pl: `${BASE}/translations/pl.json`,
    'pt-br': `${BASE}/translations/pt-br.json`, 'pt-pt': `${BASE}/translations/pt-pt.json`,
    ro: `${BASE}/translations/ro.json`, ru: `${BASE}/translations/ru.json`,
    sl: `${BASE}/translations/sl.json`, so: `${BASE}/translations/so.json`,
    sv: `${BASE}/translations/sv.json`, ta: `${BASE}/translations/ta.json`,
    te: `${BASE}/translations/te.json`, th: `${BASE}/translations/th.json`,
    tl: `${BASE}/translations/tl.json`, tr: `${BASE}/translations/tr.json`,
    uk: `${BASE}/translations/uk.json`, ur: `${BASE}/translations/ur.json`,
    vi: `${BASE}/translations/vi.json`, 'zh-cn': `${BASE}/translations/zh-cn.json`,
    'zh-tw': `${BASE}/translations/zh-tw.json`,
  } as Record<string, string>,
  embedIcons: {
    codepen: `${BASE}/embed-icons/codepen.png`,
    codesandbox: `${BASE}/embed-icons/codesandbox.png`,
    desmos: `${BASE}/embed-icons/desmos.png`,
    excalidraw: `${BASE}/embed-icons/excalidraw.png`,
    felt: `${BASE}/embed-icons/felt.png`,
    figma: `${BASE}/embed-icons/figma.png`,
    github_gist: `${BASE}/embed-icons/github_gist.png`,
    google_calendar: `${BASE}/embed-icons/google_calendar.png`,
    google_maps: `${BASE}/embed-icons/google_maps.png`,
    google_slides: `${BASE}/embed-icons/google_slides.png`,
    observable: `${BASE}/embed-icons/observable.png`,
    replit: `${BASE}/embed-icons/replit.png`,
    scratch: `${BASE}/embed-icons/scratch.png`,
    spotify: `${BASE}/embed-icons/spotify.png`,
    tldraw: `${BASE}/embed-icons/tldraw.png`,
    val_town: `${BASE}/embed-icons/val_town.png`,
    vimeo: `${BASE}/embed-icons/vimeo.png`,
    youtube: `${BASE}/embed-icons/youtube.png`,
  } as Record<string, string>,
};

/** Error boundary to catch tldraw crashes instead of silently unmounting */
class TldrawErrorBoundary extends React.Component<
  { children: React.ReactNode },
  { error: Error | null }
> {
  state = { error: null as Error | null };

  static getDerivedStateFromError(error: Error) {
    return { error };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.error('[TldrawModule] Crashed:', error, info);
  }

  render() {
    if (this.state.error) {
      return (
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          height: '100%', color: '#ef4444', padding: 20, textAlign: 'center',
          flexDirection: 'column', gap: 8,
        }}>
          <div style={{ fontSize: 14, fontWeight: 600 }}>Whiteboard crashed</div>
          <div style={{ fontSize: 11, opacity: 0.7 }}>{this.state.error.message}</div>
          <button
            onClick={() => this.setState({ error: null })}
            style={{
              marginTop: 8, padding: '4px 12px', borderRadius: 4,
              border: '1px solid rgba(255,255,255,0.2)', background: 'rgba(255,255,255,0.1)',
              color: '#e2e8f0', cursor: 'pointer', fontSize: 11,
            }}
          >
            Retry
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

export function TldrawModule() {
  const { resolvedTheme } = useTheme();
  const win = useFloatingWindow({
    id: TLDRAW_ID,
    initialPosition: { x: 120, y: 80 },
    initialSize: { w: 900, h: 650 },
    minSize: { w: 500, h: 350 },
    title: '🎨 Whiteboard',
    isSingleton: true,
  });

  const [store] = React.useState(() =>
    createTLStore({ shapeUtils: [...defaultShapeUtils] }),
  );

  const storeWithStatus = useTldrawSync(store);

  useModuleToggle('tldraw', win.toggle);

  if (!win.isOpen) return null;

  return (
    <FloatingWindow api={win}>
      <div
        className="w-full h-full"
        style={{ position: 'relative' }}
        data-theme={resolvedTheme}
      >
        <TldrawErrorBoundary>
          <Tldraw store={storeWithStatus} assetUrls={assetUrls} />
        </TldrawErrorBoundary>
      </div>
    </FloatingWindow>
  );
}
