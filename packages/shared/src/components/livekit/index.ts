// Main room component
export { default as LiveKitRoomComponent } from './LiveKitRoom';

// Control bar & conference
export { CustomControlBar } from './CustomControlBar';
export type { CustomControlBarProps } from './CustomControlBar';
export { VideoConferenceWithVolume } from './VideoConferenceWithVolume';
export { CustomRoomAudioRenderer } from './CustomRoomAudioRenderer';

// Participant tiles
export { ParticipantTileWithActions } from './ParticipantTileWithActions';
export type { ParticipantTileWithActionsProps } from './ParticipantTileWithActions';

// Handlers (default exports)
export { default as AudioHandler } from './AudioHandler';
export { default as ScreenShareHandler } from './ScreenShareHandler';
export { default as SoundHandler } from './SoundHandler';

// Agent
export { default as AgentControls } from './AgentControls';

// Menu & UI
export { BurgerMenu, BurgerMenuItem, BurgerMenuDivider } from './BurgerMenu';
export { default as StreamSettings } from './StreamSettings';
export { InviteRoomButton } from './invite-room-button';
export { ParticipantVolumeMenu } from './participant-volume-menu';

// Chat
export { ChatWithAttachments } from './chat-with-attachments';
export type { ChatWithAttachmentsProps } from './chat-with-attachments';
