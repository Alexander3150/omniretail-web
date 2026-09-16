import type { SVGProps } from "react";

/**
 * Set de iconos livianos, puramente presentacionales (sin logica de
 * negocio) para pantallas que necesitan iconografia fuera del Sidebar
 * (que ya tiene el suyo propio para navegacion). Mismo estilo visual
 * (stroke, 24x24, esquinas redondeadas) para que se sientan parte del
 * mismo sistema.
 */
function BaseIcon({ children, className, ...props }: SVGProps<SVGSVGElement>) {
  return (
    <svg
      className={className}
      fill="none"
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth="2"
      viewBox="0 0 24 24"
      {...props}
    >
      {children}
    </svg>
  );
}

export function LockIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <BaseIcon {...props}>
      <rect height="11" rx="2" width="16" x="4" y="11" />
      <path d="M8 11V7a4 4 0 0 1 8 0v4" />
    </BaseIcon>
  );
}

export function ShieldIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <BaseIcon {...props}>
      <path d="M12 3 4 6v6c0 5 3.4 7.8 8 9 4.6-1.2 8-4 8-9V6Z" />
    </BaseIcon>
  );
}

export function MailIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <BaseIcon {...props}>
      <rect height="16" rx="2" width="20" x="2" y="4" />
      <path d="m3 6 9 7 9-7" />
    </BaseIcon>
  );
}

export function PhoneIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <BaseIcon {...props}>
      <path d="M5 4h4l1.5 4.5-2 1.5a12 12 0 0 0 6 6l1.5-2L20 15v4a1 1 0 0 1-1 1C10.6 20 4 13.4 4 5a1 1 0 0 1 1-1Z" />
    </BaseIcon>
  );
}

export function MapPinIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <BaseIcon {...props}>
      <path d="M12 21s7-5.2 7-11a7 7 0 0 0-14 0c0 5.8 7 11 7 11Z" />
      <circle cx="12" cy="10" r="2.5" />
    </BaseIcon>
  );
}

export function CreditCardIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <BaseIcon {...props}>
      <rect height="14" rx="2" width="20" x="2" y="5" />
      <path d="M2 10h20" />
    </BaseIcon>
  );
}

export function PackageIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <BaseIcon {...props}>
      <path d="m3 7 9 5 9-5" />
      <path d="M12 22V12" />
      <path d="M21 7v10l-9 5-9-5V7l9-5 9 5Z" />
    </BaseIcon>
  );
}

export function TruckIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <BaseIcon {...props}>
      <path d="M10 17h4V5H2v12h3" />
      <path d="M14 8h4l4 4v5h-3" />
      <circle cx="7" cy="17" r="2" />
      <circle cx="17" cy="17" r="2" />
    </BaseIcon>
  );
}

export function DownloadIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <BaseIcon {...props}>
      <path d="M12 3v12" />
      <path d="m7 10 5 5 5-5" />
      <path d="M4 19h16" />
    </BaseIcon>
  );
}

export function CompassIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <BaseIcon {...props}>
      <circle cx="12" cy="12" r="9" />
      <path d="m15 9-2 6-6 2 2-6Z" />
    </BaseIcon>
  );
}
