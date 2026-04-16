/**
 * VideoConference с поддержкой outputVolume для RoomAudioRenderer.
 * Иначе громкость из настроек не применяется к спикерам.
 */
import {
  CarouselLayout,
  ConnectionStateToast,
  FocusLayoutContainer,
  GridLayout,
  LayoutContextProvider,
  useCreateLayoutContext,
  usePinnedTracks,
  useTracks,
} from '@livekit/components-react';
import { ParticipantTileWithActions } from './ParticipantTileWithActions';
import { ChatWithAttachments } from './ChatWithAttachments';
import { isEqualTrackRef, isTrackReference, isWeb, type TrackReferenceOrPlaceholder } from '@livekit/components-core';
import { RoomEvent, Track } from 'livekit-client';
import * as React from 'react';
import { appConfig, LS_KEYS } from '../../config';
import { usePlatform } from '../../platform';

const CONTROL_BAR_CONTROLS = {
  chat: appConfig.showChat,
  leave: appConfig.showLeave,
} as const;
import { CustomControlBar } from './CustomControlBar';

const MemoizedControlBar = React.memo(CustomControlBar, (prev, next) => {
  if (prev.rightControls !== next.rightControls) return false;
  const pc = prev.controls ?? {};
  const nc = next.controls ?? {};
  return (
    (pc.chat === nc.chat || (pc.chat === undefined && nc.chat === undefined)) &&
    (pc.leave === nc.leave || (pc.leave === undefined && nc.leave === undefined)) &&
    (pc.microphone === nc.microphone || (pc.microphone === undefined && nc.microphone === undefined)) &&
    (pc.camera === nc.camera || (pc.camera === undefined && nc.camera === undefined)) &&
    (pc.screenShare === nc.screenShare || (pc.screenShare === undefined && nc.screenShare === undefined))
  );
});
import { CustomRoomAudioRenderer } from './CustomRoomAudioRenderer';

const CHAT_WIDTH_MIN = 280;
const CHAT_WIDTH_MAX = 720;
const CHAT_WIDTH_DEFAULT = 380;

interface ChatPanelProps {
  chatWidth: number;
  enableAttachments: boolean;
  onClose?: () => void;
}

const MemoizedChatPanel = React.memo(function ChatPanel({
  chatWidth,
  enableAttachments,
  onClose,
}: ChatPanelProps) {
  const style = React.useMemo(
    () => ({
      display: 'grid' as const,
      width: chatWidth,
      minWidth: chatWidth,
      maxWidth: chatWidth,
      flexShrink: 0,
    }),
    [chatWidth],
  );

  return (
    <>
      <ChatWithAttachments
        className="lk-chat lk-chat-panel"
        style={style}
        enableAttachments={enableAttachments}
        onClose={onClose}
      />
    </>
  );
});

interface VideoConferenceWithVolumeProps extends React.HTMLAttributes<HTMLDivElement> {
  outputVolume?: number;
  rightControls?: React.ReactNode;
}

