import { useEffect, useState, type ChangeEvent } from "react";
import {
  deletePhoto,
  listPhotos,
  makeCoverPhoto,
  uploadPhoto,
  type PropertyPhoto,
  type Unit,
} from "../properties/api";
import { photoUrl } from "../public/api";
import { parseApiError } from "../../lib/errors";
import { ACCEPTED_PHOTO_TYPES, preparePhoto } from "./resizeImage";

const MAX_PHOTOS = 12;

// The landlord's side: add pictures of the property or of one flat, choose the cover,
// remove any. Listings with real pictures are trusted far more than ones without.
export default function PhotoManager({ propertyId, units }: { propertyId: string; units: Unit[] }) {
  const [photos, setPhotos] = useState<PropertyPhoto[]>([]);
  const [loading, setLoading] = useState(true);
  const [target, setTarget] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  const [notes, setNotes] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);

  async function load() {
    try {
      setPhotos(await listPhotos(propertyId));
    } catch (err) {
      setError(parseApiError(err).message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
  }, [propertyId]);

  const flatName = (unitId: string | null) => units.find((unit) => unit.id === unitId)?.label ?? null;

  async function handleFiles(e: ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? []);
    e.target.value = "";
    if (files.length === 0) return;

    setError(null);
    const problems: string[] = [];
    let room = MAX_PHOTOS - photos.length;

    setBusy("Uploading...");
    for (const file of files) {
      if (!ACCEPTED_PHOTO_TYPES.includes(file.type)) {
        problems.push(`${file.name}: use a JPG, PNG or WebP picture.`);
        continue;
      }
      if (room <= 0) {
        problems.push(`${file.name}: a property can have ${MAX_PHOTOS} photos at most.`);
        continue;
      }
      try {
        await uploadPhoto(propertyId, await preparePhoto(file), target || undefined);
        room -= 1;
      } catch (err) {
        problems.push(`${file.name}: ${parseApiError(err).message}`);
      }
    }
    setNotes(problems);
    setBusy(null);
    await load();
  }

  async function handleCover(photo: PropertyPhoto) {
    setBusy(photo.id);
    setError(null);
    try {
      await makeCoverPhoto(propertyId, photo.id);
      await load();
    } catch (err) {
      setError(parseApiError(err).message);
    } finally {
      setBusy(null);
    }
  }

  async function handleRemove(photo: PropertyPhoto) {
    if (!window.confirm("Remove this photo?")) return;
    setBusy(photo.id);
    setError(null);
    try {
      await deletePhoto(propertyId, photo.id);
      await load();
    } catch (err) {
      setError(parseApiError(err).message);
    } finally {
      setBusy(null);
    }
  }

  const full = photos.length >= MAX_PHOTOS;

  return (
    <section className="mt-8 max-w-3xl">
      <h2 className="font-display text-lg font-extrabold text-night-blue">Photos</h2>
      <p className="mt-1 text-sm text-ink">
        {photos.length === 0
          ? "Tenants trust listings with real pictures. Add photos of the outside, the rooms, the kitchen and the bathrooms."
          : `${photos.length} of ${MAX_PHOTOS}. The first one is the cover shown on the marketplace.`}
      </p>

      {!loading && photos.length === 0 && (
        <p className="mt-3 rounded-xl border-l-4 border-amber-500 bg-white p-3 text-sm text-ink shadow-sm">
          This listing has no photos yet, so visitors see a plain placeholder. Take your own: pictures copied from
          another listing are rejected.
        </p>
      )}

      <div className="mt-3 flex flex-col gap-3 rounded-xl bg-white p-4 shadow-sm sm:flex-row sm:items-end">
        <label className="flex min-w-0 flex-1 flex-col gap-1 text-sm font-bold text-ink">
          These pictures show
          <select
            value={target}
            onChange={(e) => setTarget(e.target.value)}
            className="w-full min-w-0 rounded-lg border border-mist bg-white px-3 py-2 font-sans font-normal text-ink focus:border-trust-blue focus:outline-none focus:ring-2 focus:ring-trust-blue"
          >
            <option value="">The whole property</option>
            {units.map((unit) => (
              <option key={unit.id} value={unit.id}>
                {unit.label}
              </option>
            ))}
          </select>
        </label>
        <label
          className={`inline-flex cursor-pointer items-center justify-center rounded-lg bg-trust-blue px-5 py-2.5 font-display font-extrabold text-white transition-colors hover:bg-blue-800 ${
            busy || full ? "pointer-events-none opacity-60" : ""
          }`}
        >
          {busy === "Uploading..." ? "Uploading..." : full ? "Photo limit reached" : "Add photos"}
          <input
            type="file"
            multiple
            accept={ACCEPTED_PHOTO_TYPES.join(",")}
            onChange={(e) => void handleFiles(e)}
            className="sr-only"
          />
        </label>
      </div>

      {error && (
        <p role="alert" className="mt-3 rounded-lg bg-red-50 p-3 text-sm font-bold text-red-600">
          {error}
        </p>
      )}
      {notes.length > 0 && (
        <ul role="alert" className="mt-3 list-disc rounded-lg bg-red-50 p-3 pl-7 text-sm font-bold text-red-600">
          {notes.map((note) => (
            <li key={note}>{note}</li>
          ))}
        </ul>
      )}

      {photos.length > 0 && (
        <ul className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3">
          {photos.map((photo, index) => (
            <li key={photo.id} className="overflow-hidden rounded-xl bg-white shadow-sm">
              <div className="relative">
                <img
                  src={photoUrl(photo.id)}
                  alt={flatName(photo.unitId) ? `Photo of ${flatName(photo.unitId)}` : "Photo of the property"}
                  loading="lazy"
                  className="aspect-[4/3] w-full bg-mist object-cover"
                />
                {index === 0 && (
                  <span className="absolute left-2 top-2 rounded-full bg-night-blue/90 px-2.5 py-0.5 text-xs font-bold text-white">
                    Cover
                  </span>
                )}
              </div>
              <div className="flex flex-col gap-1 p-2.5">
                <p className="truncate text-xs text-ink/70">{flatName(photo.unitId) ?? "Whole property"}</p>
                <div className="flex gap-3">
                  {index !== 0 && (
                    <button
                      type="button"
                      disabled={busy !== null}
                      onClick={() => void handleCover(photo)}
                      className="text-sm font-bold text-trust-blue hover:underline disabled:opacity-60"
                    >
                      Make cover
                    </button>
                  )}
                  <button
                    type="button"
                    disabled={busy !== null}
                    onClick={() => void handleRemove(photo)}
                    className="text-sm font-bold text-red-600 hover:underline disabled:opacity-60"
                  >
                    Remove
                  </button>
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
