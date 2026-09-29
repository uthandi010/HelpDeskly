import { apiRequest } from "./client";
import type { PublicProfile } from "../types";

export function getPublicOrganization(slug: string): Promise<PublicProfile> {
  return apiRequest<PublicProfile>(`/api/public/organizations/${slug}`, { auth: false });
}

export function submitTicket(
  slug: string,
  input: { subject: string; customerName: string; customerEmail: string; message: string }
): Promise<{ id: string; subject: string; status: string }> {
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

export function getPublicTicket(ticketId: string, email: string): Promise<PublicTicket> {
  const params = new URLSearchParams({ email });
  return apiRequest<PublicTicket>(`/api/public/tickets/${ticketId}?${params}`, { auth: false });
}

export function replyToTicket(ticketId: string, email: string, body: string): Promise<PublicMessage> {
  const params = new URLSearchParams({ email });
  return apiRequest<PublicMessage>(`/api/public/tickets/${ticketId}/messages?${params}`, {
    method: "POST",
    body: { body },
    auth: false,
  });
}
