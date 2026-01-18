# Use stable Node LTS
FROM node:18-slim

# Install ffmpeg (required for merging)
RUN apt-get update && \
    apt-get install -y ffmpeg && \
    rm -rf /var/lib/apt/lists/*

# Set working directory
WORKDIR /app

# Copy package files first (better caching)
COPY package.json package-lock.json* ./

# Install dependencies
RUN npm install --production

# Copy rest of the source code
COPY . .

# Expose the port Render uses
EXPOSE 1000

# Start the server
CMD ["npm", "start"]
