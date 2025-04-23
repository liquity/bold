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

type CRProps = {
  data: {
    day: string;
    collateral_ratio: string;
  }[];
  title: string;
};

export default function CollateralRatioChart({ data, title }: CRProps) {
  const day_CR = [...data].reverse().map((item) => ({
    day: item.day.split(" ")[0],
    CR: parseFloat(fmtnum(Number(item.collateral_ratio)).replace(/,/g, "")),
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
            width: "100%",
            height: "100%",
          }}
        >
          <h2 style={{ fontSize: 20, fontWeight: 600, margin: 0, textAlign: "center"}}>{title}</h2>

          <ResponsiveContainer width="100%" height="70%">
            <LineChart data={day_CR}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="day" tick={{ fontSize: 12 }} />
              <YAxis domain={["auto", "auto"]} tickFormatter={(value) => `${value.toFixed(0)}%`} />
              <Tooltip />
              <Line
                type="basis"
                dataKey="CR"
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
