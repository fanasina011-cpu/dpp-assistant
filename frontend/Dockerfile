# ============================================================================
# DPP Assistant — Image frontend React (multi-stage)
# ============================================================================
# Étape 1 : build avec Node
# Étape 2 : serve avec Nginx
# ============================================================================

# --- Étape 1 : Build ---
FROM node:20-alpine AS builder

WORKDIR /app

# Copier les fichiers de dépendances
COPY package*.json ./

# Installer les dépendances
RUN npm ci

# Copier le code source
COPY . .

# Build de production
RUN npm run build

# --- Étape 2 : Serve ---
FROM nginx:alpine

# Config Nginx personnalisée pour React Router
COPY nginx.conf /etc/nginx/conf.d/default.conf

# Copier le build depuis l'étape précédente
COPY --from=builder /app/dist /usr/share/nginx/html

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]