// Uploaded files are identified by their first bytes, never by the Content-Type
// the browser sent, which anyone can set to anything.
export const FILE_SIGNATURES: { contentType: string; matches: (data: Buffer) => boolean }[] = [
  { contentType: "image/jpeg", matches: (d) => d[0] === 0xff && d[1] === 0xd8 && d[2] === 0xff },
  { contentType: "image/png", matches: (d) => d.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) },
  { contentType: "image/webp", matches: (d) => d.toString("ascii", 0, 4) === "RIFF" && d.toString("ascii", 8, 12) === "WEBP" },
  { contentType: "application/pdf", matches: (d) => d.toString("ascii", 0, 5) === "%PDF-" },
];

export const FILE_CONTENT_TYPES = FILE_SIGNATURES.map((signature) => signature.contentType);

export function detectContentType(data: Buffer) {
  return FILE_SIGNATURES.find((signature) => signature.matches(data))?.contentType;
}
