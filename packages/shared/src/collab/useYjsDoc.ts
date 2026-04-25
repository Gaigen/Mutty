// Yjs document synced over LiveKit data channel.

import * as React from 'react';
import * as Y from 'yjs';
import { useCollab } from './CollabProvider';

export function useYjsDoc(moduleId: string): Y.Doc {
  const { sendUpdate, subscribe } = useCollab();
  const docRef = React.useRef<Y.Doc | null>(null);

  if (!docRef.current) {
    docRef.current = new Y.Doc();
  }
  const doc = docRef.current;

  // Send local updates
  React.useEffect(() => {
    const handler = (update: Uint8Array) => {
      sendUpdate(moduleId, update);
    };
    doc.on('update', handler);
    return () => { doc.off('update', handler); };
  }, [doc, moduleId, sendUpdate]);

  // Receive remote updates
  React.useEffect(() => {
    const unsub = subscribe(moduleId, (update) => {
      Y.applyUpdate(doc, new Uint8Array(update));
    });
    return unsub;
  }, [doc, moduleId, subscribe]);

  // Destroy the Y.Doc when the hook unmounts to release all internal
  // event listeners and prevent memory leaks.  This matters especially under
  // React StrictMode (double-mount) and during HMR where the component is
  // torn down and rebuilt without a full page reload.
  // We also null out docRef so a future mount creates a fresh document.
  React.useEffect(() => {
    return () => {
      doc.destroy();
      docRef.current = null;
    };
  }, [doc]);

  return doc;
}
