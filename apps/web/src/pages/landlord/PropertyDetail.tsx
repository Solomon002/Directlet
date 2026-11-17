import { useEffect, useState, type FormEvent } from "react";
import { Link, useNavigate, useParams } from "react-router";
import {
  getMyProperty,
  createUnit,
  updateUnit,
  deleteUnit,
  confirmUnit,
  confirmAllUnits,
  updateProperty,
  deleteProperty,
  type Property,
  type Unit,
  type UnitInput,
} from "../../features/properties/api";
import PhotoManager from "../../features/photos/PhotoManager";
import { parseApiError } from "../../lib/errors";
import { formatRent } from "../../lib/money";
import { PlaceMap } from "../../features/maps/Maps";
import { LocationPicker } from "../../features/maps/LocationTools";
import { hasLocation, type LatLng } from "../../features/maps/geo";

// min-w-0 lets a field shrink below its default width, so two side by side fit a phone.
const inputClass = "w-full min-w-0 rounded-lg border border-mist px-3 py-2 font-sans text-ink";
const labelClass = "flex min-w-0 flex-col gap-1 text-sm font-bold text-ink";

const frequencyLabels: Record<string, string> = {
  MONTHLY: "Monthly",
  QUARTERLY: "Quarterly",
  BIANNUAL: "Every 6 months",
  ANNUAL: "Yearly",
};

// Used both to add a flat and to edit one.
function UnitForm({
  initial,
  submitLabel,
  onSubmit,
}: {
  initial?: Unit;
  submitLabel: string;
  onSubmit: (input: UnitInput) => Promise<void>;
}) {
  const [label, setLabel] = useState(initial?.label ?? "");
  const [bedrooms, setBedrooms] = useState(String(initial?.bedrooms ?? 1));
  const [bathrooms, setBathrooms] = useState(String(initial?.bathrooms ?? 1));
  const [rentAmount, setRentAmount] = useState(initial ? String(Number(initial.rentAmount)) : "");
  const [rentFrequency, setRentFrequency] = useState(initial?.rentFrequency ?? "ANNUAL");
  const [description, setDescription] = useState(initial?.description ?? "");
  // Fees stay as text so a blank box means "not stated" and 0 means "no such fee".
  const feeText = (value: string | null | undefined) => (value == null ? "" : String(Number(value)));
  const [cautionDeposit, setCautionDeposit] = useState(feeText(initial?.cautionDeposit));
  const [agreementFee, setAgreementFee] = useState(feeText(initial?.agreementFee));
  const [serviceCharge, setServiceCharge] = useState(feeText(initial?.serviceCharge));
  const [agencyFee, setAgencyFee] = useState(feeText(initial?.agencyFee));
  const [availableFrom, setAvailableFrom] = useState(initial?.availableFrom?.slice(0, 10) ?? "");
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const fee = (text: string) => (text.trim() === "" ? null : Number(text));
  const rentNumber = Number(rentAmount) || 0;
  const statedFees = [cautionDeposit, agreementFee, serviceCharge, agencyFee].reduce(
    (sum, text) => sum + (fee(text) ?? 0),
    0,
  );
  const feeInputs = [
    ["Caution deposit", cautionDeposit, setCautionDeposit],
    ["Agreement fee", agreementFee, setAgreementFee],
    ["Service charge", serviceCharge, setServiceCharge],
    ["Agency fee", agencyFee, setAgencyFee],
  ] as const;

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setFormError(null);
    try {
      await onSubmit({
        label,
        bedrooms: Number(bedrooms),
        bathrooms: bathrooms ? Number(bathrooms) : undefined,
        rentAmount: Number(rentAmount),
        rentFrequency,
        // An empty string (not undefined) so clearing the field clears it.
        description,
        cautionDeposit: fee(cautionDeposit),
        agreementFee: fee(agreementFee),
        serviceCharge: fee(serviceCharge),
        agencyFee: fee(agencyFee),
        availableFrom: availableFrom || null,
      });
    } catch (err) {
      setFormError(parseApiError(err).message);
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="mt-4 flex max-w-md flex-col gap-3 rounded-xl bg-white p-6 shadow-sm">
      <label className={labelClass}>
        Label
        <input value={label} onChange={(e) => setLabel(e.target.value)} required className={inputClass} />
      </label>
      <div className="flex gap-3">
        <label className={`${labelClass} flex-1`}>
          Bedrooms
          <input
            type="number"
            min={0}
            value={bedrooms}
            onChange={(e) => setBedrooms(e.target.value)}
            required
            className={inputClass}
          />
        </label>
        <label className={`${labelClass} flex-1`}>
          Bathrooms
          <input
            type="number"
            min={0}
            value={bathrooms}
            onChange={(e) => setBathrooms(e.target.value)}
            className={inputClass}
          />
        </label>
      </div>
      <div className="flex flex-col gap-3 sm:flex-row">
        <label className={`${labelClass} flex-1`}>
          Rent (NGN)
          <input
            type="number"
            min={1}
            value={rentAmount}
            onChange={(e) => setRentAmount(e.target.value)}
            required
            className={inputClass}
          />
        </label>
        <label className={`${labelClass} flex-1`}>
          Paid
          <select value={rentFrequency} onChange={(e) => setRentFrequency(e.target.value)} className={inputClass}>
            {Object.entries(frequencyLabels).map(([value, text]) => (
              <option key={value} value={value}>
                {text}
              </option>
            ))}
          </select>
        </label>
      </div>
      <label className={labelClass}>
        Description <span className="font-normal text-ink/60">(optional)</span>
        <textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={2} className={inputClass} />
      </label>
      <fieldset className="flex flex-col gap-3 rounded-lg border border-mist p-3">
        <legend className="px-1 text-sm font-bold text-ink">Other costs to move in</legend>
        <p className="text-sm text-ink/70">
          Tenants see these on your listing before they ask. Enter 0 if there is no such fee. Leave a box blank if you
          have not decided, and tenants will see "Ask landlord".
        </p>
        <div className="grid gap-3 sm:grid-cols-2">
          {feeInputs.map(([text, value, setValue]) => (
            <label key={text} className={labelClass}>
              {text} (NGN)
              <input
                type="number"
                min={0}
                value={value}
                onChange={(e) => setValue(e.target.value)}
                placeholder="Ask landlord"
                className={inputClass}
              />
            </label>
          ))}
        </div>
        {rentNumber > 0 && (
          <p className="text-sm font-bold text-night-blue">
            Total to move in: NGN {(rentNumber + statedFees).toLocaleString()}
          </p>
        )}
      </fieldset>
      <label className={labelClass}>
        Available from <span className="font-normal text-ink/60">(optional, if it is let now)</span>
        <input type="date" value={availableFrom} onChange={(e) => setAvailableFrom(e.target.value)} className={inputClass} />
      </label>
      {initial && (
        <p className="text-sm text-ink/60">
          Rent changes apply to new tenancies. A current tenant keeps the rent agreed when they moved in.
        </p>
      )}

      {formError && <p className="text-sm font-bold text-red-600">{formError}</p>}

      <button
        type="submit"
        disabled={submitting}
        className="mt-2 rounded-xl bg-trust-blue px-5 py-3 font-display font-extrabold text-white disabled:opacity-60"
      >
        {submitting ? "Saving..." : submitLabel}
      </button>
    </form>
  );
}

