"use client";

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
} from "recharts";
import { formatPrice } from "@/lib/utils";

interface RevenueChartProps {
  data: any[];
}

const CustomTooltip = ({
  active,
  payload,
  label,
}: {
  active?: boolean;
  payload?: { value: number }[];
  label?: string;
}) => {
  if (active && payload && payload.length) {
    return (
      <div className="bg-white border border-gray-200 rounded-[6px] px-3 py-2 text-xs">
        <p className="font-medium text-gray-600 mb-1">{label}</p>
        <p className="font-grotesk font-bold text-blue">
          {formatPrice(payload[0].value)}
        </p>
      </div>
    );
  }
  return null;
};

export default function RevenueChart({ data }: RevenueChartProps) {
  return (
    <ResponsiveContainer width="100%" height={224}>
      <BarChart
        data={data}
        margin={{ top: 0, right: 0, left: 0, bottom: 0 }}
      >
        <CartesianGrid stroke="#E5E7EB" strokeWidth={1} vertical={false} />
        <XAxis
          dataKey="label"
          tick={{ fontSize: 11, fill: "#9BA3BF" }}
          axisLine={false}
          tickLine={false}
        />
        <YAxis
          tick={{ fontSize: 11, fill: "#9BA3BF" }}
          axisLine={false}
          tickLine={false}
          tickFormatter={(v) => `Rs ${(v / 1000).toFixed(0)}k`}
        />
        <Tooltip content={<CustomTooltip />} />
        <Bar
          dataKey="revenue"
          fill="#1A4BDB"
          radius={[2, 2, 0, 0]}
          maxBarSize={40}
        />
      </BarChart>
    </ResponsiveContainer>
  );
}
