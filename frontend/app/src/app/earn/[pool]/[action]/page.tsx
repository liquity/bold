const actions = ["deposit", "withdraw", "claim"] as const;

export function generateStaticParams() {
  return actions.map((action) => ({ action }));
}

export default function Page() {
  // see layout in the parent folder
  return null;
}
