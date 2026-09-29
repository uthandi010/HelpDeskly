import { useEffect, useState } from "react";
import {
  AreaChart,
  Area,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  LabelList,
} from "recharts";
import * as organizationsApi from "../api/organizations";
import type { MetricsSummary } from "../types";
import { ApiError } from "../api/client";

function formatShortDate(isoDate: string): string {
  return new Date(`${isoDate}T00:00:00`).toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

function DailyTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;
  return (
    <div className="chart-tooltip">
      <div className="chart-tooltip-label">{formatShortDate(label)}</div>
      <div className="chart-tooltip-value">{payload[0].value} tickets</div>
    </div>
  );
}

function BreakdownTooltip({ active, payload }: any) {
  if (!active || !payload?.length) return null;
  const row = payload[0].payload;
  return (
    <div className="chart-tooltip">
      <div className="chart-tooltip-label">{row.label}</div>
      <div className="chart-tooltip-value">{row.count} tickets</div>
    </div>
  );
}

export function MetricsPanel({ organizationId }: { organizationId: string }) {
  const [metrics, setMetrics] = useState<MetricsSummary | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    organizationsApi
      .getMetrics(organizationId)
      .then(setMetrics)
      .catch((err) => setError(err instanceof ApiError ? err.message : "Failed to load metrics."));
  }, [organizationId]);

  if (error) {
    return (
      <div className="form-error" role="alert">
        {error}
      </div>
    );
  }

  if (!metrics) {
    return <p className="muted">Loading metrics...</p>;
  }

  const active = metrics.byStatus.open + metrics.byStatus.pending;
  const done = metrics.byStatus.resolved + metrics.byStatus.closed;

  const statusData = (["open", "pending", "resolved", "closed"] as const).map((status) => ({
    label: status.charAt(0).toUpperCase() + status.slice(1),
    count: metrics.byStatus[status],
  }));
  const priorityData = (["urgent", "high", "medium", "low"] as const).map((priority) => ({
    label: priority.charAt(0).toUpperCase() + priority.slice(1),
    count: metrics.byPriority[priority],
  }));

  return (
    <div>
      <div className="stat-tiles">
        <div className="stat-tile">
          <span className="stat-label">Total tickets</span>
          <span className="stat-value">{metrics.totalTickets}</span>
        </div>
        <div className="stat-tile">
          <span className="stat-label">Active</span>
          <span className="stat-value">{active}</span>
        </div>
        <div className="stat-tile">
          <span className="stat-label">Resolved / closed</span>
          <span className="stat-value">{done}</span>
        </div>
      </div>

      <div className="chart-card">
        <h2>Tickets, last 30 days</h2>
        <ResponsiveContainer width="100%" height={220}>
          <AreaChart data={metrics.ticketsByDay} margin={{ top: 8, right: 12, bottom: 0, left: 0 }}>
            <CartesianGrid stroke="var(--chart-grid)" vertical={false} />
            <XAxis
              dataKey="date"
              tickFormatter={formatShortDate}
              tick={{ fill: "var(--chart-muted)", fontSize: 12 }}
              axisLine={{ stroke: "var(--chart-axis)" }}
              tickLine={false}
              interval={4}
            />
            <YAxis
              allowDecimals={false}
              tick={{ fill: "var(--chart-muted)", fontSize: 12 }}
              axisLine={false}
              tickLine={false}
              width={28}
            />
            <Tooltip content={<DailyTooltip />} />
            <Area
              type="monotone"
              dataKey="tickets"
              stroke="var(--chart-series-1)"
              strokeWidth={2}
              fill="var(--chart-series-1)"
              fillOpacity={0.1}
              activeDot={{ r: 4, stroke: "var(--chart-surface)", strokeWidth: 2 }}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>

      <div className="chart-grid-2">
        <div className="chart-card">
          <h2>By status</h2>
          <ResponsiveContainer width="100%" height={180}>
            <BarChart data={statusData} layout="vertical" margin={{ top: 4, right: 28, bottom: 4, left: 4 }} barSize={18}>
              <CartesianGrid stroke="var(--chart-grid)" horizontal={false} />
              <XAxis type="number" allowDecimals={false} hide />
              <YAxis
                type="category"
                dataKey="label"
                tick={{ fill: "var(--chart-text)", fontSize: 13 }}
                axisLine={false}
                tickLine={false}
                width={70}
              />
              <Tooltip content={<BreakdownTooltip />} cursor={{ fill: "var(--chart-grid)" }} />
              <Bar dataKey="count" fill="var(--chart-series-1)" radius={[0, 4, 4, 0]}>
                <LabelList dataKey="count" position="right" fill="var(--chart-text)" fontSize={12} />
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>

        <div className="chart-card">
          <h2>By priority</h2>
          <ResponsiveContainer width="100%" height={180}>
            <BarChart data={priorityData} layout="vertical" margin={{ top: 4, right: 28, bottom: 4, left: 4 }} barSize={18}>
              <CartesianGrid stroke="var(--chart-grid)" horizontal={false} />
              <XAxis type="number" allowDecimals={false} hide />
              <YAxis
                type="category"
                dataKey="label"
                tick={{ fill: "var(--chart-text)", fontSize: 13 }}
                axisLine={false}
                tickLine={false}
                width={70}
              />
              <Tooltip content={<BreakdownTooltip />} cursor={{ fill: "var(--chart-grid)" }} />
              <Bar dataKey="count" fill="var(--chart-series-1)" radius={[0, 4, 4, 0]}>
                <LabelList dataKey="count" position="right" fill="var(--chart-text)" fontSize={12} />
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
}
