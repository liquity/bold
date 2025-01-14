import type { Dnum } from "dnum";

import { ADDRESS_ZERO, isAddress } from "@liquity2/uikit";
import * as dn from "dnum";
import { useMemo, useRef, useState } from "react";

const inputValueRegex = /^[0-9]*\.?[0-9]*?$/;
export function isInputFloat(value: string) {
  value = value.trim();
  return inputValueRegex.test(value);
}

const inputIntRegex = /^[0-9]*$/;
export function isInputValueInt(value: string) {
  value = value.trim();
  return inputIntRegex.test(value);
}

export function parseInputFloat(value: string) {
  value = value.trim();

  if (!isInputFloat(value)) {
    return null;
  }

  value = value
    .replace(/\.$/, "")
    .replace(/^\./, "0.");

  return dn.from(value === "" ? 0 : value, 18);
}

export function parseInputPercentage(value: string) {
  const parsedValue = parseInputFloat(value);
  if (parsedValue === null || dn.lt(parsedValue, 0) || dn.gt(parsedValue, 100)) {
    return null;
  }
  return dn.div(parsedValue, 100);
}

export function parseInputInt(value: string) {
  value = value.trim();
  return isInputValueInt(value) ? BigInt(value) : null;
}

export function parseInputBoolean(value: string) {
  value = value.trim();
  return value === "true" || value === "1";
}

export function parseInputAddress(value: string) {
  value = value.trim();
  return isAddress(value) ? value : ADDRESS_ZERO;
}

export type FormValue<T> = [fieldValue: string, parsedValue: T, parser: (value: string) => T];
export function formValue<T>(parsedValueDefault: T, parser: (value: string) => T): FormValue<T> {
  return ["", parsedValueDefault, parser];
}

export function useForm<Form extends Record<string, FormValue<unknown>>>(
  initial: () => Form,
  onUpdate: () => void, // use this to reset the error state
) {
  const [form, setForm] = useState(initial);

  const fieldsProps: Record<string, {
    onChange: (value: string) => void;
    value: string;
  }> = {};

  for (const [name, formValue] of Object.entries(form)) {
    const parser = formValue[2];
    fieldsProps[name] = {
      onChange: (value: string) => {
        onUpdate();
        const parsedValue = parser(value);
        if (parsedValue !== null) {
          setForm((values) => ({
            ...values,
            [name]: [value, parsedValue, parser],
          }));
        }
      },
      value: form[name]?.[0] as string, // type guard, should never be undefined
    };
  }

  const parsedValues = Object.fromEntries(
    Object
      .entries(form)
      .map(([name, [_, parsedValue]]) => [name, parsedValue]),
  ) as {
    [K in keyof Form]: NonNullable<Form[K][1]>;
  };

  const fill = (values: Record<string, string>) => {
    setForm((form) => {
      const newForm: Record<string, FormValue<unknown>> = { ...form };
      for (const [name, value] of Object.entries(values)) {
        const parser = newForm[name]?.[2];
        if (!parser) {
          throw new Error(`No parser found for field ${name}`);
        }
        newForm[name] = [value, parser(value), parser];
      }
      return { ...form, ...newForm };
    });
  };

  return {
    fieldsProps,
    fill,
    values: parsedValues,
  } as const;
}

type InputFieldUpdateData = {
  focused: boolean;
  parsed: Dnum | null;
  value: string;
};

export function useInputFieldValue(
  format: (value: Dnum) => string,
  {
    defaultValue = "",
    onChange,
    onFocusChange,
    parse = parseInputFloat,
    validate = (parsed, value) => ({ parsed, value }),
  }: {
    defaultValue?: string;
    onChange?: (data: InputFieldUpdateData) => void;
    onFocusChange?: (data: InputFieldUpdateData) => void;
    parse?: (value: string) => Dnum | null;
    validate?: (parsed: Dnum | null, value: string) => { parsed: Dnum | null; value: string };
  } = {},
) {
  const [{ value, focused, parsed }, set] = useState<{
    value: string;
    focused: boolean;
    parsed: Dnum | null;
  }>({
    value: defaultValue,
    focused: false,
    parsed: parse(defaultValue),
  });

  const ref = useRef<HTMLInputElement>(null);

  return useMemo(() => {
    const setValue = (value: string) => {
      let parsed = parse(value);

      const result = validate(parsed, value);
      parsed = result.parsed;
      value = result.value;

      set((s) => ({ ...s, parsed, value }));
      onChange?.({ focused, parsed, value });
    };

    const setFocused = (focused: boolean) => {
      set((s) => ({ ...s, focused }));
    };

    return ({
      focus: () => {
        ref.current?.focus();
      },
      inputFieldProps: {
        ref,
        onBlur: () => {
          setFocused(false);
          onFocusChange?.({ focused: false, parsed, value });
        },
        onFocus: () => {
          setFocused(true);
          onFocusChange?.({ focused: true, parsed, value });
        },
        onChange: setValue,
        value: focused || !parsed || !value.trim() ? value : format(parsed),
      },
      isEmpty: value.trim() === "",
      isFocused: focused,
      parsed,
      setValue,
      value,
    });
  }, [
    focused,
    format,
    onChange,
    onFocusChange,
    parsed,
    value,
  ]);
}
