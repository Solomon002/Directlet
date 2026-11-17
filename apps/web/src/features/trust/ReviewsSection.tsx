import { useEffect, useState, type FormEvent } from "react";
import { Link } from "react-router";
import type { PublicReviews } from "../public/api";
import { createReview, getReviewEligibility, type ReviewEligibility } from "./api";
import Stars from "./Stars";
import { parseApiError } from "../../lib/errors";
import { useAuthStore } from "../../stores/authStore";

function day(iso: string) {
  return new Date(iso).toLocaleDateString([], { day: "numeric", month: "short", year: "numeric" });
}

// Reviews from people who really visited. The form only appears for someone who can
// write one; everyone else just reads.
export default function ReviewsSection({
  propertyId,
  reviews,
  onPosted,
}: {
  propertyId: string;
  reviews: PublicReviews;
  onPosted: () => void;
}) {
  const user = useAuthStore((s) => s.user);
  const canTry = user?.role === "HUNTER" || user?.role === "TENANT";

  const [eligibility, setEligibility] = useState<ReviewEligibility | null>(null);
  const [rating, setRating] = useState(0);
  const [matchedPhotos, setMatchedPhotos] = useState<boolean | null>(null);
  const [priceAsStated, setPriceAsStated] = useState<boolean | null>(null);
  const [comment, setComment] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [thanks, setThanks] = useState(false);

  useEffect(() => {
    if (!canTry) return;
    getReviewEligibility(propertyId)
      .then(setEligibility)
      .catch(() => setEligibility(null));
  }, [canTry, propertyId]);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (rating === 0 || matchedPhotos === null || priceAsStated === null) {
      setError("Choose a star rating and answer both questions.");
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      await createReview(propertyId, { rating, matchedPhotos, priceAsStated, comment: comment || undefined });
      setThanks(true);
      setEligibility({ eligible: false, alreadyReviewed: true, reason: null });
      onPosted();
    } catch (err) {
      setError(parseApiError(err).message);
    } finally {
      setSubmitting(false);
    }
  }

  const yesNo = (label: string, value: boolean | null, set: (v: boolean) => void) => (
    <fieldset className="flex flex-wrap items-center gap-x-4 gap-y-1">
      <legend className="mb-1 text-sm font-bold text-ink">{label}</legend>
      {[true, false].map((answer) => (
        <label key={String(answer)} className="flex items-center gap-1.5 text-sm text-ink">
          <input type="radio" name={label} checked={value === answer} onChange={() => set(answer)} />
          {answer ? "Yes" : "No"}
        </label>
      ))}
    </fieldset>
  );

  return (
    <section className="mt-10 max-w-2xl" aria-labelledby="reviews-heading">
      <h2 id="reviews-heading" className="font-display text-lg font-extrabold text-night-blue">
        Reviews
      </h2>

      {reviews.count === 0 ? (
        <p className="mt-2 text-sm text-ink">No reviews yet. Only people who have visited can leave one.</p>
      ) : (
        <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1">
          <span className="font-display text-2xl font-extrabold text-night-blue">{reviews.average}</span>
          <Stars value={reviews.average ?? 0} />
          <span className="text-sm text-ink">
            {reviews.count} review{reviews.count === 1 ? "" : "s"}
          </span>
          <span className="text-sm text-ink/70">
            Matched its photos: {reviews.matchedPhotosPercent}% · Price as stated: {reviews.priceAsStatedPercent}%
          </span>
        </div>
      )}

      {thanks && <p className="mt-3 text-sm font-bold text-direct-green">Thank you. Your review is up.</p>}

      {eligibility?.eligible && !thanks && (
        <form onSubmit={handleSubmit} className="mt-4 flex flex-col gap-3 rounded-xl bg-white p-4 shadow-sm">
          <p className="font-bold text-night-blue">You visited this place. How was it?</p>
          <div role="radiogroup" aria-label="Star rating" className="flex gap-1">
            {[1, 2, 3, 4, 5].map((n) => (
              <button
                key={n}
                type="button"
                role="radio"
                aria-checked={rating === n}
                aria-label={`${n} star${n === 1 ? "" : "s"}`}
                onClick={() => setRating(n)}
                className={`rounded-lg px-2 py-1 text-2xl leading-none ${n <= rating ? "text-amber-500" : "text-ink/25"}`}
              >
                ★
              </button>
            ))}
          </div>
          {yesNo("Did it match the photos?", matchedPhotos, setMatchedPhotos)}
          {yesNo("Was the price as stated?", priceAsStated, setPriceAsStated)}
          <label className="flex flex-col gap-1 text-sm font-bold text-ink">
            Anything others should know? <span className="font-normal text-ink/60">(optional)</span>
            <textarea
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              maxLength={600}
              rows={3}
              className="w-full rounded-lg border border-mist p-3 font-sans font-normal text-ink focus:border-trust-blue focus:outline-none focus:ring-2 focus:ring-trust-blue"
            />
          </label>
          {error && (
            <p role="alert" className="text-sm font-bold text-red-600">
              {error}
            </p>
          )}
          <button
            type="submit"
            disabled={submitting}
            className="w-full rounded-lg bg-trust-blue px-5 py-3 font-display font-extrabold text-white transition-colors hover:bg-blue-800 disabled:opacity-60 sm:w-auto"
          >
            {submitting ? "Posting..." : "Post review"}
          </button>
        </form>
      )}
      {eligibility && !eligibility.eligible && !thanks && eligibility.reason && (
        <p className="mt-3 text-xs text-ink/60">{eligibility.reason}</p>
      )}
      {!user && (
        <p className="mt-3 text-xs text-ink/60">
          <Link to="/login" className="font-bold text-trust-blue hover:underline">
            Log in
          </Link>{" "}
          if you have visited and want to leave a review.
        </p>
      )}

      <ul className="mt-4 flex flex-col gap-3">
        {reviews.items.map((review) => (
          <li key={review.id} className="rounded-xl bg-white p-4 shadow-sm">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="flex items-center gap-2">
                <Stars value={review.rating} />
                <span className="text-sm font-bold text-ink">{review.reviewerName}</span>
              </span>
              <span className="text-xs text-ink/60">{day(review.createdAt)}</span>
            </div>
            <p className="mt-1 text-xs text-ink/70">
              {review.matchedPhotos ? "Matched the photos" : "Did not match the photos"} ·{" "}
              {review.priceAsStated ? "Price as stated" : "Price was different"}
            </p>
            {review.comment && <p className="mt-2 text-sm text-ink">{review.comment}</p>}
            {review.landlordResponse && (
              <div className="mt-3 rounded-lg bg-mist p-3 text-sm text-ink">
                <p className="text-xs font-bold text-night-blue">Reply from the owner</p>
                <p className="mt-0.5">{review.landlordResponse}</p>
              </div>
            )}
          </li>
        ))}
      </ul>
    </section>
  );
}
