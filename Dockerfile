FROM python:3.13-slim

WORKDIR /app

RUN apt-get update && apt install git -y

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY src ./src

EXPOSE 8990

CMD ["hypercorn", "src.app:app", "--bind", "0.0.0.0:8990"]