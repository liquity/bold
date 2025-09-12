import type { FC } from 'react';
import { css } from '@/styled-system/css';
import { LinkTextButton } from '@/src/comps/LinkTextButton/LinkTextButton.tsx';
import content from '@/src/content.tsx';

export const Hint: FC = () => {
  return  <div
    className={css({
      width: "100%",
      display: "flex",
      justifyContent: "space-between",
      alignItems: "center",
      gap: 16,
      padding: "10px 16px 0",
      whiteSpace: "nowrap",
      background: "#F7F7FF",
      borderRadius: 8,
      userSelect: "none",
      transform: "translateY(-10px)",
    })}
  >
    <span
      title={content.home.yieldTable.hint.title}
      className={css({
        overflow: "hidden",
        textOverflow: "ellipsis",
        lineHeight: "44px",
        fontSize: 14,
      })}
    >
      {content.home.yieldTable.hint.title}
    </span>
    <LinkTextButton
      external
      href={content.home.yieldTable.hint.url}
      label={content.home.yieldTable.hint.label}
      title={content.home.yieldTable.hint.label}
      className={css({
        fontSize: 14,
      })}
    >
      Learn more
    </LinkTextButton>
  </div>
}
