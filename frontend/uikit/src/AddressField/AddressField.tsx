"use client";

import type { ComponentPropsWithoutRef } from "react";
import type { Address } from "../types";

import { a, useTransition } from "@react-spring/web";
import { blo } from "blo";
import { useEffect } from "react";
import { css, cx } from "../../styled-system/css";
import { isAddress } from "../eth-utils";
import { IconSearch } from "../icons";
import { TextInput } from "../Input/TextInput";

export function AddressField({
  className,
  onAddressChange,
  onChange,
  value,
  ...props
}: Omit<ComponentPropsWithoutRef<"input">, "onChange"> & {
  onAddressChange?: (address: Address | null) => void;
  onChange?: (value: string) => void;
  value?: string;
}) {
  const address = parseAddress(value);

  useEffect(() => {
    onAddressChange?.(address);
  }, [address, onAddressChange]);

  const iconTransition = useTransition(address, {
    from: { opacity: 0, transform: "scale(0.7)" },
    enter: { opacity: 1, transform: "scale(1)" },
    leave: { opacity: 0, immediate: true },
    config: {
      mass: 1,
      tension: 2000,
      friction: 80,
    },
  });

  return (
    <div
      className={cx(
        className,
        css({
          position: "relative",
        }),
      )}
    >
      <div
        className={css({
          position: "absolute",
          left: 12,
          display: "grid",
          placeItems: "center",
          width: 24,
          height: "100%",
          color: "contentAlt",
        })}
      >
        <div
          className={css({
            position: "relative",
            display: "grid",
            placeItems: "center",
            width: "100%",
            height: 24,
          })}
        >
          {iconTransition((style, address) => (
            <a.div
              className={css({
                position: "absolute",
                inset: 0,
              })}
              style={style}
            >
              {address
                ? (
                  <img
                    alt=""
                    src={blo(address)}
                    width={24}
                    height={24}
                    className={css({
                      display: "block",
                      borderRadius: 4,
                    })}
                  />
                )
                : <IconSearch size={24} />}
            </a.div>
          ))}
        </div>
      </div>
      <TextInput
        placeholder="Enter delegate address"
        onChange={onChange}
        value={value}
        {...props}
        className={css({
          width: "100%",
          paddingLeft: 48,
        })}
      />
    </div>
  );
}

function parseAddress(value: string = "") {
  value = value.trim();
  return isAddress(value) ? value : null;
}
