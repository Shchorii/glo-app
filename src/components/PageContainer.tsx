/** Standard centered page wrapper with the app's shared horizontal padding. */
const MAX_WIDTHS = {
  md: "max-w-3xl",
  lg: "max-w-6xl",
} as const;

export function PageContainer({
  size = "lg",
  className = "",
  children,
}: {
  size?: keyof typeof MAX_WIDTHS;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <div className={`${MAX_WIDTHS[size]} mx-auto px-4 sm:px-6 md:px-8 py-6 md:py-10 ${className}`}>
      {children}
    </div>
  );
}
