/* eslint-disable @next/next/no-img-element */

type LogoProps = {
  size?: number;
  className?: string;
  withGlow?: boolean;
  withWordmark?: boolean;
};

/**
 * Logo PoupApp — porquinho 🐷.
 *
 * Variantes:
 *   <Logo size={48} />                       // só ícone
 *   <Logo size={48} withGlow />              // ícone com brilho rosa
 *   <Logo size={32} withWordmark />          // ícone + "PoupApp"
 */
export function Logo({ size = 40, className, withGlow, withWordmark }: LogoProps) {
  return (
    <div className={`inline-flex items-center gap-2 ${className ?? ''}`}>
      <div className="relative" style={{ width: size, height: size }}>
        {withGlow && (
          <div
            className="absolute inset-0 rounded-full bg-accent opacity-50 blur-xl"
            aria-hidden
          />
        )}
        <img
          src="/logo.svg"
          alt="PoupApp"
          width={size}
          height={size}
          className="relative"
          style={{ filter: 'drop-shadow(0 2px 8px rgba(255, 61, 133, 0.25))' }}
        />
      </div>
      {withWordmark && (
        <span
          className="font-display font-bold text-fg"
          style={{ fontSize: size * 0.55, letterSpacing: '-0.02em' }}
        >
          PoupApp
        </span>
      )}
    </div>
  );
}
