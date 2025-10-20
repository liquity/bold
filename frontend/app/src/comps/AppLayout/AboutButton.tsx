import { useAbout } from "@/src/comps/About/About";
import { WHITE_LABEL_CONFIG } from "@/src/white-label.config";
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
      title={`About ${WHITE_LABEL_CONFIG.branding.appName} App ${about.fullVersion}`}
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
