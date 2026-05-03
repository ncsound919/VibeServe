# Contributing to VibeServe

Thanks for contributing! Here's how to get started.

## Adding DESIGN.md Templates

VibeServe ships with 10 curated design templates in `designs/`. You can contribute new ones:

1. Create a new `designs/YOUR_THEME.md` file
2. Follow the format below
3. Add the template name to `TemplateLibrary.TEMPLATES` in `vibeserve.py`
4. Submit a PR

### Template Format

```markdown
# Your Theme Name Design System

## Colors
- Primary: `#HEXCOLOR` — Primary accent color for CTAs and highlights
- Secondary: `#HEXCOLOR` — Secondary accent for hover states, badges
- Background: `#HEXCOLOR` — Page background
- Surface: `#HEXCOLOR` — Card/section surface color
- Text: `#HEXCOLOR` — Primary text color
- Text Secondary: `#HEXCOLOR` — Secondary/muted text

## Typography
- Heading font: `Font Name` (weight: 700, size: 2.5rem)
- Body font: `Font Name` (weight: 400, size: 1rem)
- Mono font: `Font Name` (for code blocks)

## Spacing
- Section: 4rem
- Component: 1rem
- Inline: 0.5rem

## Components
- Buttons: Primary pill, secondary outline
- Cards: Border with shadow, rounded corners
- Hero section style
- Header/nav style
- Footer style

## Layout
- Max width
- Column structure
- Mobile behavior

## Vibe
Brief description of the design philosophy, inspiration, and target use case.
```

## Code Contributions

1. Fork the repo
2. Create a feature branch
3. Make changes
4. Run tests: `pytest test_aether_nexus.py test_integration_v5.py -v`
5. Run lint: `ruff check vibeserve.py`
6. Submit a PR

## Development Setup

```bash
git clone https://github.com/ncsound919/AetherNexus-MCP
cd AetherNexus-MCP
pip install -e ".[dev]"
cp .env.example .env
```

## Community

- Star the repo if you find it useful
- Report bugs via GitHub Issues
- Request features via GitHub Discussions
- Share your builds on social media with #VibeServe
