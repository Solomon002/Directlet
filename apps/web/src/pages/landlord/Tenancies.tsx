import { useEffect, useState, type FormEvent } from "react";
import { Link } from "react-router";
import { listMyTenancies, createTenancy, type Tenancy } from "../../features/tenancies/api";
import { listMyProperties, getMyProperty, type Property, type Unit } from "../../features/properties/api";
import { parseApiError } from "../../lib/errors";

export default function Tenancies() {
  const [tenancies, setTenancies] = useState<Tenancy[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [showForm, setShowForm] = useState(false);
  const [properties, setProperties] = useState<Property[]>([]);
  const [selectedPropertyId, setSelectedPropertyId] = useState("");
  const [units, setUnits] = useState<Unit[]>([]);
  const [selectedUnitId, setSelectedUnitId] = useState("");
  const [tenantEmail, setTenantEmail] = useState("");
  const [tenantFullName, setTenantFullName] = useState("");
  const [tenantPhone, setTenantPhone] = useState("");
  const [startDate, setStartDate] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [inviteLink, setInviteLink] = useState<string | null>(null);

  async function loadTenancies() {
    setLoading(true);
    setLoadError(null);
    try {
      setTenancies(await listMyTenancies());
    } catch (err) {
      setLoadError(parseApiError(err).message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadTenancies();
  }, []);

  async function openForm() {
    setShowForm(true);
    setInviteLink(null);
    if (properties.length === 0) {
      try {
        setProperties(await listMyProperties());
      } catch (err) {
        setFormError(parseApiError(err).message);
      }
    }
  }

  async function handlePropertyChange(propertyId: string) {
    setSelectedPropertyId(propertyId);
    setSelectedUnitId("");
    setUnits([]);
    if (!propertyId) return;
    try {
      const property = await getMyProperty(propertyId);
      setUnits(property.units ?? []);
    } catch (err) {
      setFormError(parseApiError(err).message);
    }
  }

  async function handleCreate(e: FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setFormError(null);

    try {
      const result = await createTenancy({
        unitId: selectedUnitId,
        tenantEmail,
        tenantFullName,
        tenantPhone: tenantPhone || undefined,
        startDate,
      });
      setInviteLink(result.inviteLink);
      setTenantEmail("");
      setTenantFullName("");
      setTenantPhone("");
      setStartDate("");
      setSelectedPropertyId("");
      setSelectedUnitId("");
      setUnits([]);
      await loadTenancies();
    } catch (err) {
      setFormError(parseApiError(err).message);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="p-8">
      <div className="flex items-center justify-between">
        <h1 className="font-display text-2xl font-extrabold text-night-blue">Tenancies</h1>
        <button
          type="button"
          onClick={() => (showForm ? setShowForm(false) : void openForm())}
          className="rounded-xl bg-trust-blue px-4 py-2 font-display font-extrabold text-white"
        >
          {showForm ? "Cancel" : "Add tenant"}
        </button>
      </div>

      {inviteLink && (
        <div className="mt-6 rounded-xl bg-direct-green/10 p-4 text-sm text-ink">
          <p className="font-bold">Tenancy created. Share this invite link with the tenant:</p>
          <p className="mt-1 break-all font-sans text-trust-blue">{inviteLink}</p>
        </div>
      )}

      {showForm && (
        <form onSubmit={handleCreate} className="mt-6 flex max-w-md flex-col gap-3 rounded-xl bg-white p-6 shadow-sm">
          <label className="flex flex-col gap-1 text-sm font-bold text-ink">
            Property
            <select
              value={selectedPropertyId}
              onChange={(e) => void handlePropertyChange(e.target.value)}
              required
              className="rounded-lg border border-mist px-3 py-2 font-sans text-ink"
            >
              <option value="">Select a property</option>
              {properties.map((property) => (
                <option key={property.id} value={property.id}>
                  {property.name}
                </option>
              ))}
            </select>
          </label>

          <label className="flex flex-col gap-1 text-sm font-bold text-ink">
            Unit
            <select
              value={selectedUnitId}
              onChange={(e) => setSelectedUnitId(e.target.value)}
              required
              disabled={units.length === 0}
              className="rounded-lg border border-mist px-3 py-2 font-sans text-ink"
            >
              <option value="">Select a unit</option>
              {units.map((unit) => (
                <option key={unit.id} value={unit.id}>
                  {unit.label}
                </option>
              ))}
            </select>
          </label>

          <label className="flex flex-col gap-1 text-sm font-bold text-ink">
            Tenant full name
            <input
              value={tenantFullName}
              onChange={(e) => setTenantFullName(e.target.value)}
              required
              className="rounded-lg border border-mist px-3 py-2 font-sans text-ink"
            />
          </label>

          <label className="flex flex-col gap-1 text-sm font-bold text-ink">
            Tenant email
            <input
              type="email"
              value={tenantEmail}
              onChange={(e) => setTenantEmail(e.target.value)}
              required
              className="rounded-lg border border-mist px-3 py-2 font-sans text-ink"
            />
          </label>

          <label className="flex flex-col gap-1 text-sm font-bold text-ink">
            Tenant phone <span className="font-normal text-ink/60">(optional)</span>
            <input
              type="tel"
              value={tenantPhone}
              onChange={(e) => setTenantPhone(e.target.value)}
              className="rounded-lg border border-mist px-3 py-2 font-sans text-ink"
            />
          </label>

          <label className="flex flex-col gap-1 text-sm font-bold text-ink">
            Start date
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              required
              className="rounded-lg border border-mist px-3 py-2 font-sans text-ink"
            />
          </label>

          {formError && <p className="text-sm font-bold text-red-600">{formError}</p>}

          <button
            type="submit"
            disabled={submitting}
            className="mt-2 rounded-xl bg-trust-blue px-5 py-3 font-display font-extrabold text-white disabled:opacity-60"
          >
            {submitting ? "Creating..." : "Create tenancy"}
          </button>
        </form>
      )}

      <div className="mt-6">
        {loading && <p className="text-ink">Loading...</p>}
        {loadError && <p className="text-sm font-bold text-red-600">{loadError}</p>}
        {!loading && !loadError && tenancies.length === 0 && (
          <p className="text-ink">No tenancies yet.</p>
        )}

        <ul className="flex flex-col gap-3">
          {tenancies.map((tenancy) => (
            <li key={tenancy.id} className="rounded-xl bg-white p-4 shadow-sm">
              <p className="font-display font-extrabold text-night-blue">
                {tenancy.tenant?.fullName} - {tenancy.unit?.property.name} ({tenancy.unit?.label})
              </p>
              <p className="text-sm text-ink">
                NGN {Number(tenancy.rentAmount).toLocaleString()} / {tenancy.rentFrequency.toLowerCase()} - {tenancy.status}
              </p>
              <Link
                to={`/landlord/tenancies/${tenancy.id}`}
                className="mt-2 inline-block text-sm font-bold text-trust-blue hover:underline"
              >
                View payments
              </Link>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
