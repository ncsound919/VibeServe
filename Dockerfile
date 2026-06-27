FROM python:3.14-slim@sha256:63a4c7f612a00f92042cbdcc7cdc6a306f38485af0a200b9c89de7d9b1607d15
# digest for python:3.12-slim as of 2025-05

WORKDIR /app

RUN groupadd -r vibeserve && useradd -r -g vibeserve vibeserve

COPY pyproject.toml README.md ./
RUN pip install --no-cache-dir .

COPY vibeserve/ vibeserve/

RUN mkdir -p .aether_prime_cache .aether_prime_memory && chown -R vibeserve:vibeserve /app

ENV DEFAULT_LLM_PROVIDER=local

HEALTHCHECK --interval=30s --timeout=5s --retries=3 --start-period=15s \
  CMD python -c "import urllib.request; urllib.request.urlopen('http://localhost:8000/health')" || exit 1

USER vibeserve

CMD ["python", "-m", "vibeserve"]
