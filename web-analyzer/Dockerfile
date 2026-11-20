# Oficiálny image Playwright obsahuje Chromium aj všetky systémové knižnice.
FROM mcr.microsoft.com/playwright:v1.48.2-noble

WORKDIR /app
ENV NODE_ENV=production \
    PORT=3000 \
    DATA_DIR=/app/data \
    PLAYWRIGHT_BROWSERS_PATH=/ms-playwright

COPY package.json ./
RUN npm install --omit=dev --no-audit --no-fund
COPY . .

RUN mkdir -p /app/data && chown -R pwuser:pwuser /app
USER pwuser
VOLUME ["/app/data"]
EXPOSE 3000
CMD ["node", "server.js"]
