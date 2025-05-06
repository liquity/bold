import { useAbout } from "@/src/comps/About/About";
import { css } from "@/styled-system/css";
import { TextButton } from "@liquity2/uikit";

export function AboutButton({
  onClick,
}: {
  onClick?: () => void;
}) {
  const about = useAbout();
  return (
    <TextButton
      label={about.fullVersion}
      title={`About Liquity V2 App ${about.fullVersion}`}
      onClick={() => {
        about.openModal();
        onClick?.();
      }}
      className={css({
        color: "dimmed",
      })}
      style={{
        fontSize: 12,
      }}
    />
  );
}
