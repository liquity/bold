import { css } from "@/styled-system/css";

import type { FC } from 'react';

interface DisplayValueProps {
  value: string;
}

export const VoteDisplay: FC<DisplayValueProps> = ({value}) => {
  return <span className={css({
    width: 62,
    fontSize: 14,
    lineHeight: '32px',
    textAlign: "right",
    color: "disabledContent",
    paddingRight: 8,
  })}>{value}%</span>
}
