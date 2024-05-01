export function IconAccount({ color }: { color?: string }) {
  return (
    <svg width="16" height="16" style={{ fill: color }}>
      <circle cx="8.45455" cy="5.45455" r="4.45455" />
      <rect x="4" y="9.90918" width="8.90909" height="5.09091" />
    </svg>
  );
}

export function IconBorrow({ color }: { color?: string }) {
  return (
    <svg
      width="18"
      height="18"
      style={{ fill: color }}
    >
      <path d="M6.364 15.364A9 9 0 0 1 0 18V0a9 9 0 0 1 6.364 15.364Z" />
      <path d="M9 9a9 9 0 0 1 9-9v18a9 9 0 0 1-9-9Z" />
    </svg>
  );
}
export function IconLeverage({ color }: { color?: string }) {
  return (
    <svg width="18" height="18" style={{ fill: color }}>
      <path d="M0 11.572h6.429V18H0v-6.428ZM6.428 0h11.571v11.571H6.428V0Z" />
    </svg>
  );
}

export function IconEarn({ color }: { color?: string }) {
  return (
    <svg width="18" height="18" style={{ fill: color }}>
      <path
        fill-rule="evenodd"
        d="M18 0H0v18h18V0ZM9.001 14.143a5.143 5.143 0 1 0 0-10.286 5.143 5.143 0 0 0 0 10.286Z"
        clip-rule="evenodd"
      />
    </svg>
  );
}

export function IconStake({ color }: { color?: string }) {
  return (
    <svg width="18" height="18" style={{ fill: color }}>
      <path d="M6 12h6v6H6v-6ZM6 0h6v6H6V0ZM12 6h6v6h-6V6ZM0 6h6v6H0V6Z" />
    </svg>
  );
}
