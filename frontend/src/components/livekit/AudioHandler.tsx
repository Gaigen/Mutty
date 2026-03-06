import { useRoomContext } from '@livekit/components-react';
import { Track, type LocalAudioTrack, type LocalTrackPublication } from 'livekit-client';
import { useCallback, useEffect, useRef } from 'react';
import { useUserChoicesContext } from '../../context/UserChoicesContext';
import { useAudioSettings } from '../../hooks/useAudioSettings';
import { createNoiseGateProcessor, type NoiseGateProcessorRef } from '../../utils/NoiseGateProcessor';

/**
 * Невидимый компонент-обработчик: применяет аудионастройки к LiveKit треку.
 * Живёт внутри <LiveKitRoom>, работает всё время — независимо от открытия панели настроек.
 */
export default function AudioHandler() {
  const room = useRoomContext();
  const { settings: audioSettings } = useAudioSettings();

  const noiseGateRef = useRef<NoiseGateProcessorRef>({
    node: null,
    options: {
      threshold: audioSettings.noiseGateThreshold,
      attack: audioSettings.noiseGateAttack,
      release: audioSettings.noiseGateRelease,
    },
  });

  const userChoices = useUserChoicesContext();

  const getMicTrack = useCallback((): LocalAudioTrack | null => {
    if (!room) return null;
    const pub = room.localParticipant.getTrackPublication(Track.Source.Microphone);
    const track = pub?.track;
    if (!track || track.kind !== Track.Kind.Audio) return null;
    return track as LocalAudioTrack;
  }, [room]);

  // ─── Microphone capture options ───────────────────────────────────────────

  const applyMicOptions = useCallback(async () => {
    const localTrack = getMicTrack();
    if (!localTrack) return;

    const wasMuted = localTrack.isMuted;
    // Приоритет: сохранённый выбор юзера > текущий трек > без constraint
    const preferredDeviceId =
      userChoices?.audioDeviceId && userChoices.audioDeviceId !== 'default'
        ? userChoices.audioDeviceId
        : localTrack.mediaStreamTrack?.getSettings().deviceId;

    userChoices?.skipNextAudioDeviceSave();

    try {
      if (wasMuted) await localTrack.unmute();
      await localTrack.restartTrack({
        noiseSuppression: audioSettings.noiseSuppression,
        echoCancellation: audioSettings.echoCancellation,
        autoGainControl: audioSettings.autoGainControl,
        voiceIsolation: audioSettings.voiceIsolation,
        ...(preferredDeviceId ? { deviceId: preferredDeviceId } : {}),
      });
      if (wasMuted) await localTrack.mute();
    } catch (e) {
      console.error('[AudioHandler] Failed to apply mic options:', e);
      if (wasMuted && !localTrack.isMuted) {
        try { await localTrack.mute(); } catch { /* ignore */ }
      }
    }
  }, [
    getMicTrack,
    userChoices,
    audioSettings.noiseSuppression,
    audioSettings.echoCancellation,
    audioSettings.autoGainControl,
    audioSettings.voiceIsolation,
  ]);

  // Применяем при изменении настроек и при появлении нового трека микрофона
  useEffect(() => {
    if (!room) return;
    applyMicOptions();
    const handlePublished = (pub: LocalTrackPublication) => {
      if (pub.source === Track.Source.Microphone && pub.track) {
        setTimeout(() => applyMicOptions(), 100);
      }
    };
    room.on('localTrackPublished', handlePublished);
    return () => { room.off('localTrackPublished', handlePublished); };
  }, [room, applyMicOptions]);

  // ─── Speaker device ────────────────────────────────────────────────────────

  const applySpeakerDevice = useCallback(() => {
    if (!room || !audioSettings.speakerDeviceId) return;
    try {
      room.switchActiveDevice('audiooutput', audioSettings.speakerDeviceId);
    } catch (e) {
      console.warn('[AudioHandler] Failed to apply speaker device:', e);
    }
  }, [room, audioSettings.speakerDeviceId]);

  // Ref нужен чтобы обращаться к актуальной функции из эффекта с [room]-deps
  const applySpeakerRef = useRef(applySpeakerDevice);
  applySpeakerRef.current = applySpeakerDevice;

  // Немедленно при смене устройства
  useEffect(() => {
    applySpeakerDevice();
  }, [applySpeakerDevice]);

  // С задержкой при подключении к комнате (AudioContext не готов мгновенно)
  useEffect(() => {
    if (!room) return;
    const timer = setTimeout(() => applySpeakerRef.current(), 500);
    return () => clearTimeout(timer);
  }, [room]);

  // ─── Noise Gate ────────────────────────────────────────────────────────────

  useEffect(() => {
    if (!room) return;

    async function applyNoiseGate(enabled: boolean) {
      const track = getMicTrack();
      if (!track) return;

      if (enabled) {
        if (track.getProcessor()) return;
        noiseGateRef.current.options = {
          threshold: audioSettings.noiseGateThreshold,
          attack: audioSettings.noiseGateAttack,
          release: audioSettings.noiseGateRelease,
        };
        try {
          await track.setProcessor(createNoiseGateProcessor(noiseGateRef.current));
        } catch (e) {
          console.error('[AudioHandler] NoiseGate set failed:', e);
        }
      } else {
        if (!track.getProcessor()) return;
        try {
          await track.stopProcessor();
          noiseGateRef.current.node = null;
        } catch (e) {
          console.error('[AudioHandler] NoiseGate stop failed:', e);
        }
      }
    }

    applyNoiseGate(audioSettings.noiseGateEnabled);

    const handlePublished = (pub: LocalTrackPublication) => {
      if (pub.source === Track.Source.Microphone && audioSettings.noiseGateEnabled) {
        setTimeout(() => applyNoiseGate(true), 150);
      }
    };
    room.on('localTrackPublished', handlePublished);
    return () => { room.off('localTrackPublished', handlePublished); };
  }, [room, audioSettings.noiseGateEnabled, getMicTrack]); // eslint-disable-line react-hooks/exhaustive-deps

  // Обновляем параметры noise gate без перезапуска процессора
  useEffect(() => {
    noiseGateRef.current.options = {
      threshold: audioSettings.noiseGateThreshold,
      attack: audioSettings.noiseGateAttack,
      release: audioSettings.noiseGateRelease,
    };
    if (noiseGateRef.current.node) {
      noiseGateRef.current.node.port.postMessage({
        threshold: Math.pow(10, audioSettings.noiseGateThreshold / 20),
        attackMs: audioSettings.noiseGateAttack,
        releaseMs: audioSettings.noiseGateRelease,
      });
    }
  }, [audioSettings.noiseGateThreshold, audioSettings.noiseGateAttack, audioSettings.noiseGateRelease]);

  return null;
}
