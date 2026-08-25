# Local Deployment Guide — Handslag Protokoll

This guide covers running **Handslag Protokoll** on your local machine using Docker or native Node.js.

---

## ⚡ Option 1: Quick Start with Docker (Recommended)

Running with Docker ensures isolated execution without requiring local database or runtime configuration.

### 1. Build and Run the Container
```bash
# Build the local Docker image
docker build -t handslag-protokoll:local .

# Run the container on port 3000
docker run --rm -p 3000:8080 \
  -e INTEGRATION_MODE=mock \
  -e DATABASE_URL="file:/app/data/dev.db" \
  handslag-protokoll:local
```

### 2. Access the Application
Open [http://localhost:3000](http://localhost:3000) in your browser.

---

## 💻 Option 2: Native Local Development (Node.js 20+)

### Prerequisites
- Node.js `20.x` or higher
- npm `10.x` or higher

### 1. Clone & Install Dependencies
```bash
# Clone the repository
git clone https://github.com/theorjiugovictor/handslag-protocol.git
cd handslag-protocol

# Install dependencies
npm install
```

### 2. Environment Configuration
Create a `.env` file from the example:
```bash
cp .env.example .env
```

Ensure `.env` contains:
```env
DATABASE_URL="file:./data/dev.db"
INTEGRATION_MODE="mock"
PORT=3000
```

### 3. Initialize SQLite Database & Prisma Client
```bash
# Generate Prisma Client
npx prisma generate

# Apply migrations and seed mock organizations
npx prisma db push
node prisma/seed.js
```

### 4. Start Development Server
```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

---

## 🧪 Running Automated Tests

Run the core protocol test suite inside an ephemeral Docker container:
```bash
docker run --rm -v "$(pwd)":/app -w /app node:20-slim npx vitest run
```

Or run directly with npm:
```bash
npm test
```

---

## 🔍 Verifying the Local 1-Click Handshake Flow

1. Open [http://localhost:3000](http://localhost:3000) and click **"Enter Network"**.
2. Select **Nordic Components AB (Supplier)** from the login cards.
3. Click the **"AI Detected Invoices"** tab.
4. Click **"⚡ Auto-Initiate Handslag"** on invoice `INV-2026-1042`.
5. Notice that the AI agents automatically:
   - Match accounts payable in the background.
   - Run the Treasury forward cash curve.
   - Prepare the optimal proposal (€4,000 upfront today + €6,000 on Day 14).
6. Click **`[ 🤝 Seal Handslag & Execute ]`** to execute SEPA instant settlement, release the TransCare double-financing lien, and view the persistent **`SETTLEMENT BASIS`** audit proof.
