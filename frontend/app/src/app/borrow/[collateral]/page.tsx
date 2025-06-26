export function generateStaticParams() {
  return [
    { collateral: "eth" },
    { collateral: "weth" },
    { collateral: "wsteth" },
    { collateral: "reth" },
    { collateral: "rseth" },
    { collateral: "weeth" },
    { collateral: "arb" },
    { collateral: "comp" },
    { collateral: "tbtc" },
  ];
}

export default function BorrowCollateralPage() {
  // see layout in parent folder
  return null;
}
