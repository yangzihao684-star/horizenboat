interface IconProps {
  className?: string;
}

function svgProps(className?: string) {
  return {
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 1.6,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
    className: className ?? "size-4",
    "aria-hidden": true,
  };
}

export function IconSearch({ className }: IconProps) {
  return (
    <svg {...svgProps(className)}>
      <circle cx="11" cy="11" r="6.25" />
      <path d="m15.6 15.6 4.4 4.4" />
    </svg>
  );
}

export function IconCopy({ className }: IconProps) {
  return (
    <svg {...svgProps(className)}>
      <rect x="9" y="9" width="11" height="11" rx="2.2" />
      <path d="M15 6.2A2.2 2.2 0 0 0 12.8 4H6.2A2.2 2.2 0 0 0 4 6.2v6.6A2.2 2.2 0 0 0 6.2 15" />
    </svg>
  );
}

export function IconCheck({ className }: IconProps) {
  return (
    <svg {...svgProps(className)}>
      <path d="m4.5 12.5 4.5 4.5 10.5-11" />
    </svg>
  );
}

export function IconSun({ className }: IconProps) {
  return (
    <svg {...svgProps(className)}>
      <circle cx="12" cy="12" r="4" />
      <path d="M12 2.5v2M12 19.5v2M2.5 12h2M19.5 12h2M5.2 5.2l1.4 1.4M17.4 17.4l1.4 1.4M18.8 5.2l-1.4 1.4M6.6 17.4l-1.4 1.4" />
    </svg>
  );
}

export function IconMoon({ className }: IconProps) {
  return (
    <svg {...svgProps(className)}>
      <path d="M20 14.5A8 8 0 0 1 9.5 4a8.2 8.2 0 1 0 10.5 10.5Z" />
    </svg>
  );
}

export function IconArrowRight({ className }: IconProps) {
  return (
    <svg {...svgProps(className)}>
      <path d="M4.5 12h15M13.5 6l6 6-6 6" />
    </svg>
  );
}

export function IconArrowLeft({ className }: IconProps) {
  return (
    <svg {...svgProps(className)}>
      <path d="M19.5 12h-15M10.5 6l-6 6 6 6" />
    </svg>
  );
}

export function IconArrowUpRight({ className }: IconProps) {
  return (
    <svg {...svgProps(className)}>
      <path d="M7 17 17 7M8.5 7H17v8.5" />
    </svg>
  );
}

export function IconClose({ className }: IconProps) {
  return (
    <svg {...svgProps(className)}>
      <path d="M6 6l12 12M18 6L6 18" />
    </svg>
  );
}

export function IconChevronDown({ className }: IconProps) {
  return (
    <svg {...svgProps(className)}>
      <path d="m6 9.5 6 6 6-6" />
    </svg>
  );
}

export function IconLayers({ className }: IconProps) {
  return (
    <svg {...svgProps(className)}>
      <path d="m12 3.5 8.5 4.6L12 12.7 3.5 8.1 12 3.5Z" />
      <path d="m3.5 12.6 8.5 4.6 8.5-4.6" />
      <path d="m3.5 16.9 8.5 4.6 8.5-4.6" />
    </svg>
  );
}

export function IconShield({ className }: IconProps) {
  return (
    <svg {...svgProps(className)}>
      <path d="M12 3 19 6v5.6c0 4.2-2.8 7.6-7 9.4-4.2-1.8-7-5.2-7-9.4V6l7-3Z" />
      <path d="m9 12 2.2 2.2L15.5 10" />
    </svg>
  );
}

export function IconUsers({ className }: IconProps) {
  return (
    <svg {...svgProps(className)}>
      <circle cx="9.2" cy="8.4" r="3.4" />
      <path d="M3.6 20c.5-3.3 2.8-5.2 5.6-5.2s5.1 1.9 5.6 5.2" />
      <path d="M16.4 5.4a3.4 3.4 0 0 1 0 6.5M17.5 14.9c2 .5 3.3 2.1 3.7 4.6" />
    </svg>
  );
}

export function IconSparkles({ className }: IconProps) {
  return (
    <svg {...svgProps(className)}>
      <path d="M12 3.5 13.7 9l5.5 1.7-5.5 1.7L12 18l-1.7-5.6L4.8 10.7 10.3 9 12 3.5Z" />
      <path d="M18.5 15.5l.7 2.1 2.1.7-2.1.7-.7 2.1-.7-2.1-2.1-.7 2.1-.7.7-2.1Z" />
    </svg>
  );
}

export function IconTerminal({ className }: IconProps) {
  return (
    <svg {...svgProps(className)}>
      <rect x="3" y="4.5" width="18" height="15" rx="2.4" />
      <path d="m7.5 10 2.5 2.5L7.5 15M12.5 15H16" />
    </svg>
  );
}

export function IconTag({ className }: IconProps) {
  return (
    <svg {...svgProps(className)}>
      <path d="M4 11.2V5.4A1.4 1.4 0 0 1 5.4 4h5.8c.4 0 .7.15 1 .42l7.3 7.3a1.4 1.4 0 0 1 0 2l-5.2 5.2a1.4 1.4 0 0 1-2 0l-7.3-7.3a1.4 1.4 0 0 1-.4-1Z" />
      <circle cx="8.4" cy="8.4" r="1.4" />
    </svg>
  );
}

export function IconAlert({ className }: IconProps) {
  return (
    <svg {...svgProps(className)}>
      <path d="M12 4.5 21 20H3l9-15.5Z" />
      <path d="M12 10v4.2M12 17.2v.1" />
    </svg>
  );
}

export function IconQuote({ className }: IconProps) {
  return (
    <svg {...svgProps(className)}>
      <path d="M9.5 6.5C6.4 7.7 4.6 10 4.6 13.2c0 2.6 1.5 4.3 3.6 4.3 1.9 0 3.2-1.3 3.2-3.1 0-1.7-1.2-2.9-2.9-2.9-.3 0-.6 0-.9.1.4-1.6 1.6-2.8 3.3-3.6l-1.4-1.5Z" />
      <path d="M18.4 6.5c-3.1 1.2-4.9 3.5-4.9 6.7 0 2.6 1.5 4.3 3.6 4.3 1.9 0 3.2-1.3 3.2-3.1 0-1.7-1.2-2.9-2.9-2.9-.3 0-.6 0-.9.1.4-1.6 1.6-2.8 3.3-3.6l-1.4-1.5Z" />
    </svg>
  );
}

export function IconFile({ className }: IconProps) {
  return (
    <svg {...svgProps(className)}>
      <path d="M13.5 3.5H7a2 2 0 0 0-2 2v13a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V9l-5.5-5.5Z" />
      <path d="M13.5 3.5V9H19M8.5 14h7M8.5 17h4.5" />
    </svg>
  );
}

export function IconBrand({ className }: IconProps) {
  return (
    <svg {...svgProps(className)}>
      <circle cx="17" cy="6.6" r="1.8" />
      <path d="M2.5 14.2h19" />
      <path d="M11.4 14.2V5.9l4.4 8.3z" />
      <path d="M7.4 17.4c1.5 1.1 3 1.1 4.3 0 1.2-1.1 2.8-1.1 4.3 0" />
    </svg>
  );
}
