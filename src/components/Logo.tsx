type LogoProps = {
  className?: string;
  size?: number;
  withTagline?: boolean;
};

export function GloMark({ className = '', size = 28, withTagline = false }: LogoProps) {
  const src = withTagline ? '/glo-wordmark.png' : '/glo-wordmark-only.png';
  const ratio = withTagline ? 356 / 229 : 356 / 191;
  return (
    <img
      src={src}
      alt="Glo"
      width={Math.round(size * ratio)}
      height={size}
      className={`block select-none ${className}`}
      draggable={false}
      style={{ height: size, width: 'auto' }}
    />
  );
}
