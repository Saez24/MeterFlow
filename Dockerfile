FROM node:24-alpine AS builder
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY . .

ARG SUPABASE_URL
ARG SUPABASE_KEY

RUN mkdir -p src/environments && \
    echo "export const environment = { production: true, supabaseUrl: '${SUPABASE_URL}', supabaseKey: '${SUPABASE_KEY}' };" \
    > src/environments/environment.ts

RUN ./node_modules/.bin/ng build --configuration=production

FROM nginx:alpine
RUN rm -rf /usr/share/nginx/html/*
COPY nginx.conf /etc/nginx/conf.d/default.conf
# DE (baseHref: "/") → nginx-Root
COPY --from=builder /app/dist/MeterFlow/browser /usr/share/nginx/html/


EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]