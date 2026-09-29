export type Role = "agent" | "admin";
export type TicketStatus = "open" | "pending" | "resolved" | "closed";
export type TicketPriority = "low" | "medium" | "high" | "urgent";

export interface AuthResponse {
  token: string;
  userId: string;
  name: string;
  email: string;
}

export interface OrganizationSummary {
  id: string;
  name: string;
  slug: string;
  myRole: Role;
  memberCount: number;
  ticketCount: number;
}

export interface MemberSummary {
  userId: string;
  name: string;
  email: string;
  role: Role;
}

export interface TicketSummary {
  id: string;
  subject: string;
  customerName: string;
  customerEmail: string;
  status: TicketStatus;
  priority: TicketPriority;
  assigneeId: string | null;
  assigneeName: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface TicketMessage {
  id: string;
  authorType: "agent" | "customer";
  authorName: string;
  body: string;
  createdAt: string;
}

export interface TicketDetail extends TicketSummary {
  messages: TicketMessage[];
}

export interface MetricsSummary {
  totalTickets: number;
  byStatus: Record<TicketStatus, number>;
  byPriority: Record<TicketPriority, number>;
  ticketsByDay: { date: string; tickets: number }[];
}

export interface PublicProfile {
  name: string;
  slug: string;
}
