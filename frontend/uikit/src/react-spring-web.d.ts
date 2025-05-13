import "@react-spring/web";

declare module "@react-spring/web" {
  import { ComponentPropsWithRef, ElementType, ForwardRefExoticComponent } from "react";

  interface AnimatedComponent<T extends ElementType> {
    <P extends ComponentPropsWithRef<T>>(props: P): JSX.Element;
  }

  type AnimatedTag<T extends ElementType> = AnimatedComponent<T>;

  interface AnimatedAPI {
    button: AnimatedTag<"button"> & HTMLButtonElement;
    div: AnimatedTag<"div"> & HTMLDivElement;
    rect: AnimatedTag<"rect"> & SVGRectElement;
    section: AnimatedTag<"section"> & HTMLElement;
    <T extends ElementType>(component: T): AnimatedTag<T>;
  }

  export const a: AnimatedAPI;
  export const animated: AnimatedAPI;
}
