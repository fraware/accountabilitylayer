# Developer Guide for Accountability Layer

Welcome to the Accountability Layer project! This guide provides step-by-step instructions to set up, develop, test, and deploy both the backend and frontend components.

## Table of Contents

- [Project Overview](#project-overview)
- [Backend Setup](#backend-setup)
- [Frontend Setup](#frontend-setup)
- [Testing](#testing)
- [Deployment](#deployment)
- [Environment Configuration and Secrets Management](#environment-configuration-and-secrets-management)
- [Contribution Guidelines](#contribution-guidelines)

## Project Overview

The Accountability Layer is an open‑source tool that ensures transparency in AI agent decisions. Key features include:

- Detailed logging of decision steps.
- Chain‑of‑work representation.
- Anomaly detection and notifications.
- RESTful API endpoints and a real‑time dashboard.
- JWT‑based authentication and role‑based access control.

## Backend Setup

1. **Prerequisites:**

   - Node.js (v14 or later)
   - MongoDB

2. **Installation:**

   ```bash
   cd backend
   npm install
   Environment Variables: Create a .env file in the backend folder:
   ```

3. **Environment Variables: Create a `.env` file in the `backend` folder:**

   ```ini
   PORT=5000
   MONGODB_URI=mongodb://localhost:27017/accountability
   JWT_SECRET=your_secret_key
   JWT_EXPIRES_IN=1h
   API_ENV=development

   ```

4. **Running the Server:**

   ```bash
   npm run dev
   The server will start on the configured port.

   ```

5. **API Documentation:**

The OpenAPI specification is located at `docs/api-spec.yaml`.
To view live API documentation, use Swagger UI or ReDoc by pointing it to this spec.

## Frontend Setup

1. **Prerequisites:**

Node.js (v14 or later)

2. **Installation:**

   ```bash
   cd frontend
   npm install

   ```

3. **Running the Application:**

   ```bash
   npm start
   The application will run on http://localhost:3000.

   ```

4. **Environment Variables:**

Create a `.env` file in the `frontend` folder if needed for API endpoint configuration.

## Testing

### Backend Tests

- Run all unit and integration tests:

  ```bash
  cd backend
  npm test
  ```

### Frontend Tests

- Run unit tests:

  ```bash
  cd frontend
  npm test

  ```

- For End-to-End (E2E) tests using Cypress:

  ```bash
  npx cypress open
  ```

## Deployment

- **Docker Deployment:**
  Use the provided `Dockerfile` and `docker-compose.yml` for containerized deployments.
  Multi‑environment configuration is supported via environment files (e.g. `.env.staging`, `.env.production`).

- **Production Readiness:**
  Consider using container orchestration tools (e.g., Kubernetes) for scalability and manageability.

## Environment Configuration and Secrets Management

- **Local Development:**
  Use `.env` files for sensitive data and configuration settings.

- **Production:**
  Employ a secrets management tool (e.g., AWS Secrets Manager, HashiCorp Vault) to securely manage credentials.

## Contribution Guidelines

For details on how to contribute, please refer to CONTRIBUTING.md.
