import { apiRequest } from "./client";
import type { PublicProfile } from "../types";

export function getPublicOrganization(slug: string): Promise<PublicProfile> {
  return apiRequest<PublicProfile>(`/api/public/organizations/${slug}`, { auth: false });
}

export function submitTicket(
  slug: string,
  input: { subject: string; customerName: string; customerEmail: string; message: string }
): Promise<{ id: string; subject: string; status: string; accessToken: string }> {
  return apiRequest(`/api/public/organizations/${slug}/tickets`, { method: "POST", body: input, auth: false });
}

interface PublicMessage {
  id: string;
  authorType: "agent" | "customer";
  authorName: string;
  body: string;
  createdAt: string;
}

export interface PublicTicket {
  id: string;
  subject: string;
  status: string;
  createdAt: string;
  messages: PublicMessage[];
}

// The access token travels in a header, never in the URL query string.
function tokenHeaders(token: string): Record<string, string> {
  return { "X-Ticket-Token": token };
}

export function getPublicTicket(ticketId: string, token: string): Promise<PublicTicket> {
  return apiRequest<PublicTicket>(`/api/public/tickets/${ticketId}`, { auth: false, headers: tokenHeaders(token) });
}

export function replyToTicket(ticketId: string, token: string, body: string): Promise<PublicMessage> {
  return apiRequest<PublicMessage>(`/api/public/tickets/${ticketId}/messages`, {
    method: "POST",
    body: { body },
    auth: false,
    headers: tokenHeaders(token),
  });
}
