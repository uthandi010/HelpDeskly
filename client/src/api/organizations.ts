import { apiRequest } from "./client";
import type { MemberSummary, MetricsSummary, OrganizationSummary, Role } from "../types";

export function listOrganizations(): Promise<OrganizationSummary[]> {
  return apiRequest<OrganizationSummary[]>("/api/organizations");
}

export function createOrganization(name: string, slug: string): Promise<OrganizationSummary> {
  return apiRequest<OrganizationSummary>("/api/organizations", { method: "POST", body: { name, slug } });
}

export function getOrganization(organizationId: string): Promise<OrganizationSummary> {
  return apiRequest<OrganizationSummary>(`/api/organizations/${organizationId}`);
}

export function listMembers(organizationId: string): Promise<MemberSummary[]> {
  return apiRequest<MemberSummary[]>(`/api/organizations/${organizationId}/members`);
}

export function inviteMember(organizationId: string, email: string, role: Role): Promise<MemberSummary> {
  return apiRequest<MemberSummary>(`/api/organizations/${organizationId}/members`, {
    method: "POST",
    body: { email, role },
  });
}

export function getMetrics(organizationId: string): Promise<MetricsSummary> {
  return apiRequest<MetricsSummary>(`/api/organizations/${organizationId}/metrics`);
}
