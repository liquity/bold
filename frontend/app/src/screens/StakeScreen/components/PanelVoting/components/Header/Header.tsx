import type { FC } from 'react';
import { css } from '@/styled-system/css';
import content from '@/src/content.tsx';

export const Header: FC = () => {
  return <header
    className={css({
      display: "flex",
      flexDirection: "column",
      gap: 20,
      paddingBottom: 32,
    })}
  >
    <h1
      className={css({
        fontSize: 20,
      })}
    >
      {content.stakeScreen.votingPanel.title}
    </h1>
    <div
      className={css({
        color: "contentAlt",
        fontSize: 14,
        "& a": {
          color: "accent",
          _focusVisible: {
            borderRadius: 2,
            outline: "2px solid token(colors.focused)",
            outlineOffset: 1,
          },
        },
      })}
    >
      {content.stakeScreen.votingPanel.intro}
    </div>
  </header>
}