function PropertyForm({ property, onSaved }: { property: Property; onSaved: () => Promise<void> }) {
  const [name, setName] = useState(property.name);
  const [address, setAddress] = useState(property.address);
  const [area, setArea] = useState(property.area);
  const [city, setCity] = useState(property.city);
  const [state, setState] = useState(property.state);
  const [description, setDescription] = useState(property.description ?? "");
  const [isPublic, setIsPublic] = useState(property.isPublic);
  const [location, setLocation] = useState<LatLng | null>(hasLocation(property) ? property : null);
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setFormError(null);
    try {
      await updateProperty(property.id, {
        name,
        address,
        area,
        city,
        state,
        description,
        isPublic,
        latitude: location?.latitude ?? null,
        longitude: location?.longitude ?? null,
      });
      await onSaved();
    } catch (err) {
      setFormError(parseApiError(err).message);
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="mt-4 flex max-w-md flex-col gap-3 rounded-xl bg-white p-6 shadow-sm">
      <label className={labelClass}>
        Name
        <input value={name} onChange={(e) => setName(e.target.value)} required className={inputClass} />
      </label>
      <label className={labelClass}>
        Address
        <input value={address} onChange={(e) => setAddress(e.target.value)} required className={inputClass} />
      </label>
      <div className="flex flex-col gap-3 sm:flex-row">
        <label className={`${labelClass} flex-1`}>
          Area
          <input value={area} onChange={(e) => setArea(e.target.value)} required className={inputClass} />
        </label>
        <label className={`${labelClass} flex-1`}>
          City
          <input value={city} onChange={(e) => setCity(e.target.value)} required className={inputClass} />
        </label>
      </div>
      <label className={labelClass}>
        State
        <input value={state} onChange={(e) => setState(e.target.value)} required className={inputClass} />
      </label>
      <label className={labelClass}>
        Description <span className="font-normal text-ink/60">(optional)</span>
        <textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={2} className={inputClass} />
      </label>
      <label className="flex items-center gap-2 text-sm font-bold text-ink">
        <input type="checkbox" checked={isPublic} onChange={(e) => setIsPublic(e.target.checked)} />
        Show on the public marketplace
      </label>

      <LocationPicker
        value={location}
        onChange={setLocation}
        defaultQuery={[address, area, city].filter(Boolean).join(", ")}
      />

      {formError && <p className="text-sm font-bold text-red-600">{formError}</p>}

      <button
        type="submit"
        disabled={submitting}
        className="mt-2 rounded-xl bg-trust-blue px-5 py-3 font-display font-extrabold text-white disabled:opacity-60"
      >
        {submitting ? "Saving..." : "Save changes"}
      </button>
    </form>
  );
}

