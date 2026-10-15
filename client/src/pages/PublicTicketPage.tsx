import { useEffect, useState } from "react";
import type { FormEvent } from "react";
import { useLocation, useParams } from "react-router-dom";
import { Send } from "lucide-react";
import * as publicApi from "../api/public";
import type { PublicTicket } from "../api/public";
import { ApiError } from "../api/client";

export function PublicTicketPage() {
  const { ticketId } = useParams<{ ticketId: string }>();
  const location = useLocation();
  const id = ticketId!;

  // The access token lives in the URL fragment, which is never sent to a server.
  const [token, setToken] = useState(new URLSearchParams(location.hash.slice(1)).get("token") ?? "");
  const [tokenInput, setTokenInput] = useState(token);
  const [ticket, setTicket] = useState<PublicTicket | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [reply, setReply] = useState("");
  const [sending, setSending] = useState(false);

  async function load(currentToken: string) {
    setError(null);
    try {
      const result = await publicApi.getPublicTicket(id, currentToken);
      setTicket(result);
    } catch (err) {
      setTicket(null);
      setError(err instanceof ApiError ? err.message : "Ticket not found.");
    }
  }

  useEffect(() => {
    if (token) {
      load(token);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  function handleLookup(event: FormEvent) {
    event.preventDefault();
    if (!tokenInput.trim()) return;
    setToken(tokenInput.trim());
    load(tokenInput.trim());
  }

  async function handleReply(event: FormEvent) {
    event.preventDefault();
    if (!reply.trim()) return;

    setSending(true);
    try {
      await publicApi.replyToTicket(id, token, reply.trim());
      setReply("");
      await load(token);
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
              <span>Your access token</span>
              <input type="text" value={tokenInput} onChange={(e) => setTokenInput(e.target.value)} />
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
