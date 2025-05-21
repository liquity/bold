import "@react-spring/web";
import { SpringValue } from "@react-spring/core";
import { CSSProperties, ForwardRefExoticComponent, HTMLAttributes, Ref, RefObject, SVGAttributes } from "react";

declare module "@react-spring/web" {
  type CreateAnimatedProps<Props, Element> =
    & Omit<Props, "style">
    & {
      ref?: Ref<Element> | RefObject<Element>;
      style?: { [K in keyof CSSProperties]?: CSSProperties[K] | SpringValue<CSSProperties[K]> };
    };

  type AnimatedHTMLProps<E extends HTMLElement = HTMLElement> = CreateAnimatedProps<HTMLAttributes<E>, E>;
  type AnimatedSVGProps<E extends SVGElement = SVGElement> = CreateAnimatedProps<SVGAttributes<E>, E>;

  export const a: {
    // HTML
    button: ForwardRefExoticComponent<AnimatedHTMLProps<HTMLButtonElement>>;
    div: ForwardRefExoticComponent<AnimatedHTMLProps<HTMLDivElement>>;
    section: ForwardRefExoticComponent<AnimatedHTMLProps<HTMLElement>>;

    // SVG
    rect: ForwardRefExoticComponent<AnimatedSVGProps<SVGRectElement>>;
  };

  export const animated: typeof a;
}
