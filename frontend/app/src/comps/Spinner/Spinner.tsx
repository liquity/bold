import { a, useSpring } from "@react-spring/web";

export function Spinner({
  size = 24,
}: {
  size?: number;
}) {
  const spring = useSpring({
    from: { rotate: 0 },
    to: { rotate: 360 },
    loop: true,
    config: {
      duration: 1000,
    },
  });
  return (
    <a.svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      style={{
        transform: spring.rotate.to((r) => `rotate(${r}deg)`),
      }}
    >
      <circle
        cx="12"
        cy="12"
        r="10"
        fill="none"
        stroke="currentColor"
        strokeDasharray="40"
        strokeDashoffset="0"
        strokeWidth="2"
      />
    </a.svg>
  );
}
