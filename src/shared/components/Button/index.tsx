import Link from "next/link";
import type { ButtonHTMLAttributes, ReactNode } from "react";

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  children: ReactNode;
  href?: string;
};

const buttonClassName =
  "inline-flex min-h-11 items-center justify-center rounded-md bg-[var(--color-primary)] px-5 py-2.5 text-sm font-semibold text-[var(--color-topbar)] transition hover:bg-[var(--color-primary-hover)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-structure)] disabled:cursor-not-allowed disabled:opacity-60";

export function Button({ children, href, className = "", ...props }: ButtonProps) {
  const classes = `${buttonClassName} ${className}`.trim();

  if (href) {
    return (
      <Link className={classes} href={href}>
        {children}
      </Link>
    );
  }

  return (
    <button className={classes} {...props}>
      {children}
    </button>
  );
}
