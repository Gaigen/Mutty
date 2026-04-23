// Yjs document synced over LiveKit data channel.

import * as React from 'react';
import * as Y from 'yjs';
import { useCollab } from './CollabProvider';

export function useYjsDoc(moduleId: string): Y.Doc {
  const { sendUpdate, subscribe } = useCollab();
  const docRef = React.useRef<Y.Doc>();

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

  return doc;
}
