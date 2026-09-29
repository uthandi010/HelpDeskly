import { useEffect, useState } from "react";
import type { FormEvent } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { ArrowLeft, Send } from "lucide-react";
import { NavBar } from "../components/NavBar";
import * as ticketsApi from "../api/tickets";
import type { TicketDetail, TicketPriority, TicketStatus } from "../types";
import { ApiError } from "../api/client";

const STATUSES: TicketStatus[] = ["open", "pending", "resolved", "closed"];
const PRIORITIES: TicketPriority[] = ["low", "medium", "high", "urgent"];

export function TicketDetailPage() {
  const { ticketId } = useParams<{ ticketId: string }>();
  const id = ticketId!;
  const navigate = useNavigate();

  const [ticket, setTicket] = useState<TicketDetail | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [reply, setReply] = useState("");
  const [sending, setSending] = useState(false);

  async function load() {
    try {
      const detail = await ticketsApi.getTicket(id);
      setTicket(detail);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to load this ticket.");
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  async function handleStatusChange(status: TicketStatus) {
    try {
      const updated = await ticketsApi.updateTicket(id, { status });
      setTicket((current) => (current ? { ...current, status: updated.status } : current));
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not update status.");
    }
  }

  async function handlePriorityChange(priority: TicketPriority) {
    try {
      const updated = await ticketsApi.updateTicket(id, { priority });
      setTicket((current) => (current ? { ...current, priority: updated.priority } : current));
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not update priority.");
    }
  }

  async function handleReply(event: FormEvent) {
    event.preventDefault();
    if (!reply.trim()) return;

    setSending(true);
    setError(null);
    try {
      await ticketsApi.addMessage(id, reply.trim());
      setReply("");
      await load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not send that reply.");
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="page">
      <NavBar />
      <main className="page-content">
        <button type="button" className="btn btn-ghost back-link" onClick={() => navigate(-1)}>
          <ArrowLeft size={16} /> Back
        </button>

        {error && (
          <div className="form-error" role="alert">
            {error}
          </div>
        )}

        {ticket && (
          <>
            <div className="page-header">
              <h1>{ticket.subject}</h1>
              <p>
                From {ticket.customerName} &lt;{ticket.customerEmail}&gt;
              </p>
            </div>

            <div className="ticket-controls">
              <label>
                <span>Status</span>
                <select value={ticket.status} onChange={(e) => handleStatusChange(e.target.value as TicketStatus)}>
                  {STATUSES.map((status) => (
                    <option key={status} value={status}>
                      {status}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                <span>Priority</span>
                <select
                  value={ticket.priority}
                  onChange={(e) => handlePriorityChange(e.target.value as TicketPriority)}
                >
                  {PRIORITIES.map((priority) => (
                    <option key={priority} value={priority}>
                      {priority}
                    </option>
                  ))}
                </select>
              </label>
            </div>

            <div className="ticket-thread">
              {ticket.messages.map((message) => (
                <div key={message.id} className={`ticket-message ${message.authorType}`}>
                  <div className="ticket-message-meta">
                    <strong>{message.authorName}</strong>
                    <span className="muted">{new Date(message.createdAt).toLocaleString()}</span>
                  </div>
                  <p>{message.body}</p>
                </div>
              ))}
            </div>

            <form className="reply-form" onSubmit={handleReply}>
              <textarea
                value={reply}
                onChange={(e) => setReply(e.target.value)}
                rows={3}
                placeholder="Write a reply..."
              />
              <button type="submit" className="btn btn-primary" disabled={sending}>
                <Send size={16} />
                {sending ? "Sending..." : "Send reply"}
              </button>
            </form>
          </>
        )}
      </main>
    </div>
  );
}
