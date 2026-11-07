interface FormbricksLogoProps {
  readonly className?: string;
  /** The ground the mark sits on: the dark cut lightens the points and the teal. */
  readonly ground?: "light" | "dark";
}

/** The GForms mark: a speech bubble holding a three-point scale with the middle answer chosen. */
export const FormbricksLogo = ({ className, ground = "light" }: FormbricksLogoProps) => {
  const ink = ground === "dark" ? "#F1F5F9" : "#0F172A";
  const teal = ground === "dark" ? "#00C4B8" : "#038178";
  return (
    <svg
      viewBox="0 0 32 32"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      aria-hidden="true">
      <path
        d="M8 5.5h16A4.5 4.5 0 0 1 28.5 10v9A4.5 4.5 0 0 1 24 23.5H14l-6 5v-5A4.5 4.5 0 0 1 3.5 19v-9A4.5 4.5 0 0 1 8 5.5Z"
        stroke={teal}
        strokeWidth="2.4"
        strokeLinejoin="round"
      />
      <circle cx="10" cy="14.5" r="1.7" fill={ink} />
      <circle cx="16" cy="14.5" r="2.9" fill={teal} />
      <circle cx="22" cy="14.5" r="1.7" fill={ink} />
    </svg>
  );
};
