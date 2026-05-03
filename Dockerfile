FROM python:3.10-slim

WORKDIR /app

RUN pip install --no-cache-dir fastmcp pydantic httpx python-dotenv

COPY mcp_ui_optimizer_v4.py .

RUN mkdir -p .aether_prime_cache .aether_prime_memory

EXPOSE 8000

CMD ["python", "mcp_ui_optimizer_v4.py"]
