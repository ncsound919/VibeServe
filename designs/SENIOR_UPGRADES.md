# Senior-Dev Upgraded Design System — Production-Grade Enhancements

## Responsive Breakpoints (Mobile-First)
- Mobile: <640px (single column, stacked, 48px section gaps)
- Tablet: 640-1024px (2-column grids, 64px section gaps)
- Desktop: 1024-1440px (3-column, full nav, 96px section gaps)
- Wide: >1440px (centered, max-width 1280px, generous margins)

## Accessibility Requirements (WCAG AAA)
- All interactive elements: focus-visible outline (2px solid, 2px offset), min 44x44px touch target
- Skip-to-content link at top of every page
- Landmark roles: <header>, <main>, <nav>, <footer>, <section aria-label="...">
- aria-live="polite" for dynamic content updates
- alt text on all images, empty alt="" for decorative
- Language attribute on <html>
- Color is never the only differentiator (icons + text + color for status)
- prefers-reduced-motion: disable all animations/transitions
- prefers-contrast: more/high — increase border contrast
- prefers-color-scheme: respect dark/light system preference

## Performance Patterns
- font-display: swap on all web fonts
- content-visibility: auto on below-fold sections
- loading="lazy" on all images below fold
- decoding="async" on large images
- Inline critical CSS (<14KB), defer non-critical
- Resource hints: <link rel="preconnect"> for external origins
- No layout shift: explicit width/height on images, aspect-ratio on containers

## Animation Tokens
- transition-duration: 150ms (micro), 200ms (standard), 300ms (entrance)
- transition-timing: ease-out (opening), ease-in (closing), cubic-bezier(0.4,0,0.2,1) (standard)
- @media (prefers-reduced-motion: reduce) { *, *::before, *::after { animation-duration: 0.01ms !important; transition-duration: 0.01ms !important; } }

## SEO & Meta
- <title> with primary keyword
- <meta name="description"> (120-160 chars)
- <meta property="og:title">, og:description, og:image (1200x630)
- <meta name="twitter:card" content="summary_large_image">
- Structured data: JSON-LD for Organization/SoftwareApplication
- Canonical URL

## Print Stylesheet
- @media print { nav, footer { display: none; } body { color: #000; background: #fff; } }

## Security
- Content-Security-Policy meta tag (frame-ancestors, script-src)
- Referrer-Policy: strict-origin-when-cross-origin
- X-Content-Type-Options: nosniff

## Code Quality
- Valid HTML5 (W3C validator)
- CSS custom properties for all design tokens (no magic values)
- No inline styles except dynamic values
- BEM or utility-first class naming
- Compressed CSS/HTML with source maps for dev
