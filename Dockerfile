# Build stage
FROM node:20-alpine as build-stage
WORKDIR /app
COPY package*.json ./
RUN npm ci --ignore-scripts
COPY . .
RUN npm run build

# Production stage
FROM nginx:stable-alpine as production-stage
COPY --from=build-stage /app/dist /usr/share/nginx/html
# Copy Caddyfile might not be needed if using Nginx, but keeping it simple
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
