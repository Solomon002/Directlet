// Phone cameras produce 4 to 8 MB pictures, which is far more than a listing needs and
// more than the server accepts (3 MB). A big picture is shrunk before it is sent. A
// small one is sent untouched, so the exact same file is still recognised if someone
// else tries to use it on their listing.
const SEND_AS_IS_BYTES = 1.5 * 1024 * 1024;
const MAX_SIDE = 1800;

export const ACCEPTED_PHOTO_TYPES = ["image/jpeg", "image/png", "image/webp"];

export async function preparePhoto(file: File): Promise<Blob> {
  if (file.size <= SEND_AS_IS_BYTES) return file;

  try {
    const bitmap = await createImageBitmap(file);
    const scale = Math.min(1, MAX_SIDE / Math.max(bitmap.width, bitmap.height));
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(bitmap.width * scale);
    canvas.height = Math.round(bitmap.height * scale);
    canvas.getContext("2d")?.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    bitmap.close();

    const smaller = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/jpeg", 0.85));
    // Keep the shrunken one only if it really is smaller.
    return smaller && smaller.size < file.size ? smaller : file;
  } catch {
    // A format the browser cannot decode: send it as it is and let the server decide.
    return file;
  }
}
