// Shrinks a photo in the browser before upload. A 5 MB phone photo becomes roughly 150 to 400 KB,
// which keeps uploads fast on mobile data and keeps the database small.
const MAX_SIDE = 1280;
const MAX_BYTES = 1_400_000; // server limit is 1.5 MB

const toBlob = (canvas, quality) => new Promise((resolve) => canvas.toBlob(resolve, 'image/jpeg', quality));

export async function compressImage(file) {
  if (!file.type.startsWith('image/')) throw new Error('Choose an image file (JPG or PNG).');
  if (file.size > 25 * 1024 * 1024) throw new Error('That photo is too large. Choose one under 25 MB.');

  let bitmap;
  try {
    bitmap = await createImageBitmap(file); // also applies the phone's rotation
  } catch {
    throw new Error('We could not read that image. Try a JPG or PNG.');
  }

  const scale = Math.min(1, MAX_SIDE / Math.max(bitmap.width, bitmap.height));
  const width = Math.max(1, Math.round(bitmap.width * scale));
  const height = Math.max(1, Math.round(bitmap.height * scale));

  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#ffffff'; // transparent PNGs become white instead of black
  ctx.fillRect(0, 0, width, height);
  ctx.drawImage(bitmap, 0, 0, width, height);
  bitmap.close?.();

  let blob = await toBlob(canvas, 0.82);
  if (blob && blob.size > MAX_BYTES) blob = await toBlob(canvas, 0.6);
  if (!blob || blob.size > MAX_BYTES) throw new Error('That photo is still too large after shrinking. Try another one.');
  return blob;
}
