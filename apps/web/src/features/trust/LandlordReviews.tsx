import { useEffect, useState, type FormEvent } from "react";
import { listPropertyReviews, respondToReview, type LandlordReview } from "./api";
import Stars from "./Stars";
import { parseApiError } from "../../lib/errors";

// A landlord reads what visitors said and can reply. They cannot delete a review; if
// one is abusive or false, DirectLet's team can remove it.
export default function LandlordReviews({ propertyId }: { propertyId: string }) {
  const [reviews, setReviews] = useState<LandlordReview[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [replying, setReplying] = useState<string | null>(null);
  const [draft, setDraft] = useState("");
  const [busy, setBusy] = useState(false);

  async function load() {
    try {
      setReviews(await listPropertyReviews(propertyId));
    } catch (err) {
      setError(parseApiError(err).message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
  }, [propertyId]);

  async function handleReply(e: FormEvent, reviewId: string) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await respondToReview(propertyId, reviewId, draft);
      setReplying(null);
      setDraft("");
      await load();
    } catch (err) {
      setError(parseApiError(err).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="mt-8 max-w-3xl">
      <h2 className="font-display text-lg font-extrabold text-night-blue">Reviews</h2>
      {loading && <p className="mt-2 text-ink">Loading...</p>}
      {!loading && reviews.length === 0 && (
        <p className="mt-2 text-sm text-ink">
          No reviews yet. Visitors can review after you mark their viewing as done, so remember to do that.
        </p>
      )}
      {error && (
        <p role="alert" className="mt-2 text-sm font-bold text-red-600">
          {error}
        </p>
      )}

      <ul className="mt-3 flex flex-col gap-3">
        {reviews.map((review) => (
          <li key={review.id} className="rounded-xl bg-white p-4 shadow-sm">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="flex items-center gap-2">
                <Stars value={review.rating} />
                <span className="text-sm font-bold text-ink">{review.reviewerName}</span>
              </span>
              <span className="text-xs text-ink/60">{new Date(review.createdAt).toLocaleDateString()}</span>
            </div>
            <p className="mt-1 text-xs text-ink/70">
              {review.matchedPhotos ? "Matched the photos" : "Did not match the photos"} ·{" "}
              {review.priceAsStated ? "Price as stated" : "Price was different"}
            </p>
            {review.comment && <p className="mt-2 text-sm text-ink">{review.comment}</p>}

            {review.landlordResponse && replying !== review.id && (
              <div className="mt-3 rounded-lg bg-mist p-3 text-sm text-ink">
                <p className="text-xs font-bold text-night-blue">Your reply</p>
                <p className="mt-0.5">{review.landlordResponse}</p>
              </div>
            )}

            {replying === review.id ? (
              <form onSubmit={(e) => void handleReply(e, review.id)} className="mt-3 flex flex-col gap-2">
                <label className="flex flex-col gap-1 text-sm font-bold text-ink">
                  Your reply (everyone can see it)
                  <textarea
                    value={draft}
                    onChange={(e) => setDraft(e.target.value)}
                    required
                    minLength={2}
                    maxLength={600}
                    rows={3}
                    className="w-full rounded-lg border border-mist p-3 font-sans font-normal text-ink focus:border-trust-blue focus:outline-none focus:ring-2 focus:ring-trust-blue"
                  />
                </label>
                <div className="flex gap-3">
                  <button type="submit" disabled={busy} className="rounded-lg bg-trust-blue px-4 py-2 font-display font-extrabold text-white disabled:opacity-60">
                    {busy ? "Saving..." : "Post reply"}
                  </button>
                  <button type="button" onClick={() => setReplying(null)} className="font-bold text-ink/70 hover:underline">
                    Cancel
                  </button>
                </div>
              </form>
            ) : (
              <button
                type="button"
                onClick={() => {
                  setReplying(review.id);
                  setDraft(review.landlordResponse ?? "");
                }}
                className="mt-2 text-sm font-bold text-trust-blue hover:underline"
              >
                {review.landlordResponse ? "Edit reply" : "Reply"}
              </button>
            )}
          </li>
        ))}
      </ul>
    </section>
  );
}
