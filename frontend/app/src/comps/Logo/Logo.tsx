export function Logo({ size = 32 }: { size?: number }) {
  return (
    <img
      src="/logo.png"        // put logo.png in /frontend/app/public
      alt="AustralFi"
      width={size}
      height={size}
    />
  );
}
