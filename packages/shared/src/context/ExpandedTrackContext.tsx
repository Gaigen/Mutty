import { createContext, useContext, useState, useCallback, type ReactNode } from 'react';
import type { TrackReferenceOrPlaceholder } from '@livekit/components-core';

interface ExpandedTrackContextValue {
  expandedTrack: TrackReferenceOrPlaceholder | null;
  setExpandedTrack: (track: TrackReferenceOrPlaceholder | null) => void;
  isExpanded: (track: TrackReferenceOrPlaceholder) => boolean;
  toggleExpanded: (track: TrackReferenceOrPlaceholder) => void;
}

const ExpandedTrackContext = createContext<ExpandedTrackContextValue | null>(null);

export function ExpandedTrackProvider({ children }: { children: ReactNode }) {
  const [expandedTrack, setExpandedTrack] = useState<TrackReferenceOrPlaceholder | null>(null);

  const isExpanded = useCallback(
    (track: TrackReferenceOrPlaceholder) => {
      if (!expandedTrack) return false;
      return (
        expandedTrack.participant.identity === track.participant.identity &&
        expandedTrack.source === track.source
      );
    },
    [expandedTrack],
  );

  const toggleExpanded = useCallback(
    (track: TrackReferenceOrPlaceholder) => {
      setExpandedTrack((prev) => {
        if (
          prev &&
          prev.participant.identity === track.participant.identity &&
          prev.source === track.source
        ) {
          return null;
        }
        return track;
      });
    },
    [],
  );

  return (
    <ExpandedTrackContext.Provider
      value={{ expandedTrack, setExpandedTrack, isExpanded, toggleExpanded }}
    >
      {children}
    </ExpandedTrackContext.Provider>
  );
}

export function useExpandedTrack() {
  const ctx = useContext(ExpandedTrackContext);
  if (!ctx) throw new Error('useExpandedTrack must be used within ExpandedTrackProvider');
  return ctx;
}

export function useMaybeExpandedTrack() {
  return useContext(ExpandedTrackContext);
}
