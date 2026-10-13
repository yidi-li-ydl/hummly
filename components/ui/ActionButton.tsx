import type { ButtonHTMLAttributes } from "react";

type Props = ButtonHTMLAttributes<HTMLButtonElement> & {
  tone?: "lime" | "dark";
};

export default function ActionButton({ tone = "lime", className = "", type = "button", ...props }: Props) {
  return <button type={type} className={`action-button action-button--${tone} ${className}`} {...props} />;
}