export function VideoConferenceWithVolume({
  outputVolume = 1,
  rightControls,
  ...props
}: VideoConferenceWithVolumeProps) {
  const { storage } = usePlatform();

  const [widgetState, setWidgetState] = React.useState({
    showChat: false,
    unreadMessages: 0,
    showSettings: false,
  });
  const [chatWidth, setChatWidth] = React.useState(CHAT_WIDTH_DEFAULT);
  const [isResizing, setIsResizing] = React.useState(false);
  const chatWidthRef = React.useRef(chatWidth);
  chatWidthRef.current = chatWidth;
  const lastAutoFocusedScreenShareTrack = React.useRef<TrackReferenceOrPlaceholder | null>(null);

  // Load chat width from storage on mount
  React.useEffect(() => {
    (async () => {
      try {
        const v = await storage.getAsync<string>(LS_KEYS.chatWidth);
        if (v) {
          const n = parseInt(v, 10);
          if (Number.isFinite(n) && n >= CHAT_WIDTH_MIN && n <= CHAT_WIDTH_MAX) {
            setChatWidth(n);
          }
        }
      } catch {
        /* ignore */
      }
    })();
  }, [storage]);

  const saveChatWidth = React.useCallback((w: number) => {
    try {
      storage.set(LS_KEYS.chatWidth, String(Math.round(w)));
    } catch {
      /* ignore */
    }
  }, [storage]);

  const handleResizeStart = React.useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    const startX = e.clientX;
    const startW = chatWidthRef.current;
    setIsResizing(true);

    const onMove = (ev: MouseEvent) => {
      const delta = startX - ev.clientX;
      const next = Math.max(CHAT_WIDTH_MIN, Math.min(CHAT_WIDTH_MAX, startW + delta));
      setChatWidth(next);
    };
    const onUp = () => {
      saveChatWidth(chatWidthRef.current);
      document.removeEventListener('mousemove', onMove);
      document.removeEventListener('mouseup', onUp);
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
      setIsResizing(false);
    };

    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onUp);
    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';
  }, [saveChatWidth]);

  const tracks = useTracks(
    [
      { source: Track.Source.Camera, withPlaceholder: true },
      { source: Track.Source.ScreenShare, withPlaceholder: false },
    ],
    {
      onlySubscribed: false,
      updateOnlyOn: [
        RoomEvent.ParticipantConnected,
        RoomEvent.ParticipantDisconnected,
        RoomEvent.TrackPublished,
        RoomEvent.TrackUnpublished,
        RoomEvent.TrackSubscribed,
        RoomEvent.TrackUnsubscribed,
        RoomEvent.LocalTrackPublished,
        RoomEvent.LocalTrackUnpublished,
        RoomEvent.TrackSubscriptionStatusChanged,
      ],
    },
  );

  const widgetUpdate = React.useCallback((state: Partial<typeof widgetState>) => {
    setWidgetState((s) => ({ ...s, ...state }));
  }, []);

  const layoutContext = useCreateLayoutContext();

  const screenShareTracks = tracks
    .filter(isTrackReference)
    .filter((track) => track.publication.source === Track.Source.ScreenShare);

  const focusTrack = usePinnedTracks(layoutContext)?.[0];
  const carouselTracks = tracks.filter((track) => !isEqualTrackRef(track, focusTrack));

  React.useEffect(() => {
    if (
      screenShareTracks.some((track) => track.publication.isSubscribed) &&
      lastAutoFocusedScreenShareTrack.current === null
    ) {
      layoutContext.pin.dispatch?.({ msg: 'set_pin', trackReference: screenShareTracks[0] });
      lastAutoFocusedScreenShareTrack.current = screenShareTracks[0];
    } else if (
      lastAutoFocusedScreenShareTrack.current &&
      !screenShareTracks.some(
        (track) =>
          track.publication.trackSid === lastAutoFocusedScreenShareTrack.current?.publication?.trackSid,
      )
    ) {
      layoutContext.pin.dispatch?.({ msg: 'clear_pin' });
      lastAutoFocusedScreenShareTrack.current = null;
    }
    if (focusTrack && !isTrackReference(focusTrack)) {
      const updatedFocusTrack = tracks.find(
        (tr) =>
          tr.participant.identity === focusTrack.participant.identity && tr.source === focusTrack.source,
      );
      if (updatedFocusTrack !== focusTrack && isTrackReference(updatedFocusTrack)) {
        layoutContext.pin.dispatch?.({ msg: 'set_pin', trackReference: updatedFocusTrack });
      }
    }
  }, [
    screenShareTracks.map((ref) => `${ref.publication.trackSid}_${ref.publication.isSubscribed}`).join(),
    focusTrack?.publication?.trackSid,
    tracks,
  ]);

  return (
    <div className="lk-video-conference" {...props}>
      {isWeb() && (
        <LayoutContextProvider value={layoutContext} onWidgetChange={widgetUpdate}>
          <div className="lk-video-conference-inner" style={{ flex: 1, minWidth: 0 }}>
            {!focusTrack ? (
              <div className="lk-grid-layout-wrapper">
                <GridLayout tracks={tracks}>
                  <ParticipantTileWithActions />
                </GridLayout>
              </div>
            ) : (
              <div className="lk-focus-layout-wrapper">
                <FocusLayoutContainer>
                  <CarouselLayout tracks={carouselTracks}>
                    <ParticipantTileWithActions />
                  </CarouselLayout>
                  {focusTrack && <ParticipantTileWithActions trackRef={focusTrack} />}
                </FocusLayoutContainer>
              </div>
            )}
            <MemoizedControlBar controls={CONTROL_BAR_CONTROLS} rightControls={rightControls} />
          </div>
          <div
            className="chat-resizer"
            onMouseDown={handleResizeStart}
            role="separator"
            aria-orientation="vertical"
            aria-valuenow={chatWidth}
            aria-valuemin={CHAT_WIDTH_MIN}
            aria-valuemax={CHAT_WIDTH_MAX}
            style={{ display: widgetState.showChat ? 'block' : 'none' }}
          />
          <div
            className="chat-panel-wrapper"
            data-open={widgetState.showChat}
            data-resizing={isResizing}
            style={{
              display: 'flex',
              width: widgetState.showChat ? chatWidth : 0,
              minWidth: widgetState.showChat ? chatWidth : 0,
              maxWidth: widgetState.showChat ? chatWidth : 0,
              opacity: widgetState.showChat ? 1 : 0,
              overflow: 'hidden',
              pointerEvents: widgetState.showChat ? 'auto' : 'none',
              flexShrink: 0,
              height: '100%',
            }}
          >
            <MemoizedChatPanel
              chatWidth={chatWidth}
              enableAttachments={appConfig.showChatAttachments}
              onClose={() => layoutContext.widget.dispatch?.({ msg: 'hide_chat' })}
            />
          </div>
        </LayoutContextProvider>
      )}
      {/* Per-participant volume */}
      <CustomRoomAudioRenderer outputVolume={outputVolume} />
      <ConnectionStateToast />
    </div>
  );
}
