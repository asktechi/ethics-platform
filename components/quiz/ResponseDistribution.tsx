"use client";

import { Bar, BarChart, ResponsiveContainer, XAxis, YAxis, Cell } from "recharts";

export function ResponseDistribution({
  choices,
  counts,
  revealed,
  correctKey,
}: {
  choices: Array<{ key: string; text: string }>;
  counts: Record<string, number>;
  revealed: boolean;
  correctKey: string | null;
}) {
  const total = Object.values(counts).reduce((sum, value) => sum + value, 0);
  const data = choices.map((choice) => ({
    key: choice.key,
    count: counts[choice.key] ?? 0,
    pct: total ? Math.round(((counts[choice.key] ?? 0) / total) * 100) : 0,
  }));

  return (
    <div className="h-40">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
          <XAxis dataKey="key" tick={{ fill: "#F4EFE4", fontSize: 12 }} />
          <YAxis allowDecimals={false} tick={{ fill: "#F4EFE4", fontSize: 10 }} width={24} />
          <Bar dataKey="count" radius={[3, 3, 0, 0]}>
            {data.map((entry) => {
              const fill = !revealed
                ? "#C9A227"
                : entry.key === correctKey
                  ? "#34d399"
                  : "#7f1d1d";
              return <Cell key={entry.key} fill={fill} />;
            })}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
      {revealed ? (
        <div className="mt-1 flex justify-around text-[11px] text-ivory/55">
          {data.map((entry) => (
            <span key={entry.key}>{entry.pct}%</span>
          ))}
        </div>
      ) : null}
    </div>
  );
}
