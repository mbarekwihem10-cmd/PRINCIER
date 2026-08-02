import type { ButtonHTMLAttributes, ReactElement } from "react";

export type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement>;

export function Button({ children, ...props }: ButtonProps): ReactElement {
  return <button {...props}>{children}</button>;
}
