FROM python:3.11-slim

RUN apt-get update && apt-get install -y --no-install-recommends \
    libgl1 libglib2.0-0 && rm -rf /var/lib/apt/lists/*

WORKDIR /app
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY . .
ENV PORT=5001
EXPOSE 5001
CMD ["gunicorn", "-w", "2", "-t", "120", "-b", "0.0.0.0:5001", "app:app"]