export default function PropertyDetail() {
  const { propertyId } = useParams<{ propertyId: string }>();
  const navigate = useNavigate();
  const [property, setProperty] = useState<Property | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [editingProperty, setEditingProperty] = useState(false);
  const [showAddUnit, setShowAddUnit] = useState(false);
  const [editingUnitId, setEditingUnitId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [confirmingId, setConfirmingId] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  async function load() {
    if (!propertyId) return;
    setLoadError(null);
    try {
      const data = await getMyProperty(propertyId);
      setProperty(data);
    } catch (err) {
      setLoadError(parseApiError(err).message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
  }, [propertyId]);

  async function handleDeleteProperty() {
    if (!property) return;
    if (!window.confirm(`Delete ${property.name} and all its flats? This cannot be undone.`)) return;
    setDeletingId(property.id);
    setActionError(null);
    try {
      await deleteProperty(property.id);
      navigate("/landlord/properties", { replace: true });
    } catch (err) {
      setActionError(parseApiError(err).message);
      setDeletingId(null);
    }
  }

  // "Still available": vouches for one flat, or for all of them at once.
  async function handleConfirm(unit?: Unit) {
    if (!property) return;
    setConfirmingId(unit?.id ?? "all");
    setActionError(null);
    try {
      if (unit) await confirmUnit(property.id, unit.id);
      else await confirmAllUnits(property.id);
      await load();
    } catch (err) {
      setActionError(parseApiError(err).message);
    } finally {
      setConfirmingId(null);
    }
  }

  async function handleDeleteUnit(unit: Unit) {
    if (!property) return;
    if (!window.confirm(`Delete ${unit.label}? This cannot be undone.`)) return;
    setDeletingId(unit.id);
    setActionError(null);
    try {
      await deleteUnit(property.id, unit.id);
      await load();
    } catch (err) {
      setActionError(parseApiError(err).message);
    } finally {
      setDeletingId(null);
    }
  }

  if (loading) {
    return <div className="p-4 text-ink sm:p-8">Loading...</div>;
  }

  if (loadError || !property) {
    return <div className="p-4 text-sm font-bold text-red-600 sm:p-8">{loadError ?? "Property not found."}</div>;
  }

  return (
    <div className="p-4 sm:p-8">
      <Link to="/landlord/properties" className="text-sm font-bold text-trust-blue">
        Back to properties
      </Link>

      <div className="mt-4 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-extrabold text-night-blue">{property.name}</h1>
          <p className="mt-1 text-sm text-ink">
            {property.address}, {property.area}, {property.city}, {property.state}
          </p>
          <p className="mt-1 text-sm font-bold text-ink/60">
            {property.hiddenByAdminAt
              ? "Taken down by DirectLet"
              : property.isPublic
                ? "Listed on the marketplace"
                : "Hidden from the marketplace"}
          </p>
          {property.hiddenByAdminAt && (
            <p className="mt-2 max-w-xl rounded-xl border-l-4 border-red-600 bg-white p-3 text-sm text-ink shadow-sm">
              DirectLet support has removed this listing from the marketplace
              {property.hiddenByAdminReason ? `: ${property.hiddenByAdminReason}` : "."} You can still manage your
              tenants here. Contact support to have it restored.
            </p>
          )}
        </div>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => setEditingProperty((v) => !v)}
            className="rounded-xl border-2 border-trust-blue px-4 py-2 font-display font-extrabold text-trust-blue"
          >
            {editingProperty ? "Cancel" : "Edit"}
          </button>
          <button
            type="button"
            disabled={deletingId === property.id}
            onClick={() => void handleDeleteProperty()}
            className="rounded-xl border-2 border-red-600 px-4 py-2 font-display font-extrabold text-red-600 disabled:opacity-60"
          >
            Delete
          </button>
        </div>
      </div>
      {property.description && !editingProperty && <p className="mt-2 text-ink">{property.description}</p>}

      {!editingProperty && (
        <div className="mt-4 max-w-xl">
          {hasLocation(property) ? (
            <PlaceMap place={property} label={property.name} />
          ) : (
            <p className="rounded-xl bg-white p-4 text-sm text-ink shadow-sm">
              No map location yet. Click <span className="font-bold">Edit</span> to drop a pin so visitors
              can see it on the map and get directions.
            </p>
          )}
        </div>
      )}

      {editingProperty && (
        <PropertyForm
          property={property}
          onSaved={async () => {
            setEditingProperty(false);
            await load();
          }}
        />
      )}

      {actionError && <p className="mt-4 text-sm font-bold text-red-600">{actionError}</p>}

      <PhotoManager propertyId={property.id} units={property.units ?? []} />

      <div className="mt-8 flex items-center justify-between">
        <h2 className="font-display text-lg font-extrabold text-night-blue">Flats</h2>
        <button
          type="button"
          onClick={() => setShowAddUnit((v) => !v)}
          className="rounded-xl bg-trust-blue px-4 py-2 font-display font-extrabold text-white"
        >
          {showAddUnit ? "Cancel" : "Add flat"}
        </button>
      </div>

      {showAddUnit && (
        <UnitForm
          submitLabel="Add flat"
          onSubmit={async (input) => {
            await createUnit(property.id, input);
            setShowAddUnit(false);
            await load();
          }}
        />
      )}

      {property.units?.some((unit) => !unit.occupied) && (
        <p className="mt-2 max-w-xl text-sm text-ink">
          Visitors see when you last confirmed a flat is available. After 30 days without a tap it is hidden from
          viewing requests, so people are not sent to a flat that is already let.{" "}
          <button
            type="button"
            disabled={confirmingId !== null}
            onClick={() => void handleConfirm()}
            className="font-bold text-trust-blue hover:underline disabled:opacity-60"
          >
            {confirmingId === "all" ? "Saving..." : "Confirm every flat is still available"}
          </button>
        </p>
      )}

      <ul className="mt-4 flex flex-col gap-3">
        {property.units?.map((unit) => (
          <li key={unit.id} className="rounded-xl bg-white p-4 shadow-sm">
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div>
                <p className="font-display font-extrabold text-night-blue">{unit.label}</p>
                <p className="text-sm text-ink">
                  {unit.bedrooms} bed{unit.bathrooms != null ? ` - ${unit.bathrooms} bath` : ""} -{" "}
                  {formatRent(unit.rentAmount, unit.rentFrequency)}
                </p>
                {unit.occupied ? (
                  <p className="mt-1 text-sm font-bold text-ink/60">Let</p>
                ) : (
                  <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1">
                    <span
                      className={`rounded-full px-2.5 py-0.5 text-xs font-bold ${
                        unit.availability.state === "CONFIRMED"
                          ? "bg-direct-green/10 text-green-700"
                          : unit.availability.state === "DUE"
                            ? "bg-amber-100 text-amber-800"
                            : "bg-red-50 text-red-600"
                      }`}
                    >
                      {unit.availability.state === "STALE"
                        ? "Hidden from viewings: not confirmed"
                        : unit.availability.state === "DUE"
                          ? "Please confirm"
                          : "Available"}
                    </span>
                    <span className="text-xs text-ink/60">
                      Confirmed{" "}
                      {unit.availability.daysSinceConfirmed === 0
                        ? "today"
                        : `${unit.availability.daysSinceConfirmed} day${unit.availability.daysSinceConfirmed === 1 ? "" : "s"} ago`}
                    </span>
                    <button
                      type="button"
                      disabled={confirmingId !== null}
                      onClick={() => void handleConfirm(unit)}
                      className="text-sm font-bold text-trust-blue hover:underline disabled:opacity-60"
                    >
                      {confirmingId === unit.id ? "Saving..." : "Still available"}
                    </button>
                  </div>
                )}
              </div>
              <div className="flex gap-4">
                <button
                  type="button"
                  onClick={() => setEditingUnitId((id) => (id === unit.id ? null : unit.id))}
                  className="text-sm font-bold text-trust-blue hover:underline"
                >
                  {editingUnitId === unit.id ? "Cancel" : "Edit"}
                </button>
                <button
                  type="button"
                  disabled={deletingId === unit.id}
                  onClick={() => void handleDeleteUnit(unit)}
                  className="text-sm font-bold text-red-600 hover:underline disabled:opacity-60"
                >
                  Delete
                </button>
              </div>
            </div>
            {editingUnitId === unit.id && (
              <UnitForm
                initial={unit}
                submitLabel="Save flat"
                onSubmit={async (input) => {
                  await updateUnit(property.id, unit.id, input);
                  setEditingUnitId(null);
                  await load();
                }}
              />
            )}
          </li>
        ))}
        {property.units?.length === 0 && <p className="text-ink">No flats yet.</p>}
      </ul>
    </div>
  );
}
