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
4. Run tests: `pytest tests/ -v`
5. Run lint: `ruff check vibeserve/`
6. Submit a PR

## Development Setup

```bash
git clone https://github.com/ncsound919/VibeServe
cd VibeServe
pip install -e ".[dev]"
cp .env.example .env
```

## Release Process

### Version Bumping

1. Update the `version` field in `pyproject.toml`
2. Add a new `## [X.Y.Z]` section at the top of `CHANGELOG.md` describing the changes
3. Commit with message `release: bump to vX.Y.Z`
4. Push to `main` — CI will run tests, lint, security scan, and changelog verification automatically

### Publishing to PyPI

Publishing uses **Trusted Publishing (OIDC)** — no API tokens required.

1. Tag the release commit: `git tag vX.Y.Z`
2. Push the tag: `git push origin vX.Y.Z`
3. Create a GitHub Release from the tag at https://github.com/ncsound919/VibeServe/releases/new
4. The `Publish to PyPI` workflow triggers automatically on release, running:
   - **test**: pytest with 80% coverage across Python 3.10–3.12
   - **lint**: ruff + mypy
   - **security**: bandit
   - **changelog**: verifies an entry exists for the current version
   - **build**: `python -m build` + `twine check`
   - **publish**: OIDC upload to PyPI (only on release event)

The `publish` job has `concurrency: publish` set at the workflow level to prevent parallel publishes.

### Manual Local Publish (Fallback)

If the GitHub Actions pipeline is unavailable:

```bash
bash scripts/publish.sh        # builds + verifies
python -m twine upload dist/*  # uploads to PyPI (requires ~/.pypirc or __token__)
```

### Prerequisites for Publishing

```bash
pip install build twine
```

## Community

- Star the repo if you find it useful
- Report bugs via GitHub Issues
- Request features via GitHub Discussions
- Share your builds on social media with #VibeServe
