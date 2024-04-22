import { Button } from "@liquity2/uikit";
import { useFixtureInput, useFixtureSelect } from "react-cosmos/client";

function ButtonDefault({
  defaultMode,
}: {
  defaultMode: "primary" | "secondary" | "positive" | "negative";
}) {
  const [label] = useFixtureInput("label", "Button");
  const [mode] = useFixtureSelect("mode", {
    options: ["primary", "secondary", "positive", "negative"],
    defaultValue: defaultMode,
  });
  const [size] = useFixtureSelect("size", {
    options: ["medium", "large"],
    defaultValue: "medium",
  });
  const [wide] = useFixtureInput("wide", false);
  return (
    <div
      style={{
        display: "flex",
        justifyContent: "center",
        width: "100%",
        padding: 16,
      }}
    >
      <Button
        label={label}
        mode={mode}
        size={size}
        wide={wide}
      />
    </div>
  );
}

export default {
  "Primary": () => <ButtonDefault defaultMode="primary" />,
  "Secondary": () => <ButtonDefault defaultMode="secondary" />,
  "Positive": () => <ButtonDefault defaultMode="positive" />,
  "Negative": () => <ButtonDefault defaultMode="negative" />,
};
