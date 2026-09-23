FROM python:3.11-slim-bookworm AS build
ENV PIP_NO_CACHE_DIR=1 PIP_DISABLE_PIP_VERSION_CHECK=1
RUN python -m venv /opt/venv
ENV PATH="/opt/venv/bin:$PATH"
# CPU torch by default; pass --build-arg TORCH_INDEX=cu128 for CUDA.
ARG TORCH_INDEX=cpu
RUN pip install torch --index-url https://download.pytorch.org/whl/${TORCH_INDEX}
COPY requirements.txt /tmp/requirements.txt
RUN pip install -r /tmp/requirements.txt

FROM python:3.11-slim-bookworm
ENV PATH="/opt/venv/bin:$PATH" PYTHONUNBUFFERED=1 TOKENIZERS_PARALLELISM=false OMP_NUM_THREADS=4 \
    LAYA_DEVICE=cpu LAYA_MODELS=english LAYA_HOST=0.0.0.0 LAYA_PORT=8000 HF_HOME=/home/laya/.cache/huggingface
RUN groupadd --gid 10001 laya && useradd --uid 10001 --gid laya --create-home laya && mkdir -p /home/laya/.cache/huggingface && chown -R laya:laya /home/laya
COPY --from=build /opt/venv /opt/venv
WORKDIR /app
COPY app.py /app/app.py
USER laya
EXPOSE 8000
CMD ["python", "app.py"]
