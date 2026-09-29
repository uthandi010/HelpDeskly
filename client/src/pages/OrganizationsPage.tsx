import { useEffect, useState } from "react";
import type { FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import { Plus, Ticket, Users } from "lucide-react";
import { NavBar } from "../components/NavBar";
import * as organizationsApi from "../api/organizations";
import type { OrganizationSummary } from "../types";
import { ApiError } from "../api/client";

function slugify(value: string): string {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export function OrganizationsPage() {
  const navigate = useNavigate();
  const [organizations, setOrganizations] = useState<OrganizationSummary[] | null>(null);
  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    organizationsApi
      .listOrganizations()
      .then(setOrganizations)
      .catch((err) => setError(err instanceof ApiError ? err.message : "Failed to load your organizations."));
  }, []);

  function handleNameChange(value: string) {
    setName(value);
    setSlug(slugify(value));
  }

  async function handleCreate(event: FormEvent) {
    event.preventDefault();
    if (!name.trim() || !slug.trim()) return;

    setCreating(true);
    setError(null);
    try {
      const org = await organizationsApi.createOrganization(name.trim(), slug.trim());
      setOrganizations((current) => (current ? [...current, org] : [org]));
      setName("");
      setSlug("");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not create that organization.");
    } finally {
      setCreating(false);
    }
  }

  return (
    <div className="page">
      <NavBar />
      <main className="page-content">
        <div className="page-header">
          <h1>Your support teams</h1>
          <p>Each organization has its own tickets, members, and a public support page.</p>
        </div>

        <form className="inline-form" onSubmit={handleCreate}>
          <input type="text" placeholder="Team name" value={name} onChange={(e) => handleNameChange(e.target.value)} />
          <input type="text" placeholder="url-slug" value={slug} onChange={(e) => setSlug(e.target.value)} />
          <button type="submit" className="btn btn-primary" disabled={creating}>
            <Plus size={16} />
            Create team
          </button>
        </form>

        {error && (
          <div className="form-error" role="alert">
            {error}
          </div>
        )}

        {organizations === null ? (
          <p className="muted">Loading...</p>
        ) : organizations.length === 0 ? (
          <p className="muted">You're not part of a support team yet. Create one above.</p>
        ) : (
          <div className="card-grid">
            {organizations.map((org) => (
              <button
                key={org.id}
                type="button"
                className="org-card"
                onClick={() => navigate(`/organizations/${org.id}`)}
              >
                <span className={`role-badge role-${org.myRole}`}>{org.myRole}</span>
                <h2>{org.name}</h2>
                <div className="org-card-stats">
                  <span>
                    <Ticket size={14} /> {org.ticketCount} ticket{org.ticketCount === 1 ? "" : "s"}
                  </span>
                  <span>
                    <Users size={14} /> {org.memberCount} member{org.memberCount === 1 ? "" : "s"}
                  </span>
                </div>
              </button>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
