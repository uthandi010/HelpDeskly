import { apiRequest } from "./client";
import type { TicketDetail, TicketMessage, TicketPriority, TicketStatus, TicketSummary } from "../types";

export interface TicketFilters {
  status?: TicketStatus;
  priority?: TicketPriority;
  assigneeId?: string;
}

export function listTickets(organizationId: string, filters: TicketFilters = {}): Promise<TicketSummary[]> {
  const params = new URLSearchParams();
  if (filters.status) params.set("status", filters.status);
  if (filters.priority) params.set("priority", filters.priority);
  if (filters.assigneeId) params.set("assigneeId", filters.assigneeId);
  const query = params.toString();
  return apiRequest<TicketSummary[]>(`/api/organizations/${organizationId}/tickets${query ? `?${query}` : ""}`);
}

export function createTicket(
  organizationId: string,
  input: { subject: string; customerName: string; customerEmail: string; message: string }
): Promise<TicketSummary> {
  return apiRequest<TicketSummary>(`/api/organizations/${organizationId}/tickets`, {
    method: "POST",
    body: input,
  });
}

export function getTicket(ticketId: string): Promise<TicketDetail> {
  return apiRequest<TicketDetail>(`/api/tickets/${ticketId}`);
}

export interface UpdateTicketInput {
  status?: TicketStatus;
  priority?: TicketPriority;
  assigneeId?: string | null;
}

export function updateTicket(ticketId: string, updates: UpdateTicketInput): Promise<TicketSummary> {
  return apiRequest<TicketSummary>(`/api/tickets/${ticketId}`, { method: "PATCH", body: updates });
}

export function addMessage(ticketId: string, body: string): Promise<TicketMessage> {
  return apiRequest<TicketMessage>(`/api/tickets/${ticketId}/messages`, { method: "POST", body: { body } });
}
