/**
 * Skip Navigation Link component for accessibility
 * Allows keyboard users to skip directly to main content
 */

export function SkipNav() {
  return (
    <a
      href="#main-content"
      className="skip-nav"
      style={{
        position: 'absolute',
        top: '-999px',
        left: '0',
        zIndex: 9999,
        padding: '0.75rem 1.5rem',
        background: 'var(--color-primary)',
        color: 'white',
        textDecoration: 'none',
        borderRadius: '0 0 0.375rem 0',
        fontWeight: 600,
        fontSize: '0.875rem',
      }}
      onFocus={(e) => {
        e.currentTarget.style.top = '0';
      }}
      onBlur={(e) => {
        e.currentTarget.style.top = '-999px';
      }}
    >
      Skip to main content
    </a>
  );
}
