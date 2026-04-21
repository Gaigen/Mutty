import * as React from 'react';

interface UsePictureInPictureReturn {
  isPiP: boolean;
  isSupported: boolean;
  toggle: () => Promise<void>;
  enter: (videoEl?: HTMLVideoElement) => Promise<void>;
  exit: () => Promise<void>;
}

export function usePictureInPicture(): UsePictureInPictureReturn {
  const [isPiP, setIsPiP] = React.useState(false);
  const isSupported = typeof document !== 'undefined' && 'pictureInPictureEnabled' in document;

  React.useEffect(() => {
    if (!isSupported) return;

    const onEnter = () => setIsPiP(true);
    const onLeave = () => setIsPiP(false);

    document.addEventListener('enterpictureinpicture', onEnter);
    document.addEventListener('leavepictureinpicture', onLeave);
    return () => {
      document.removeEventListener('enterpictureinpicture', onEnter);
      document.removeEventListener('leavepictureinpicture', onLeave);
    };
  }, [isSupported]);

  const findActiveVideo = React.useCallback((): HTMLVideoElement | null => {
    // Find the first playing video element (participant tiles)
    const videos = document.querySelectorAll<HTMLVideoElement>('video');
    for (const video of videos) {
      if (video.srcObject && video.readyState >= 2 && !video.paused) {
        return video;
      }
    }
    return null;
  }, []);

  const enter = React.useCallback(async (videoEl?: HTMLVideoElement) => {
    if (!isSupported) return;
    const video = videoEl || findActiveVideo();
    if (!video) return;

    try {
      // Disable PiP on current if any, then enter new
      if (document.pictureInPictureElement) {
        await document.exitPictureInPicture();
      }
      await video.requestPictureInPicture();
    } catch (err) {
      console.warn('[PiP] Failed to enter:', err);
    }
  }, [isSupported, findActiveVideo]);

  const exit = React.useCallback(async () => {
    if (!isSupported) return;
    try {
      if (document.pictureInPictureElement) {
        await document.exitPictureInPicture();
      }
    } catch (err) {
      console.warn('[PiP] Failed to exit:', err);
    }
  }, [isSupported]);

  const toggle = React.useCallback(async () => {
    if (document.pictureInPictureElement) {
      await exit();
    } else {
      await enter();
    }
  }, [enter, exit]);

  return { isPiP, isSupported, toggle, enter, exit };
}
