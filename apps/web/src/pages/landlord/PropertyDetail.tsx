import { useEffect, useState, type FormEvent } from "react";
import { Link, useNavigate, useParams } from "react-router";
import {
  getMyProperty,
  createUnit,
  updateUnit,
  deleteUnit,
  updateProperty,
  deleteProperty,
  type Property,
  type Unit,
  type UnitInput,
} from "../../features/properties/api";
import { parseApiError } from "../../lib/errors";

const inputClass = "rounded-lg border border-mist px-3 py-2 font-sans text-ink";
const labelClass = "flex flex-col gap-1 text-sm font-bold text-ink";

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
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

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
            {property.isPublic ? "Listed on the marketplace" : "Hidden from the marketplace"}
          </p>
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

      <ul className="mt-4 flex flex-col gap-3">
        {property.units?.map((unit) => (
          <li key={unit.id} className="rounded-xl bg-white p-4 shadow-sm">
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div>
                <p className="font-display font-extrabold text-night-blue">{unit.label}</p>
                <p className="text-sm text-ink">
                  {unit.bedrooms} bed - {unit.bathrooms ?? "?"} bath - NGN{" "}
                  {Number(unit.rentAmount).toLocaleString()} /{" "}
                  {(frequencyLabels[unit.rentFrequency] ?? unit.rentFrequency).toLowerCase()}
                </p>
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
