# Build stage
FROM node:20-alpine as build-stage
WORKDIR /app

# Build args for Vite env vars (baked into static build)
ARG VITE_SUPABASE_URL=http://localhost:8000
ARG VITE_SUPABASE_ANON_KEY=
# Expose as ENV so Vite can read them during npm run build
ENV VITE_SUPABASE_URL=$VITE_SUPABASE_URL
ENV VITE_SUPABASE_ANON_KEY=$VITE_SUPABASE_ANON_KEY

COPY package*.json ./
RUN npm ci --ignore-scripts
COPY . .
RUN npm run build

# Production stage
FROM nginx:stable-alpine as production-stage
COPY --from=build-stage /app/dist /usr/share/nginx/html
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
