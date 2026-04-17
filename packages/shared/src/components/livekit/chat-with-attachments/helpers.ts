// LiveKit chat message size limit (~15KB default DataPacket)
const MAX_CHAT_IMAGE_BYTES = 14000;

/**
 * Compress and resize image to fit within chat message size limit.
 */
function compressImage(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(file);

    img.onload = () => {
      URL.revokeObjectURL(url);

      let { width, height } = img;
      const maxDim = 800;

      // Resize if too large
      if (width > maxDim || height > maxDim) {
        if (width > height) {
          height = Math.round((height / width) * maxDim);
          width = maxDim;
        } else {
          width = Math.round((width / height) * maxDim);
          height = maxDim;
        }
      }

      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d');
      if (!ctx) return reject(new Error('Canvas not available'));
      ctx.drawImage(img, 0, 0, width, height);

      // Try JPEG at decreasing quality until under limit
      let quality = 0.8;
      let result = canvas.toDataURL('image/jpeg', quality);

      while (result.length > MAX_CHAT_IMAGE_BYTES && quality > 0.1) {
        quality -= 0.1;
        result = canvas.toDataURL('image/jpeg', quality);
      }

      if (result.length > MAX_CHAT_IMAGE_BYTES) {
        // Final attempt: smaller dimensions
        canvas.width = Math.round(width * 0.5);
        canvas.height = Math.round(height * 0.5);
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        result = canvas.toDataURL('image/jpeg', 0.5);
      }

      resolve(result);
    };

    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('Failed to load image'));
    };

    img.src = url;
  });
}

export async function fileToDataUrl(file: File): Promise<string> {
  // Only compress images; pass other files through as-is
  if (file.type.startsWith('image/')) {
    return compressImage(file);
  }
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}
