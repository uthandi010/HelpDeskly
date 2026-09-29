import { Suspense, lazy, useCallback, useEffect, useState } from "react";
import type { FormEvent } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { Copy, Plus } from "lucide-react";
import { NavBar } from "../components/NavBar";
import * as organizationsApi from "../api/organizations";
import * as ticketsApi from "../api/tickets";
import { useAuth } from "../auth/AuthContext";
import type { MemberSummary, OrganizationSummary, Role, TicketStatus, TicketSummary } from "../types";
import { ApiError } from "../api/client";

// Recharts is the single heaviest dependency in the app - only the metrics
// tab needs it, so keep it out of the initial bundle.
const MetricsPanel = lazy(() =>
  import("../components/MetricsPanel").then((m) => ({ default: m.MetricsPanel }))
);

type Tab = "tickets" | "metrics" | "members";
const STATUS_FILTERS: (TicketStatus | "all")[] = ["all", "open", "pending", "resolved", "closed"];

export function OrganizationPage() {
  const { organizationId } = useParams<{ organizationId: string }>();
  const id = organizationId!;
  const navigate = useNavigate();
  const { user } = useAuth();

  const [activeTab, setActiveTab] = useState<Tab>("tickets");
  const [organization, setOrganization] = useState<OrganizationSummary | null>(null);
  const [members, setMembers] = useState<MemberSummary[] | null>(null);
  const [tickets, setTickets] = useState<TicketSummary[] | null>(null);
  const [statusFilter, setStatusFilter] = useState<TicketStatus | "all">("all");
  const [error, setError] = useState<string | null>(null);

  const isAdmin = organization?.myRole === "admin";
  const supportUrl = organization ? `${window.location.origin}/support/${organization.slug}` : "";

  const loadTickets = useCallback(async () => {
    try {
      const list = await ticketsApi.listTickets(id, statusFilter === "all" ? {} : { status: statusFilter });
      setTickets(list);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to load tickets.");
    }
  }, [id, statusFilter]);

  useEffect(() => {
    organizationsApi
      .getOrganization(id)
      .then(setOrganization)
      .catch((err) => setError(err instanceof ApiError ? err.message : "Failed to load this team."));
    organizationsApi.listMembers(id).then(setMembers).catch(() => {});
  }, [id]);

  useEffect(() => {
    loadTickets();
  }, [loadTickets]);

  function copySupportLink() {
    navigator.clipboard?.writeText(supportUrl);
  }

  // ----- Invite -----
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState<Role>("agent");
  const [inviteError, setInviteError] = useState<string | null>(null);

  async function handleInvite(event: FormEvent) {
    event.preventDefault();
    setInviteError(null);
    if (!inviteEmail.trim()) return;
    try {
      const member = await organizationsApi.inviteMember(id, inviteEmail.trim(), inviteRole);
      setMembers((current) => (current ? [...current, member] : [member]));
      setInviteEmail("");
    } catch (err) {
      setInviteError(err instanceof ApiError ? err.message : "Could not invite that person.");
    }
  }

  return (
    <div className="page">
      <NavBar />
      <main className="page-content">
        {error && (
          <div className="form-error" role="alert">
            {error}
          </div>
        )}

        {organization && (
          <>
            <div className="page-header">
              <h1>{organization.name}</h1>
              <p>
                Support page:{" "}
                <a href={supportUrl} target="_blank" rel="noopener noreferrer">
                  {supportUrl}
                </a>
                <button type="button" className="btn btn-ghost" onClick={copySupportLink}>
                  <Copy size={14} /> Copy
                </button>
              </p>
            </div>

            <div className="tabs">
              {(["tickets", "metrics", "members"] as Tab[]).map((tab) => (
                <button
                  key={tab}
                  type="button"
                  className={`tab-button ${activeTab === tab ? "active" : ""}`}
                  onClick={() => setActiveTab(tab)}
                >
                  {tab.charAt(0).toUpperCase() + tab.slice(1)}
                </button>
              ))}
            </div>

            {activeTab === "tickets" && (
              <section>
                <div className="filter-row">
                  {STATUS_FILTERS.map((status) => (
                    <button
                      key={status}
                      type="button"
                      className={`filter-chip ${statusFilter === status ? "active" : ""}`}
                      onClick={() => setStatusFilter(status)}
                    >
                      {status.charAt(0).toUpperCase() + status.slice(1)}
                    </button>
                  ))}
                </div>

                {tickets === null ? (
                  <p className="muted">Loading tickets...</p>
                ) : tickets.length === 0 ? (
                  <p className="muted">No tickets here.</p>
                ) : (
                  <table className="data-table">
                    <thead>
                      <tr>
                        <th>Subject</th>
                        <th>Customer</th>
                        <th>Status</th>
                        <th>Priority</th>
                        <th>Assignee</th>
                      </tr>
                    </thead>
                    <tbody>
                      {tickets.map((ticket) => (
                        <tr key={ticket.id} onClick={() => navigate(`/tickets/${ticket.id}`)} className="clickable-row">
                          <td>{ticket.subject}</td>
                          <td>{ticket.customerName}</td>
                          <td>
                            <span className={`status-pill status-${ticket.status}`}>{ticket.status}</span>
                          </td>
                          <td>
                            <span className={`priority-pill priority-${ticket.priority}`}>{ticket.priority}</span>
                          </td>
                          <td>{ticket.assigneeName ?? <span className="muted">Unassigned</span>}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </section>
            )}

            {activeTab === "metrics" && (
              <Suspense fallback={<p className="muted">Loading metrics...</p>}>
                <MetricsPanel organizationId={id} />
              </Suspense>
            )}

            {activeTab === "members" && (
              <section>
                {isAdmin && (
                  <form className="inline-form" onSubmit={handleInvite}>
                    <input
                      type="email"
                      placeholder="teammate@example.com"
                      value={inviteEmail}
                      onChange={(e) => setInviteEmail(e.target.value)}
                    />
                    <select value={inviteRole} onChange={(e) => setInviteRole(e.target.value as Role)}>
                      <option value="agent">Agent</option>
                      <option value="admin">Admin</option>
                    </select>
                    <button type="submit" className="btn btn-primary">
                      <Plus size={16} /> Invite
                    </button>
                  </form>
                )}
                {isAdmin && <p className="muted">They need an existing account with that email.</p>}
                {inviteError && (
                  <div className="form-error" role="alert">
                    {inviteError}
                  </div>
                )}

                {members && (
                  <table className="data-table">
                    <thead>
                      <tr>
                        <th>Name</th>
                        <th>Email</th>
                        <th>Role</th>
                      </tr>
                    </thead>
                    <tbody>
                      {members.map((member) => (
                        <tr key={member.userId}>
                          <td>
                            {member.name}
                            {member.userId === user?.userId && <span className="muted"> (you)</span>}
                          </td>
                          <td>{member.email}</td>
                          <td>
                            <span className={`role-badge role-${member.role}`}>{member.role}</span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </section>
            )}
          </>
        )}
      </main>
    </div>
  );
}
