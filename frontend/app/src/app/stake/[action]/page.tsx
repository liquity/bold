export function generateStaticParams() {
  return [
    { action: "deposit" },
    { action: "rewards" },
    { action: "voting" },
  ];
}

export default function Page() {
  // see layout in the parent folder
  return null;
}
