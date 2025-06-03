# Use official Node.js image
FROM node:20-alpine

# Set working directory inside container
WORKDIR /app

# Copy only package.json and install first (faster builds)
COPY package*.json ./
RUN npm install

# Copy the rest of your app
COPY . .

# Ensure tmp and output folders exist
RUN mkdir -p tmp output

# Set the default port
ENV PORT=80

# Expose the port
EXPOSE 80

# Start the server
CMD ["node", "index.js"]
