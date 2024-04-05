import type { ReactNode } from "react";

function IconBase({
  children,
  color = "currentColor",
}: {
  children: ReactNode;
  color?: string;
}) {
  return (
    <svg
      width="16"
      height="16"
      style={{ fill: color }}
    >
      {children}
    </svg>
  );
}

export function IconEarn({ color }: { color?: string }) {
  return (
    <IconBase color={color}>
      <path
        fillRule="evenodd"
        clipRule="evenodd"
        d="M15 1H1V15H15V1ZM8 12C10.2091 12 12 10.2091 12 8C12 5.79086 10.2091 4 8 4C5.79086 4 4 5.79086 4 8C4 10.2091 5.79086 12 8 12Z"
      />
    </IconBase>
  );
}

export function IconBold({ color }: { color?: string }) {
  return (
    <IconBase color={color}>
      <path d="M1 1L6 1L1 6L1 1Z" />
      <path d="M1 15L6 15L1 10L1 15Z" />
      <path d="M15 1L10 1L15 6L15 1Z" />
      <circle cx="8" cy="8" r="4" />
      <path d="M15 15L10 15L15 10L15 15Z" />
    </IconBase>
  );
}

export function IconBorrow({ color }: { color?: string }) {
  return (
    <IconBase color={color}>
      <path d="M5.94975 12.9497C4.63699 14.2625 2.85652 15 1 15L1 1C2.85652 1 4.63699 1.7375 5.94975 3.05025C7.2625 4.36301 8 6.14349 8 8C8 9.85652 7.2625 11.637 5.94975 12.9497Z" />
      <path d="M8 8C8 6.14349 8.7375 4.36301 10.0503 3.05025C11.363 1.7375 13.1435 1 15 1V15C13.1435 15 11.363 14.2625 10.0503 12.9497C8.7375 11.637 8 9.85652 8 8Z" />
    </IconBase>
  );
}

export function IconPortfolio({ color }: { color?: string }) {
  return (
    <IconBase color={color}>
      <rect x="1.25" y="1.98145" width="4.939" height="5.22395" />
      <path d="M7.96094 4.69434L11.6548 1.00045L15.1472 4.69434L11.6548 8.18674L7.96094 4.69434Z" />
      <rect x="9.08594" y="10.2695" width="4.939" height="5.22395" />
      <rect x="1" y="10" width="5.5" height="5.5" rx="2.75" />
    </IconBase>
  );
}

export function IconAccount({ color }: { color?: string }) {
  return (
    <IconBase color={color}>
      <circle cx="8.45455" cy="5.45455" r="4.45455" />
      <rect x="4" y="9.90918" width="8.90909" height="5.09091" />
    </IconBase>
  );
}

export function IconStats({ color }: { color?: string }) {
  return (
    <IconBase color={color}>
      <rect x="1" y="11" width="4" height="4" />
      <rect x="6" y="11" width="4" height="4" />
      <rect x="6" y="6" width="4" height="4" />
      <rect x="11" y="11" width="4" height="4" />
      <rect x="11" y="6" width="4" height="4" />
      <rect x="11" y="1" width="4" height="4" />
    </IconBase>
  );
}
