#!/bin/sh
# Replaces 'http://localhost:3000' with the value of API_URL environment variable
# Usage: Place in /docker-entrypoint.d/ of nginx:alpine image

if [ -z "$API_URL" ]; then
  echo "API_URL is not set. Skipping replacement."
else
  # Ensure API_URL starts with http or https
  if echo "$API_URL" | grep -q "^http"; then
    : # Already has protocol
  else
    API_URL="https://$API_URL"
  fi
  echo "Replacing 'http://localhost:3000' with '$API_URL' in /usr/share/nginx/html"
  find /usr/share/nginx/html -type f \( -name "*.html" -o -name "*.js" \) -exec sed -i "s|http://localhost:3000|$API_URL|g" {} +
fi
