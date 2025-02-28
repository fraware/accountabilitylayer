# Accountability Layer

The **Accountability Layer** is an open‑source tool designed to ensure transparency and traceability in AI agent decision-making. It achieves this by capturing detailed logs of each decision step, representing the entire chain-of-work, and providing mechanisms for anomaly detection, verification, and review. The system offers both a robust backend API and a dynamic, real‑time frontend dashboard for monitoring and analysis.

<p align="center" width="100%">
<img src="assets/accountability layer.png">
</p>

## Table of Contents

- [Overview](#overview)
- [Features](#features)
- [Architecture](#architecture)
- [Repository Structure](#repository-structure)
- [Setup & Installation](#setup--installation)
  - [Backend Setup](#backend-setup)
  - [Frontend Setup](#frontend-setup)
- [API Documentation](#api-documentation)
- [Testing](#testing)
  - [Backend Tests](#backend-tests)
  - [Frontend Tests](#frontend-tests)
  - [End-to-End Tests](#end-to-end-tests)
- [CI/CD Pipeline](#cicd-pipeline)
- [Developer Onboarding & Contribution](#developer-onboarding--contribution)
- [Environment Configuration & Secrets Management](#environment-configuration--secrets-management)
- [License](#license)
- [Contact](#contact)

## Features

- **Detailed Logging & Audit Trail:**  
  Capture every decision step with inputs, outputs, timestamps, metadata, and the underlying reasoning.
- **Chain-of-Work Representation:**  
  Convert ephemeral chains-of-thought into a persistent, structured record.
- **Advanced Anomaly Detection:**  
  Utilize heuristic and statistical methods to flag irregular log entries, with integrated notifications for anomalies.
- **JWT-Based Authentication & Role-Based Access Control:**  
  Secure endpoints using JWT tokens with support for roles (auditor, admin, agent) to control sensitive operations.
- **Comprehensive RESTful API:**  
  Endpoints for creating logs, updating review statuses, searching logs with advanced filters, and summarizing log statistics.
- **Real-Time Dashboard:**  
  A React-based UI enhanced with WebSocket (Socket.IO) support for instant updates, advanced filtering, and detailed log viewing.
- **Developer & Community Support:**  
  Extensive documentation including an OpenAPI specification, developer guides, and clear contribution guidelines.

## Architecture

The project consists of two main components:

- **Backend:**  
  Built with Node.js, Express, and MongoDB, the backend exposes versioned API endpoints (under `/api/v1`) for log management, authentication, and anomaly detection. It is containerized using Docker and secured with JWT-based authentication.
- **Frontend:**  
  Developed using React and Material‑UI, the frontend provides a rich, interactive dashboard for viewing and filtering logs. It supports real‑time updates via Socket.IO, advanced filtering options, and role‑based views (auditor/admin versus agent).

## Repository Structure

```graphql
accountability-layer/
├── backend/
│   ├── src/
│   │   ├── controllers/        # API endpoint handlers (logs, authentication)
│   │   ├── models/             # Data models and Mongoose schemas
│   │   ├── routes/             # API route definitions (versioned under /api/v1)
│   │   ├── services/           # Business logic (logging, anomaly detection, notifications)
│   │   ├── middleware/         # JWT authentication, role-based authorization, error handling, API usage logging
│   │   └── app.js              # Entry point for the backend API server
│   ├── tests/                  # Unit, integration, and security tests for backend endpoints
│   ├── Dockerfile              # Containerization configuration for the backend service
│   └── package.json            # Backend dependencies and scripts
├── frontend/
│   ├── public/
│   │   └── index.html          # HTML entry point for the React application
│   ├── src/
│   │   ├── components/         # UI components (Login, LogViewer, LogFilter, LogDetailModal, Notification, UserProfile)
│   │   ├── services/           # API configuration (Axios setup, Socket.IO integration)
│   │   ├── App.jsx             # Main React component
│   │   └── index.js            # React application entry point
│   ├── tests/                  # Unit tests and Cypress end-to-end tests for frontend components
│   ├── Dockerfile              # Containerization configuration for the frontend service
│   └── package.json            # Frontend dependencies and scripts
├── docs/
│   ├── api-spec.yaml           # OpenAPI (Swagger) specification for the backend API
│   ├── DEVELOPER_GUIDE.md      # Detailed guide for developers and contributors
│   └── README.md               # Project documentation and setup instructions
├── docker-compose.yml          # Multi-container orchestration configuration
├── CONTRIBUTING.md             # Contribution guidelines for the project
├── CODE_OF_CONDUCT.md          # Code of conduct for contributors
└── README.md                   # This file
```

## Setup & Installation

### Backend Setup

1. **Prerequisites:**

- [Node.js](https://nodejs.org/) (v14 or later)
- [MongoDB](https://www.mongodb.com/) (local instance or via Docker)
- [Docker](https://www.docker.com/) (optional, for containerized deployment)

2. **Installation:**

```bash
cd backend
npm install
```

3. **Environment Variables: Create a `.env` file in the `backend` directory with the following content:**

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
```

The backend server will run on the specified port (default is 5000).

5. **API Documentation:**

The OpenAPI spec is available at `docs/api-spec.yaml`.
View live API documentation using Swagger UI or ReDoc by pointing to the spec file.

### Frontend Setup

1. **Prerequisites:**

- .js (v14 or later)

2. **Installation:**

```bash
cd frontend
npm install
```

3. **Running the Application:**

```bash
npm start
```

The application will run on http://localhost:3000.

4. **Configuration:** If needed, create a `.env` file in the `frontend` directory to configure API endpoints and other settings.

## API Documentation

- The complete API specification is maintained in `docs/api-spec.yaml`.
- This specification includes details for:
  - **Authentication:** `/auth/login`
  - **Log Creation:** `/logs`
  - **Log Retrieval & Updates:** `/logs/{agent_id}`, `/logs/{agent_id}/{step_id}`, and `/logs/search`
  - **Log Summary:** `/logs/summary/{agent_id}`
- Security is implemented via JWT Bearer tokens.

## Testing

### Backend Tests

- **Run Unit and Integration Tests:**

```bash
  cd backend
  npm test
```

- **Security and Anomaly Detection Tests:**
  Additional test suites validate input handling, rate limiting, and anomaly detection logic.

### Frontend Tests

- **Run Unit Tests:**

```bash
  cd frontend
  npm test
```

- **End-to-End Tests (Cypress):**

```bash
  npx cypress open
```

Use Cypress to simulate complete user flows including login, dashboard interactions, filtering, and detailed log viewing.

## CI/CD Pipeline

- **GitHub Actions:**
  The CI/CD configuration is defined in `.github/workflows/ci.yml`. It performs the following:

  - Runs backend tests
  - Runs frontend tests
  - Executes Cypress end-to-end tests
  - Performs linting for code quality

- **Deployment Automation:**
  Docker Compose is used for multi-environment deployments (staging, production). For production scalability, consider container orchestration with Kubernetes.

## Developer Onboarding & Contribution

- **Developer Guide:**
  Refer to `docs/DEVELOPER_GUIDE.md` for comprehensive setup instructions, contribution workflows, and deployment guidelines.

- **Contribution Guidelines:**
  See `CONTRIBUTING.md` for coding standards, branch management, and pull request protocols.

## Environment Configuration & Secrets Management

- **Local Development:**
  Use `.env` files in the `backend` and `frontend` directories to manage configuration and secrets.

- **Production:**
  Adopt secure secrets management solutions (e.g., AWS Secrets Manager, HashiCorp Vault) to handle sensitive data in production environments.

## License

This project is licensed under the MIT License.
