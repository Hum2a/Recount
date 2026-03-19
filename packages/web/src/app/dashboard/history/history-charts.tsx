"use client";

import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

type Row = { date: string; minutes: number };

export function HistoryCharts({ data }: { data: Row[] }) {
  if (data.length === 0) {
    return <p className="text-sm text-muted">No summary data for this range.</p>;
  }
  return (
    <div className="h-72 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data}>
          <CartesianGrid strokeDasharray="3 3" stroke="#27272a" />
          <XAxis dataKey="date" tick={{ fill: "#a1a1aa", fontSize: 11 }} />
          <YAxis tick={{ fill: "#a1a1aa", fontSize: 11 }} />
          <Tooltip
            contentStyle={{ background: "#18181b", border: "1px solid #3f3f46" }}
            labelStyle={{ color: "#fafafa" }}
          />
          <Bar dataKey="minutes" fill="#3b82f6" radius={[4, 4, 0, 0]} name="Active min" />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
