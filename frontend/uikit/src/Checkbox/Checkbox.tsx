"use client";

import type { ComponentPropsWithoutRef } from "react";

import { Radio } from "../Radio/Radio";

type RadioProps = ComponentPropsWithoutRef<typeof Radio>;

export function Checkbox({
  appearance = "checkbox",
  ...props
}:
  & Omit<RadioProps, "onChange">
  & {
    checked: NonNullable<RadioProps["checked"]>;
    onChange: NonNullable<RadioProps["onChange"]>;
  })
{
  return (
    <Radio
      appearance={appearance}
      {...props}
    />
  );
}
