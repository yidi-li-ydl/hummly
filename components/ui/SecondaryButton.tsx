import type { ButtonHTMLAttributes } from "react";

type Props = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "outline" | "quiet" | "soft";
};

export default function SecondaryButton({ variant = "quiet", className = "", type = "button", ...props }: Props) {
  return <button type={type} className={`secondary-button secondary-button--${variant} ${className}`} {...props} />;
}
