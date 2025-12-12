FROM node:18-alpine AS build
WORKDIR /app
COPY package*.json ./
RUN npm install --legacy-peer-deps
COPY .env .env
RUN echo "DEBUG: After copying .env" && ls -la /app
COPY . .
RUN echo "DEBUG: After copying project" && ls -la /app
RUN echo "DEBUG: Checking .env content" && cat /app/.env || echo ".env missing!"
RUN npm run build