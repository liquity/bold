import type { ReactNode } from "react";

import { useEffect, useState } from "react";

export function ShowAfter({
  children,
  delay,
}: {
  children: ReactNode;
  delay: number;
}) {
  const [show, setShow] = useState(false);

  useEffect(() => {
    const timeout = setTimeout(() => {
      setShow(true);
    }, delay);
    return () => {
      clearTimeout(timeout);
    };
  }, [delay]);

  return show ? children : null;
}
