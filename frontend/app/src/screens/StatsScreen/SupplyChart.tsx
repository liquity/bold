import { fmtnum } from "@/src/formatting";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";

type SupplyChartProps = {
  data: {
    day: string;
    holders: string;
    supply: string;
  }[];
};

export default function SupplyChart({ data }: SupplyChartProps) {
  const day_supply = [...data].reverse().map((item) => ({
    day: item.day.split(" ")[0],
    supply: parseFloat(fmtnum(Number(item.supply), "2z").replace(/,/g, "")),
    holders: parseFloat(fmtnum(Number(item.holders), "2z").replace(/,/g, "")),
  }));

  return (
    <>
      <div
        style={{
          width: "100%",
          display: "flex",
          flexDirection: "row",
          height: 700,
          gap: 32,
        }}
      >
        <div
          style={{
            width: "50%",
            height: "100%",
          }}
        >
          <h2 style={{ fontSize: 20, fontWeight: 600, margin: 0 }}>
            bvUSD Supply
          </h2>

          <ResponsiveContainer width="100%" height="70%">
            <LineChart data={day_supply}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="day" tick={{ fontSize: 12 }} />
              <YAxis
                tickFormatter={(value) => {
                  if (value >= 1_000_000)
                    return `${(value / 1_000_000).toFixed(1)}M`;
                  if (value >= 1_000) return `${(value / 1_000).toFixed(1)}K`;
                  return value.toString();
                }}
                domain={["auto", "auto"]}
              />
              <Tooltip />
              <Line
                type="monotone"
                dataKey="supply"
                stroke="#8884d8"
                strokeWidth={2}
                dot={false}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
        <div
          style={{
            width: "50%",
            height: "100%",
          }}
        >
          <h2 style={{ fontSize: 20, fontWeight: 600, margin: 0 }}>
            bvUSD Holders
          </h2>

          <ResponsiveContainer width="100%" height="70%">
            <LineChart data={day_supply}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="day" tick={{ fontSize: 12 }} />
              <YAxis tickFormatter={(value) => {
                  if (value >= 1_000_000)
                    return `${(value / 1_000_000).toFixed(1)}M`;
                  if (value >= 1_000) return `${(value / 1_000).toFixed(1)}K`;
                  return value.toString();
                }}/>
              <Tooltip />
              <Line
                type="monotone"
                dataKey="holders"
                stroke="#8884d8"
                strokeWidth={2}
                dot={false}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>
    </>
  );
}
