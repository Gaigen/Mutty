FROM python:3.11-slim

# ffmpeg is required for audio/video piping
RUN apt-get update && apt-get install -y --no-install-recommends \
        ffmpeg \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY requirements.txt .
RUN sh -c "pip install --proxy $DOCKER_BUILD_STAGE_PROXY --no-cache-dir -r requirements.txt"


COPY . .

EXPOSE 8081

CMD ["python", "main.py", "start"]
