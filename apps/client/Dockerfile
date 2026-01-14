FROM nginx:alpine

COPY . /usr/share/nginx/html
COPY entrypoint.sh /docker-entrypoint.d/99-replace-api-url.sh
RUN chmod +x /docker-entrypoint.d/99-replace-api-url.sh

EXPOSE 80
