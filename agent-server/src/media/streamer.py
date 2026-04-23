"""Audio / Video streaming via ffmpeg into LiveKit tracks."""

import asyncio
import logging
import os
from typing import Optional

from livekit import rtc

from ..config import (
    AUDIO_CHANNELS,
    AUDIO_SAMPLE_RATE,
    AUDIO_SAMPLES_PER_FRAME,
    DEFAULT_QUALITY,
    QUALITY_PRESETS,
    VIDEO_FPS,
    subprocess_env_for_media,
)

logger = logging.getLogger(__name__)


class MediaStreamer:
    def __init__(self, room: rtc.Room) -> None:
        self._room = room
        self._quality: str = DEFAULT_QUALITY

        self._audio_source: Optional[rtc.AudioSource] = None
        self._video_source: Optional[rtc.VideoSource] = None
        self._audio_sid: Optional[str] = None
        self._video_sid: Optional[str] = None
        self._audio_published = False
        self._video_published = False

        self._audio_task: Optional[asyncio.Task] = None
        self._video_task: Optional[asyncio.Task] = None
        self._ffmpeg_audio: Optional[asyncio.subprocess.Process] = None
        self._ffmpeg_video: Optional[asyncio.subprocess.Process] = None
        self._ffmpeg_av: Optional[asyncio.subprocess.Process] = None

    # ── Configuration ───────────────────────────────────────────────────────
    def set_quality(self, quality: str) -> None:
        if quality in QUALITY_PRESETS:
            self._quality = quality

    @property
    def quality(self) -> str:
        return self._quality

    def _dimensions(self) -> tuple[int, int]:
        return QUALITY_PRESETS.get(self._quality, QUALITY_PRESETS["720p"])

    # ── Track publishing ────────────────────────────────────────────────────
    async def ensure_audio(self) -> None:
        if self._audio_published:
            return
        self._audio_source = rtc.AudioSource(AUDIO_SAMPLE_RATE, AUDIO_CHANNELS)
        track = rtc.LocalAudioTrack.create_audio_track("yt-audio", self._audio_source)
        pub = await self._room.local_participant.publish_track(
            track,
            rtc.TrackPublishOptions(source=rtc.TrackSource.SOURCE_MICROPHONE),
        )
        self._audio_sid = pub.sid
        self._audio_published = True
        logger.info("[Streamer] Audio track published")

    async def ensure_video(self) -> None:
        if self._video_published:
            return
        w, h = self._dimensions()
        self._video_source = rtc.VideoSource(w, h)
        track = rtc.LocalVideoTrack.create_video_track("yt-video", self._video_source)
        pub = await self._room.local_participant.publish_track(
            track,
            rtc.TrackPublishOptions(source=rtc.TrackSource.SOURCE_CAMERA),
        )
        self._video_sid = pub.sid
        self._video_published = True
        logger.info("[Streamer] Video track published")

    async def unpublish_video(self) -> None:
        if self._video_published and self._video_sid:
            try:
                await self._room.local_participant.unpublish_track(self._video_sid)
            except Exception as e:
                logger.warning("[Streamer] Failed to unpublish video: %s", e)
            self._video_published = False
            self._video_source = None
            self._video_sid = None

    async def unpublish_audio(self) -> None:
        if self._audio_published and self._audio_sid:
            try:
                await self._room.local_participant.unpublish_track(self._audio_sid)
            except Exception as e:
                logger.warning("[Streamer] Failed to unpublish audio: %s", e)
            self._audio_published = False
            self._audio_source = None
            self._audio_sid = None

    @property
    def audio_task(self) -> Optional[asyncio.Task]:
        return self._audio_task

    @property
    def video_task(self) -> Optional[asyncio.Task]:
        return self._video_task

    # ── Playback control ────────────────────────────────────────────────────
    async def stop(self) -> None:
        """Kill ffmpeg and cancel tasks; keep tracks published (or caller unpublishes)."""
        for task in (self._audio_task, self._video_task):
            if task and not task.done():
                task.cancel()
                try:
                    await task
                except asyncio.CancelledError:
                    pass

        for proc in (self._ffmpeg_audio, self._ffmpeg_video, self._ffmpeg_av):
            if proc and proc.returncode is None:
                try:
                    proc.kill()
                    await proc.wait()
                except Exception:
                    pass

        self._audio_task = self._video_task = None
        self._ffmpeg_audio = self._ffmpeg_video = self._ffmpeg_av = None

    # ── Streaming entrypoints ───────────────────────────────────────────────
    async def start_audio_only(self, url: str, seek_seconds: float = 0.0) -> None:
        await self.ensure_audio()
        self._audio_task = asyncio.create_task(self._stream_audio(url, seek_seconds))

    async def start_av_separate(self, video_url: str, audio_url: str, seek_seconds: float = 0.0) -> None:
        await self.ensure_audio()
        await self.ensure_video()
        self._audio_task = asyncio.create_task(self._stream_audio(audio_url, seek_seconds))
        self._video_task = asyncio.create_task(self._stream_video(video_url, seek_seconds))

    async def start_av_combined(self, video_url: str, audio_url: str, seek_seconds: float = 0.0) -> None:
        await self.ensure_audio()
        await self.ensure_video()
        self._audio_task = asyncio.create_task(
            self._stream_av_combined(video_url, audio_url, seek_seconds)
        )

    # ── ffmpeg pipelines ────────────────────────────────────────────────────
    @staticmethod
    def _seek_args(seek_seconds: float) -> list[str]:
        return ["-ss", str(seek_seconds)] if seek_seconds > 0 else []

    async def _stream_audio(self, url: str, seek_seconds: float = 0.0) -> None:
        bytes_per_frame = AUDIO_SAMPLES_PER_FRAME * AUDIO_CHANNELS * 2
        seek = self._seek_args(seek_seconds)
        cmd = [
            "ffmpeg",
            "-reconnect", "1", "-reconnect_streamed", "1", "-reconnect_delay_max", "5",
            *seek, "-re", "-i", url, "-vn",
            "-acodec", "pcm_s16le",
            "-ar", str(AUDIO_SAMPLE_RATE),
            "-ac", str(AUDIO_CHANNELS),
            "-f", "s16le", "-loglevel", "quiet",
            "pipe:1",
        ]
        self._ffmpeg_audio = await asyncio.create_subprocess_exec(
            *cmd,
            stdout=asyncio.subprocess.PIPE,
            stderr=asyncio.subprocess.DEVNULL,
            env=subprocess_env_for_media(),
        )
        assert self._ffmpeg_audio.stdout
        assert self._audio_source

        try:
            while True:
                raw = await self._ffmpeg_audio.stdout.readexactly(bytes_per_frame)
                await self._audio_source.capture_frame(
                    rtc.AudioFrame(
                        data=raw,
                        sample_rate=AUDIO_SAMPLE_RATE,
                        num_channels=AUDIO_CHANNELS,
                        samples_per_channel=AUDIO_SAMPLES_PER_FRAME,
                    )
                )
        except asyncio.IncompleteReadError:
            logger.info("[Streamer] Audio stream finished")
        except asyncio.CancelledError:
            pass
        except Exception:
            logger.exception("[Streamer] Audio stream error")

    async def _stream_video(self, url: str, seek_seconds: float = 0.0) -> None:
        w, h = self._dimensions()
        frame_bytes = w * h * 3 // 2
        vf = (
            f"scale={w}:{h}:force_original_aspect_ratio=decrease:flags=lanczos,"
            f"pad={w}:{h}:(ow-iw)/2:(oh-ih)/2:color=black,fps={VIDEO_FPS}"
        )
        seek = self._seek_args(seek_seconds)
        cmd = [
            "ffmpeg",
            "-reconnect", "1", "-reconnect_streamed", "1", "-reconnect_delay_max", "5",
            *seek, "-re", "-i", url, "-an",
            "-vf", vf,
            "-pix_fmt", "yuv420p",
            "-f", "rawvideo", "-loglevel", "quiet",
            "pipe:1",
        ]
        self._ffmpeg_video = await asyncio.create_subprocess_exec(
            *cmd,
            stdout=asyncio.subprocess.PIPE,
            stderr=asyncio.subprocess.DEVNULL,
            env=subprocess_env_for_media(),
        )
        assert self._ffmpeg_video.stdout
        assert self._video_source

        try:
            while True:
                raw = await self._ffmpeg_video.stdout.readexactly(frame_bytes)
                self._video_source.capture_frame(
                    rtc.VideoFrame(
                        width=w,
                        height=h,
                        type=rtc.VideoBufferType.I420,
                        data=bytearray(raw),
                    )
                )
        except asyncio.IncompleteReadError:
            logger.info("[Streamer] Video stream finished")
        except asyncio.CancelledError:
            pass
        except Exception:
            logger.exception("[Streamer] Video stream error")

    async def _stream_av_combined(
        self, video_url: str, audio_url: str, seek_seconds: float = 0.0
    ) -> None:
        w, h = self._dimensions()
        frame_bytes = w * h * 3 // 2
        bytes_per_frame = AUDIO_SAMPLES_PER_FRAME * AUDIO_CHANNELS * 2

        vf = (
            f"scale={w}:{h}:force_original_aspect_ratio=decrease:flags=lanczos,"
            f"pad={w}:{h}:(ow-iw)/2:(oh-ih)/2:color=black,fps={VIDEO_FPS}"
        )
        r_video, w_video = os.pipe()
        reconnect = ["-reconnect", "1", "-reconnect_streamed", "1", "-reconnect_delay_max", "5"]
        seek = self._seek_args(seek_seconds)
        env = subprocess_env_for_media()

        try:
            if video_url == audio_url:
                cmd = [
                    "ffmpeg", "-loglevel", "quiet",
                    *reconnect, *seek, "-re", "-i", video_url,
                    "-map", "0:a", "-acodec", "pcm_s16le",
                    "-ar", str(AUDIO_SAMPLE_RATE), "-ac", str(AUDIO_CHANNELS),
                    "-f", "s16le", "pipe:1",
                    "-map", "0:v", "-vf", vf, "-pix_fmt", "yuv420p",
                    "-f", "rawvideo", f"pipe:{w_video}",
                ]
            else:
                cmd = [
                    "ffmpeg", "-loglevel", "quiet",
                    *reconnect, *seek, "-re", "-i", video_url,
                    *reconnect, *seek, "-re", "-i", audio_url,
                    "-map", "1:a", "-acodec", "pcm_s16le",
                    "-ar", str(AUDIO_SAMPLE_RATE), "-ac", str(AUDIO_CHANNELS),
                    "-f", "s16le", "pipe:1",
                    "-map", "0:v", "-vf", vf, "-pix_fmt", "yuv420p",
                    "-f", "rawvideo", f"pipe:{w_video}",
                ]
            self._ffmpeg_av = await asyncio.create_subprocess_exec(
                *cmd,
                stdout=asyncio.subprocess.PIPE,
                stderr=asyncio.subprocess.DEVNULL,
                pass_fds=(w_video,),
                env=env,
            )
        finally:
            os.close(w_video)

        assert self._ffmpeg_av.stdout
        assert self._audio_source and self._video_source

        async def read_audio() -> None:
            try:
                while True:
                    raw = await self._ffmpeg_av.stdout.readexactly(bytes_per_frame)
                    await self._audio_source.capture_frame(
                        rtc.AudioFrame(
                            data=raw,
                            sample_rate=AUDIO_SAMPLE_RATE,
                            num_channels=AUDIO_CHANNELS,
                            samples_per_channel=AUDIO_SAMPLES_PER_FRAME,
                        )
                    )
            except asyncio.IncompleteReadError:
                pass
            except asyncio.CancelledError:
                pass

        async def read_video() -> None:
            def read_exactly() -> bytes:
                data = b""
                while len(data) < frame_bytes:
                    chunk = os.read(r_video, frame_bytes - len(data))
                    if not chunk:
                        raise asyncio.IncompleteReadError(data, frame_bytes)
                    data += chunk
                return data

            try:
                while True:
                    raw = await asyncio.to_thread(read_exactly)
                    self._video_source.capture_frame(
                        rtc.VideoFrame(
                            width=w,
                            height=h,
                            type=rtc.VideoBufferType.I420,
                            data=bytearray(raw),
                        )
                    )
            except (asyncio.IncompleteReadError, OSError):
                pass
            except asyncio.CancelledError:
                pass

        cancelled = False
        try:
            await asyncio.gather(
                asyncio.create_task(read_audio()),
                asyncio.create_task(read_video()),
            )
        except asyncio.CancelledError:
            cancelled = True
        except Exception:
            logger.exception("[Streamer] A/V stream error")
        finally:
            try:
                os.close(r_video)
            except OSError:
                pass
            logger.info("[Streamer] A/V stream finished")
            if not cancelled:
                # Signal end-of-stream to caller (optional via callback)
                pass
