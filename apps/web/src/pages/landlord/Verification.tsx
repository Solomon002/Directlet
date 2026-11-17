import { useEffect, useState, type ChangeEvent, type FormEvent } from "react";
import {
  ACCEPTED_DOCUMENT_TYPES,
  MAX_DOCUMENT_BYTES,
  deleteDocument,
  docKindHelp,
  docKindLabels,
  getMyVerification,
  openDocument,
  submitVerification,
  uploadDocument,
  type CacType,
  type DocKind,
  type LandlordType,
  type Verification,
} from "../../features/verification/api";
import { parseApiError } from "../../lib/errors";

const inputClass =
  "w-full rounded-lg border border-mist bg-white p-3 font-sans text-ink focus:border-trust-blue focus:outline-none focus:ring-2 focus:ring-trust-blue";
const labelClass = "flex flex-col gap-1 text-sm font-bold text-ink";

const cacTypes: { value: CacType; label: string }[] = [
  { value: "RC", label: "RC: a registered company (Ltd or Plc)" },
  { value: "BN", label: "BN: a registered business name" },
  { value: "IT", label: "IT: incorporated trustees" },
];

function requiredKinds(type: LandlordType): DocKind[] {
  return type === "COMPANY" ? ["ID", "OWNERSHIP", "CAC_CERTIFICATE"] : ["ID", "OWNERSHIP"];
}

