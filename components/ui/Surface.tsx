import type { HTMLAttributes } from "react";

type Props = HTMLAttributes<HTMLElement> & {
  level?: "open" | "soft" | "active";
  as?: "div" | "section" | "article";
};

export default function Surface({ level = "soft", as: Tag = "div", className = "", ...props }: Props) {
  return <Tag className={`surface surface--${level} ${className}`} {...props} />;
}
