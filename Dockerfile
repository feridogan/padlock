# =================================================================
# MULTI-STAGE DOCKERFILE FOR COOLIFY & PRODUCTION DEPLOYMENT
# =================================================================

FROM node:16-bullseye AS base
WORKDIR /padloc

# 1. Paket tanımlarını kopyala
COPY package*.json lerna.json tsconfig.json ./
COPY packages/core/package*.json ./packages/core/
COPY packages/locale/package*.json ./packages/locale/
COPY packages/server/package*.json ./packages/server/
COPY packages/app/package*.json ./packages/app/
COPY packages/pwa/package*.json ./packages/pwa/

# 2. Bağımlılıkları yükle
RUN npm ci --unsafe-perm

# 3. Kaynak kodları ve varlıkları kopyala
COPY packages/core ./packages/core
COPY packages/locale ./packages/locale
COPY packages/app ./packages/app
COPY packages/server ./packages/server
COPY packages/pwa ./packages/pwa
COPY assets /assets

# -----------------------------------------------------------------
# STAGE: server (Backend API)
# -----------------------------------------------------------------
FROM base AS server
EXPOSE 3005
ENV PL_ASSETS_DIR=/assets
ENV PL_ATTACHMENTS_DIR=/attachments
WORKDIR /padloc/packages/server
ENTRYPOINT ["npm", "run"]
CMD ["start"]

# -----------------------------------------------------------------
# STAGE: pwa (Frontend Web App)
# -----------------------------------------------------------------
FROM base AS pwa
EXPOSE 8080
ENV PL_ASSETS_DIR=/assets
ENV PL_PWA_DIR=/pwa
WORKDIR /padloc/packages/pwa
ENTRYPOINT ["npm", "run"]
CMD ["build_and_start"]

# -----------------------------------------------------------------
# STAGE: all-in-one (Tekil Konteyner Dağıtımı)
# -----------------------------------------------------------------
FROM base AS all-in-one
EXPOSE 3005 8080
ENV PL_ASSETS_DIR=/assets
ENV PL_ATTACHMENTS_DIR=/attachments
ENV PL_PWA_DIR=/pwa
WORKDIR /padloc

# Hem backend hem pwa servislerini başlatan script
RUN printf '#!/bin/sh\n\
echo "Starting Padloc PWA on port 8080..."\n\
cd /padloc/packages/pwa && npm run build_and_start &\n\
echo "Starting Padloc Server on port 3000..."\n\
cd /padloc/packages/server && npm run start\n' > /padloc/start.sh && chmod +x /padloc/start.sh

CMD ["/padloc/start.sh"]
