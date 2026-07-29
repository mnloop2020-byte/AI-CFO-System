# syntax=docker/dockerfile:1.7

FROM python:3.14-slim AS runtime

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PIP_DISABLE_PIP_VERSION_CHECK=1 \
    PIP_NO_CACHE_DIR=1

RUN groupadd --gid 10001 ai-cfo \
    && useradd --uid 10001 --gid ai-cfo --no-log-init --create-home ai-cfo

WORKDIR /app

COPY requirements.txt ./
ARG PYTORCH_VERSION=2.13.0+cpu
RUN python -m pip install \
      --extra-index-url https://download.pytorch.org/whl/cpu \
      "torch==${PYTORCH_VERSION}" \
    && python -m pip install -r requirements.txt

COPY --chown=ai-cfo:ai-cfo app ./app
COPY --chown=ai-cfo:ai-cfo scripts/run_production.py ./scripts/run_production.py

USER 10001:10001

EXPOSE 8080

HEALTHCHECK --interval=30s --timeout=5s --start-period=30s --retries=3 \
    CMD ["python", "-c", "import os; from urllib.request import urlopen; urlopen('http://127.0.0.1:' + os.getenv('PORT', '8080') + '/health/live', timeout=3).read()"]

CMD ["python", "-m", "scripts.run_production"]
