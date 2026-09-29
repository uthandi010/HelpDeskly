import { useEffect, useState } from "react";
import type { FormEvent } from "react";
import { Link, useParams } from "react-router-dom";
import * as publicApi from "../api/public";
import { ApiError } from "../api/client";

export function PublicSupportPage() {
  const { slug } = useParams<{ slug: string }>();
  const [orgName, setOrgName] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [subject, setSubject] = useState("");
  const [customerName, setCustomerName] = useState("");
  const [customerEmail, setCustomerEmail] = useState("");
  const [message, setMessage] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [confirmation, setConfirmation] = useState<{ id: string } | null>(null);

  useEffect(() => {
    if (!slug) return;
    publicApi
      .getPublicOrganization(slug)
      .then((org) => setOrgName(org.name))
      .catch((err) => setError(err instanceof ApiError ? err.message : "This support page doesn't exist."));
  }, [slug]);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    if (!slug) return;
    setError(null);

    if (!subject.trim() || !customerName.trim() || !customerEmail.trim() || !message.trim()) {
      setError("Please fill in every field.");
      return;
    }

    setSubmitting(true);
    try {
      const ticket = await publicApi.submitTicket(slug, {
        subject: subject.trim(),
        customerName: customerName.trim(),
        customerEmail: customerEmail.trim(),
        message: message.trim(),
      });
      setConfirmation({ id: ticket.id });
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not submit your ticket.");
    } finally {
      setSubmitting(false);
    }
  }

  if (error && !orgName) {
    return (
      <div className="public-page">
        <div className="form-error" role="alert">
          {error}
        </div>
      </div>
    );
  }

  return (
    <div className="public-page">
      <div className="public-card">
        <div className="public-header">
          <h1>{orgName ?? "Loading..."} Support</h1>
          <p className="muted">Tell us what's going on and we'll get back to you.</p>
        </div>

        {confirmation ? (
          <div className="confirmation-card">
            <h2>Ticket submitted</h2>
            <p>We'll email you at your provided address when there's an update.</p>
            <p className="muted">
              You can check on it anytime at{" "}
              <Link to={`/tickets/${confirmation.id}/track?email=${encodeURIComponent(customerEmail)}`}>
                this tracking link
              </Link>{" "}
              - save it, or just remember your ticket id: <code>{confirmation.id}</code>
            </p>
          </div>
        ) : (
          <form className="public-form" noValidate onSubmit={handleSubmit}>
            {error && (
              <div className="form-error" role="alert">
                {error}
              </div>
            )}

            <label className="field">
              <span>Your name</span>
              <input type="text" value={customerName} onChange={(e) => setCustomerName(e.target.value)} />
            </label>
            <label className="field">
              <span>Your email</span>
              <input type="email" value={customerEmail} onChange={(e) => setCustomerEmail(e.target.value)} />
            </label>
            <label className="field">
              <span>Subject</span>
              <input type="text" value={subject} onChange={(e) => setSubject(e.target.value)} />
            </label>
            <label className="field">
              <span>How can we help?</span>
              <textarea value={message} onChange={(e) => setMessage(e.target.value)} rows={4} />
            </label>

            <button type="submit" className="btn btn-primary" disabled={submitting}>
              {submitting ? "Submitting..." : "Submit ticket"}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