function formatSize(bytes: number) {
  return bytes < 1024 * 1024 ? `${Math.max(1, Math.round(bytes / 1024))} KB` : `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

function StatusBanner({ verification }: { verification: Verification | null }) {
  if (!verification) {
    return (
      <div className="rounded-xl bg-white p-4 shadow-sm">
        <p className="font-display font-extrabold text-night-blue">Not verified yet</p>
        <p className="mt-1 text-sm text-ink">
          Tenants trust listings from verified landlords, and yours is shown above unverified ones. It takes two
          steps: tell us who you are, then upload your documents.
        </p>
      </div>
    );
  }
  if (verification.status === "VERIFIED") {
    return (
      <div className="rounded-xl border-l-4 border-direct-green bg-white p-4 shadow-sm">
        <p className="font-display font-extrabold text-green-700">You are verified</p>
        <p className="mt-1 text-sm text-ink">
          A "Verified {verification.landlordType === "COMPANY" ? "business" : "owner"}" badge shows on all your listings.
          {verification.landlordType === "COMPANY" && verification.cacNumber
            ? ` Visitors can see your CAC number (${verification.cacType} ${verification.cacNumber}).`
            : ""}
        </p>
      </div>
    );
  }
  if (verification.status === "REJECTED") {
    return (
      <div className="rounded-xl border-l-4 border-red-600 bg-white p-4 shadow-sm">
        <p className="font-display font-extrabold text-red-600">Not approved yet</p>
        <p className="mt-1 text-sm text-ink">
          {verification.rejectionReason ?? "Something needs fixing."} Fix it below, then send it again.
        </p>
      </div>
    );
  }
  return (
    <div className="rounded-xl border-l-4 border-trust-blue bg-white p-4 shadow-sm">
      <p className="font-display font-extrabold text-trust-blue">
        {verification.missingDocuments.length > 0 ? "Add your documents" : "Under review"}
      </p>
      <p className="mt-1 text-sm text-ink">
        {verification.missingDocuments.length > 0
          ? `Still needed: ${verification.missingDocuments.map((kind) => docKindLabels[kind]).join(", ")}. We review once these are in.`
          : "We have everything we need. We will check your documents and get back to you here."}
      </p>
    </div>
  );
}

function DocumentSlot({
  kind,
  verification,
  disabled,
  onChanged,
}: {
  kind: DocKind;
  verification: Verification | null;
  disabled: boolean;
  onChanged: () => Promise<void>;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const files = verification?.documents.filter((document) => document.kind === kind) ?? [];

  async function handleFile(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setError(null);
    if (!ACCEPTED_DOCUMENT_TYPES.includes(file.type)) {
      setError("Use a JPG, PNG or WebP image, or a PDF.");
      return;
    }
    if (file.size > MAX_DOCUMENT_BYTES) {
      setError("That file is over 3 MB. Take a smaller photo or compress the PDF.");
      return;
    }
    setBusy(true);
    try {
      await uploadDocument(kind, file);
      await onChanged();
    } catch (err) {
      setError(parseApiError(err).message);
    } finally {
      setBusy(false);
    }
  }

  async function handleRemove(documentId: string) {
    setBusy(true);
    setError(null);
    try {
      await deleteDocument(documentId);
      await onChanged();
    } catch (err) {
      setError(parseApiError(err).message);
    } finally {
      setBusy(false);
    }
  }

  async function handleOpen(documentId: string) {
    setError(null);
    try {
      await openDocument(documentId);
    } catch (err) {
      setError(parseApiError(err).message);
    }
  }

  return (
    <li className="rounded-xl bg-white p-4 shadow-sm">
      <p className="font-display font-extrabold text-night-blue">{docKindLabels[kind]}</p>
      <p className="mt-0.5 text-sm text-ink/70">{docKindHelp[kind]}</p>

      {files.length > 0 && (
        <ul className="mt-3 flex flex-col gap-2">
          {files.map((file) => (
            <li key={file.id} className="flex items-center justify-between gap-3 rounded-lg bg-mist px-3 py-2 text-sm">
              <button
                type="button"
                onClick={() => void handleOpen(file.id)}
                className="min-w-0 truncate text-left font-bold text-trust-blue hover:underline"
              >
                {file.fileName} <span className="font-normal text-ink/60">({formatSize(file.sizeBytes)})</span>
              </button>
              {!disabled && (
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => void handleRemove(file.id)}
                  className="shrink-0 font-bold text-red-600 hover:underline disabled:opacity-60"
                >
                  Remove
                </button>
              )}
            </li>
          ))}
        </ul>
      )}

      {!disabled && (
        <label
          className={`mt-3 inline-flex cursor-pointer items-center rounded-lg border-2 border-trust-blue px-4 py-2 text-sm font-bold text-trust-blue transition hover:bg-trust-blue/5 ${
            busy ? "pointer-events-none opacity-60" : ""
          }`}
        >
          {busy ? "Uploading..." : files.length > 0 ? "Add another file" : "Choose a file"}
          <input type="file" accept={ACCEPTED_DOCUMENT_TYPES.join(",")} onChange={(e) => void handleFile(e)} className="sr-only" />
        </label>
      )}
      {error && (
        <p role="alert" className="mt-2 text-sm font-bold text-red-600">
          {error}
        </p>
      )}
    </li>
  );
}

export default function VerificationPage() {
  const [verification, setVerification] = useState<Verification | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [landlordType, setLandlordType] = useState<LandlordType>("INDIVIDUAL");
  const [cacType, setCacType] = useState<CacType>("RC");
  const [cacNumber, setCacNumber] = useState("");
  const [registeredName, setRegisteredName] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  function fill(next: Verification | null) {
    setVerification(next);
    if (next) {
      setLandlordType(next.landlordType);
      setCacType(next.cacType ?? "RC");
      setCacNumber(next.cacNumber ?? "");
      setRegisteredName(next.registeredName ?? "");
    }
  }

  async function load() {
    try {
      fill(await getMyVerification());
    } catch (err) {
      setLoadError(parseApiError(err).message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
  }, []);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setFormError(null);
    setSaved(false);
    try {
      fill(
        await submitVerification(
          landlordType === "COMPANY"
            ? { landlordType, cacType, cacNumber, registeredName }
            : { landlordType },
        ),
      );
      setSaved(true);
    } catch (err) {
      setFormError(parseApiError(err).message);
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) {
    return <div className="p-4 text-ink sm:p-8">Loading...</div>;
  }
  if (loadError) {
    return <div className="p-4 text-sm font-bold text-red-600 sm:p-8">{loadError}</div>;
  }

  const locked = verification?.status === "VERIFIED";

  return (
    <div className="p-4 sm:p-8">
      <h1 className="font-display text-2xl font-extrabold text-night-blue">Get verified</h1>
      <p className="mt-1 max-w-xl text-sm text-ink">
        Fake listings are the biggest worry for people looking for a home. Verification shows tenants that a real
        person, who is allowed to rent the property out, is behind your listings.
      </p>

      <div className="mt-6 max-w-xl">
        <StatusBanner verification={verification} />
      </div>

      {!locked && (
        <>
          <h2 className="mt-8 font-display text-lg font-extrabold text-night-blue">Step 1: Who are you?</h2>
          <form onSubmit={handleSubmit} className="mt-3 flex max-w-xl flex-col gap-4 rounded-xl bg-white p-5 shadow-sm">
            <fieldset className="flex flex-col gap-2">
              <legend className="mb-1 text-sm font-bold text-ink">I am renting out as</legend>
              {(
                [
                  ["INDIVIDUAL", "An individual owner", "You own the property, or the owner has allowed you to rent it out."],
                  ["COMPANY", "A company or registered business", "You have a CAC number (RC, BN or IT)."],
                ] as const
              ).map(([value, title, help]) => (
                <label
                  key={value}
                  className={`flex cursor-pointer items-start gap-3 rounded-lg border p-3 ${
                    landlordType === value ? "border-trust-blue bg-trust-blue/5" : "border-mist"
                  }`}
                >
                  <input
                    type="radio"
                    name="landlordType"
                    value={value}
                    checked={landlordType === value}
                    onChange={() => setLandlordType(value)}
                    className="mt-1"
                  />
                  <span>
                    <span className="block text-sm font-bold text-ink">{title}</span>
                    <span className="block text-sm text-ink/70">{help}</span>
                  </span>
                </label>
              ))}
            </fieldset>

            {landlordType === "COMPANY" && (
              <>
                <label className={labelClass}>
                  Type of registration
                  <select value={cacType} onChange={(e) => setCacType(e.target.value as CacType)} className={inputClass}>
                    {cacTypes.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </label>
                <label className={labelClass}>
                  CAC number
                  <input
                    value={cacNumber}
                    onChange={(e) => setCacNumber(e.target.value)}
                    inputMode="numeric"
                    placeholder="e.g. 1234567"
                    required
                    className={inputClass}
                  />
                  <span className="text-xs font-normal text-ink/60">
                    Just the digits is fine. We check it against the CAC public register (
                    <a href="https://search.cac.gov.ng" target="_blank" rel="noreferrer" className="font-bold text-trust-blue hover:underline">
                      search.cac.gov.ng
                    </a>
                    ).
                  </span>
                </label>
                <label className={labelClass}>
                  Registered name
                  <input
                    value={registeredName}
                    onChange={(e) => setRegisteredName(e.target.value)}
                    placeholder="Exactly as it appears on your CAC certificate"
                    required
                    className={inputClass}
                  />
                </label>
              </>
            )}

            {formError && (
              <p role="alert" className="rounded-lg bg-red-50 p-3 text-sm font-bold text-red-600">
                {formError}
              </p>
            )}
            {saved && !formError && <p className="text-sm font-bold text-green-700">Saved. Now add your documents below.</p>}

            <button
              type="submit"
              disabled={submitting}
              className="w-full rounded-lg bg-trust-blue px-5 py-3 font-display font-extrabold text-white transition-colors hover:bg-blue-800 disabled:opacity-60"
            >
              {submitting ? "Saving..." : verification ? (verification.status === "REJECTED" ? "Send again for review" : "Save details") : "Save and continue"}
            </button>
          </form>

          <h2 className="mt-8 font-display text-lg font-extrabold text-night-blue">Step 2: Your documents</h2>
          <p className="mt-1 max-w-xl text-sm text-ink">
            Only you and the DirectLet review team can see these. They are never shown on your listings.
          </p>
          {!verification && (
            <p className="mt-3 max-w-xl rounded-xl bg-white p-4 text-sm text-ink shadow-sm">
              Save your details in step 1 first, then you can add documents here.
            </p>
          )}
          <ul className="mt-3 flex max-w-xl flex-col gap-3">
            {requiredKinds(verification?.landlordType ?? landlordType).map((kind) => (
              <DocumentSlot key={kind} kind={kind} verification={verification} disabled={!verification} onChanged={load} />
            ))}
          </ul>
        </>
      )}

      <p className="mt-8 max-w-xl text-sm text-ink/70">
        Verification shows we checked your documents. It is not a guarantee, so tenants should still view a property and
        never pay before they have.
      </p>
    </div>
  );
}
