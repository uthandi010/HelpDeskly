import { useEffect, useState } from "react";
import type { FormEvent } from "react";
import { useParams, useSearchParams } from "react-router-dom";
import { Send } from "lucide-react";
import * as publicApi from "../api/public";
import type { PublicTicket } from "../api/public";
import { ApiError } from "../api/client";

export function PublicTicketPage() {
  const { ticketId } = useParams<{ ticketId: string }>();
  const [searchParams] = useSearchParams();
  const id = ticketId!;

  const [email, setEmail] = useState(searchParams.get("email") ?? "");
  const [emailInput, setEmailInput] = useState(email);
  const [ticket, setTicket] = useState<PublicTicket | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [reply, setReply] = useState("");
  const [sending, setSending] = useState(false);

  async function load(currentEmail: string) {
    setError(null);
    try {
      const result = await publicApi.getPublicTicket(id, currentEmail);
      setTicket(result);
    } catch (err) {
      setTicket(null);
      setError(err instanceof ApiError ? err.message : "Ticket not found.");
    }
  }

  useEffect(() => {
    if (email) {
      load(email);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  function handleLookup(event: FormEvent) {
    event.preventDefault();
    if (!emailInput.trim()) return;
    setEmail(emailInput.trim());
    load(emailInput.trim());
  }

  async function handleReply(event: FormEvent) {
    event.preventDefault();
    if (!reply.trim()) return;

    setSending(true);
    try {
      await publicApi.replyToTicket(id, email, reply.trim());
      setReply("");
      await load(email);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not send that reply.");
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="public-page">
      <div className="public-card">
        <div className="public-header">
          <h1>Track your ticket</h1>
        </div>

        {!ticket && (
          <form className="public-form" onSubmit={handleLookup}>
            <label className="field">
              <span>Your email</span>
              <input type="email" value={emailInput} onChange={(e) => setEmailInput(e.target.value)} />
            </label>
            {error && (
              <div className="form-error" role="alert">
                {error}
              </div>
            )}
            <button type="submit" className="btn btn-primary">
              Look up ticket
            </button>
          </form>
        )}

        {ticket && (
          <>
            <div className="page-header">
              <h2>{ticket.subject}</h2>
              <span className={`status-pill status-${ticket.status}`}>{ticket.status}</span>
            </div>

            <div className="ticket-thread">
              {ticket.messages.map((message) => (
                <div key={message.id} className={`ticket-message ${message.authorType}`}>
                  <div className="ticket-message-meta">
                    <strong>{message.authorType === "agent" ? message.authorName : "You"}</strong>
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
                placeholder="Add a reply..."
              />
              <button type="submit" className="btn btn-primary" disabled={sending}>
                <Send size={16} />
                {sending ? "Sending..." : "Send"}
              </button>
            </form>
          </>
        )}
      </div>
    </div>
  );
}
