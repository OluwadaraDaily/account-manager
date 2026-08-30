export type IconName =
  | "alert"
  | "arrow"
  | "calendar"
  | "check"
  | "chevron"
  | "download"
  | "filter"
  | "mail"
  | "shield"
  | "spark"
  | "volume"
  | "volumeOff";

type IconProps = {
  name: IconName;
  size?: number;
};

export function Icon({ name, size = 18 }: IconProps) {
  const common = {
    width: size,
    height: size,
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 1.8,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
  };

  if (name === "alert")
    return (
      <svg {...common}>
        <path d="m12 3 9 17H3L12 3Z" />
        <path d="M12 9v5m0 3h.01" />
      </svg>
    );
  if (name === "arrow")
    return (
      <svg {...common}>
        <path d="M5 12h14M13 6l6 6-6 6" />
      </svg>
    );
  if (name === "download")
    return (
      <svg {...common}>
        <path d="M12 3v12m0 0 4-4m-4 4-4-4M5 21h14" />
      </svg>
    );
  if (name === "shield")
    return (
      <svg {...common}>
        <path d="M12 3 5 6v5c0 4.6 2.8 8.1 7 10 4.2-1.9 7-5.4 7-10V6l-7-3Z" />
        <path d="m9.5 12 1.7 1.7 3.5-3.5" />
      </svg>
    );
  if (name === "mail")
    return (
      <svg {...common}>
        <rect x="3" y="5" width="18" height="14" rx="2" />
        <path d="m4 7 8 6 8-6" />
      </svg>
    );
  if (name === "filter")
    return (
      <svg {...common}>
        <path d="M4 6h16M7 12h10m-7 6h4" />
      </svg>
    );
  if (name === "calendar")
    return (
      <svg {...common}>
        <rect x="3" y="4" width="18" height="17" rx="2" />
        <path d="M16 2v4M8 2v4M3 9h18" />
      </svg>
    );
  if (name === "chevron")
    return (
      <svg {...common}>
        <path d="m7 9 5 5 5-5" />
      </svg>
    );
  if (name === "check")
    return (
      <svg {...common}>
        <path d="m5 12 4 4L19 6" />
      </svg>
    );
  if (name === "spark")
    return (
      <svg {...common}>
        <path d="m12 3 1.4 5.6L19 10l-5.6 1.4L12 17l-1.4-5.6L5 10l5.6-1.4L12 3Z" />
        <path d="m19 16 .6 2.4L22 19l-2.4.6L19 22l-.6-2.4L16 19l2.4-.6L19 16Z" />
      </svg>
    );
  if (name === "volume" || name === "volumeOff")
    return (
      <svg {...common}>
        <path d="M4 10v4h4l5 4V6l-5 4H4Z" />
        {name === "volume" ? (
          <path d="M17 9a4 4 0 0 1 0 6M19.5 6.5a8 8 0 0 1 0 11" />
        ) : (
          <path d="m17 10 4 4m0-4-4 4" />
        )}
      </svg>
    );
  return null;
}
