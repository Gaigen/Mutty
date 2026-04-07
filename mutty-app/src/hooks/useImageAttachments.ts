import * as React from 'react';
import { useChat } from '@livekit/components-react';
import { ACCEPT_IMAGES, MAX_IMAGE_BYTES, MAX_TEXT_LEN } from '../components/livekit/chat-with-attachments/constants';
import { fileToDataUrl } from '../components/livekit/chat-with-attachments/helpers';

/**
 * Manages image attachments: drag & drop, paste, file picker, validation, sending.
 */
export function useImageAttachments(enableAttachments: boolean) {
  const { send, isSending } = useChat();
  const fileInputRef = React.useRef<HTMLInputElement>(null);
  const [pendingFiles, setPendingFiles] = React.useState<File[]>([]);
  const [isSendingImages, setIsSendingImages] = React.useState(false);
  const [sentCount, setSentCount] = React.useState(0);
  const [isDragOver, setIsDragOver] = React.useState(false);
  const [textValue, setTextValue] = React.useState('');

  const addImageFiles = React.useCallback((files: File[]) => {
    const valid: File[] = [];
    for (const f of files) {
      if (!f.type.startsWith('image/')) continue;
      if (f.size > MAX_IMAGE_BYTES) {
        alert(`File "${f.name}" is too large. Maximum ${Math.round(MAX_IMAGE_BYTES / 1024 / 1024)} MB.`);
        continue;
      }
      valid.push(f);
    }
    if (valid.length > 0) setPendingFiles((prev) => [...prev, ...valid]);
  }, []);

  const onFileChange = React.useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      addImageFiles(Array.from(e.target.files ?? []));
      e.target.value = '';
    },
    [addImageFiles],
  );

  const removePending = React.useCallback(
    (idx: number) => setPendingFiles((prev) => prev.filter((_, i) => i !== idx)),
    [],
  );

  const handleDragEnter = React.useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.dataTransfer.types.includes('Files') && enableAttachments) setIsDragOver(true);
  }, [enableAttachments]);

  const handleDragOver = React.useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    e.dataTransfer.dropEffect = 'copy';
    if (e.dataTransfer.types.includes('Files') && enableAttachments) setIsDragOver(true);
  }, [enableAttachments]);

  const handleDragLeave = React.useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (!e.currentTarget.contains(e.relatedTarget as Node | null)) {
      setIsDragOver(false);
    }
  }, []);

  const handleDrop = React.useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      setIsDragOver(false);
      if (enableAttachments) addImageFiles(Array.from(e.dataTransfer.files));
    },
    [enableAttachments, addImageFiles],
  );

  const handlePaste = React.useCallback(
    (e: React.ClipboardEvent) => {
      const items = e.clipboardData?.items;
      if (!items) return;
      const imageFiles: File[] = [];
      for (const item of Array.from(items)) {
        if (item.type.startsWith('image/')) {
          const file = item.getAsFile();
          if (file) imageFiles.push(file);
        }
      }
      if (imageFiles.length > 0 && enableAttachments) {
        e.preventDefault();
        addImageFiles(imageFiles);
      }
    },
    [enableAttachments, addImageFiles],
  );

  const handleSubmit = React.useCallback(
    async (e?: React.FormEvent) => {
      e?.preventDefault();
      const text = textValue.trim();
      const files = [...pendingFiles];
      if (!text && files.length === 0) return;
      if (text.length > MAX_TEXT_LEN) return;

      try {
        setIsSendingImages(files.length > 0);
        setSentCount(0);
        if (text) await send(text);
        for (let i = 0; i < files.length; i++) {
          await send(await fileToDataUrl(files[i]));
          setSentCount(i + 1);
        }
        setTextValue('');
        setPendingFiles([]);
        if (fileInputRef.current) fileInputRef.current.value = '';
      } catch (err) {
        console.error('[Chat] Send failed:', err);
      } finally {
        setIsSendingImages(false);
        setSentCount(0);
      }
    },
    [send, pendingFiles, textValue],
  );

  const busy = isSending || isSendingImages;
  const overLimit = textValue.length > MAX_TEXT_LEN;
  const nearLimit = textValue.length > MAX_TEXT_LEN * 0.85;

  return {
    fileInputRef,
    textValue,
    setTextValue,
    pendingFiles,
    isSendingImages,
    sentCount,
    isDragOver,
    setIsDragOver,
    busy,
    overLimit,
    nearLimit,
    enableAttachments,
    ACCEPT_IMAGES,
    onFileChange,
    removePending,
    handleDragEnter,
    handleDragOver,
    handleDragLeave,
    handleDrop,
    handlePaste,
    handleSubmit,
  };
}
