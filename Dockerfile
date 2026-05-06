FROM python:3.12-slim@sha256:1127090f9fff0b9ec338f3b6fe80437ada404d465085fe996d5f8cfd8fe6c123
# digest for python:3.12-slim as of 2025-05

WORKDIR /app

RUN groupadd -r vibeserve && useradd -r -g vibeserve vibeserve

COPY pyproject.toml README.md ./
RUN pip install --no-cache-dir .

COPY vibeserve/ vibeserve/

RUN mkdir -p .aether_prime_cache .aether_prime_memory && chown -R vibeserve:vibeserve /app

ENV DEFAULT_LLM_PROVIDER=local

HEALTHCHECK --interval=30s --timeout=5s --retries=3 \
  CMD python -c "import sys; sys.exit(0)"

USER vibeserve

CMD ["python", "-m", "vibeserve"]
