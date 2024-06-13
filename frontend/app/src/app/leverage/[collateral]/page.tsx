export function generateStaticParams() {
  return [
    "eth",
    "reth",
    "wsteth",
  ].map((s) => ({ collateral: s }));
}

export default function Page() {
  // see layout in parent folder
  return null;
}
