# 🏠 Airbnb Competitive Analysis Demo

A complete demo application with AI-powered competitive analysis for Airbnb listings.

## 🚀 Features

- **Real-time Competitive Analysis** - Analyze competitor pricing and market position
- **AI-Powered Pricing Recommendations** - Get intelligent pricing suggestions
- **Feature Gap Analysis** - Identify missing amenities that competitors offer
- **Description Optimization** - AI-generated content improvements
- **Automated Alerts** - Track competitor changes and market opportunities
- **Historical Tracking** - Store and analyze data over time
- **Scheduled Updates** - Background jobs to keep data current

## 🏗️ Architecture

```
Frontend (React) ↔️ Backend API (Express/Node.js) ↔️ MCP Server (@openbnb/mcp-server-airbnb)
                                ↕️
                          Database (MongoDB)
                                ↕️
                           AI Analysis (OpenAI)
```

## 📋 Prerequisites

- **Node.js** 18+ 
- **MongoDB** (local or MongoDB Atlas)
- **OpenAI API Key**
- **Git**

## ⚡ Quick Start

### 1. Clone and Setup

```bash
# Create project directory
mkdir airbnb-competitive-demo
cd airbnb-competitive-demo

# Initialize package.json
npm init -y

# Install dependencies
npm install express cors mongoose node-cron openai
npm install @modelcontextprotocol/sdk 
npm install -D typescript @types/node @types/express ts-node nodemon
npm install -D concurrently

# Install MCP server globally for testing
npm install -g @openbnb/mcp-server-airbnb
```

### 2. Project Structure

```
airbnb-competitive-demo/
├── backend/
│   ├── src/
│   │   └── server.ts          # Backend API code
│   ├── package.json
│   └── .env
├── frontend/
│   ├── src/
│   │   └── App.tsx            # React frontend code
│   └── package.json
├── docker-compose.yml         # MongoDB setup
└── README.md
```

### 3. Environment Setup

Create `backend/.env`:

```env
# Required
OPENAI_API_KEY=your_openai_api_key_here
MONGODB_URI=mongodb://localhost:27017/airbnb-demo

# Optional
PORT=3001
NODE_ENV=development
LOG_LEVEL=info
```

### 4. MongoDB Setup (Docker)

Create `docker-compose.yml`:

```yaml
version: '3.8'
services:
  mongodb:
    image: mongo:7
    ports:
      - "27017:27017"
    environment:
      MONGO_INITDB_DATABASE: airbnb-demo
    volumes:
      - mongodb_data:/data/db

volumes:
  mongodb_data:
```

Start MongoDB:
```bash
docker-compose up -d
```

### 5. Backend Setup

Create `backend/package.json`:

```json
{
  "name": "airbnb-demo-backend",
  "version": "1.0.0",
  "description": "Airbnb Competitive Analysis Demo Backend",
  "main": "dist/server.js",
  "scripts": {
    "dev": "nodemon --exec ts-node src/server.ts",
    "build": "tsc",
    "start": "node dist/server.js",
    "test-mcp": "npx @openbnb/mcp-server-airbnb"
  },
  "dependencies": {
    "express": "^4.18.2",
    "cors": "^2.8.5",
    "mongoose": "^7.6.3",
    "node-cron": "^3.0.2",
    "openai": "^4.20.1",
    "@modelcontextprotocol/sdk": "^0.4.0"
  },
  "devDependencies": {
    "typescript": "^5.2.2",
    "@types/node": "^20.8.0",
    "@types/express": "^4.17.20",
    "@types/cors": "^2.8.14",
    "ts-node": "^10.9.1",
    "nodemon": "^3.0.1"
  }
}
```

Create `backend/tsconfig.json`:

```json
{
  "compilerOptions": {
    "target": "ES2020",
    "module": "commonjs",
    "lib": ["ES2020"],
    "outDir": "./dist",
    "rootDir": "./src",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "resolveJsonModule": true
  },
  "include": ["src/**/*"],
  "exclude": ["node_modules", "dist"]
}
```

### 6. Frontend Setup (React with Vite)

```bash
# Create React app in frontend directory
cd frontend
npm create vite@latest . -- --template react-ts
npm install
npm install lucide-react
```

Update `frontend/package.json` scripts:

```json
{
  "scripts": {
    "dev": "vite --port 3000",
    "build": "tsc && vite build",
    "preview": "vite preview",
    "lint": "eslint . --ext ts,tsx --report-unused-disable-directives --max-warnings 0"
  }
}
```

### 7. Root Package.json (Workspace Management)

Create root `package.json`:

```json
{
  "name": "airbnb-competitive-demo",
  "version": "1.0.0",
  "description": "Airbnb Competitive Analysis Demo - Full Stack",
  "private": true,
  "workspaces": [
    "backend",
    "frontend"
  ],
  "scripts": {
    "install-all": "npm install && npm install --workspace=backend && npm install --workspace=frontend",
    "dev": "concurrently \"npm run dev --workspace=backend\" \"npm run dev --workspace=frontend\"",
    "build": "npm run build --workspace=backend && npm run build --workspace=frontend",
    "start": "npm start --workspace=backend",
    "test-mcp": "npx @openbnb/mcp-server-airbnb",
    "setup": "docker-compose up -d && npm run install-all"
  },
  "devDependencies": {
    "concurrently": "^8.2.2"
  }
}
```

## 🔧 Installation & Run

### One-Command Setup:

```bash
# Clone the demo files, then:
npm run setup
```

This will:
1. Start MongoDB with Docker
2. Install all dependencies
3. Setup workspaces

### Development Mode:

```bash
# Start both frontend and backend
npm run dev
```

- **Frontend**: http://localhost:3000
- **Backend API**: http://localhost:3001
- **MongoDB**: localhost:27017

### Production Build:

```bash
npm run build
npm start
```

## 🧪 Testing the MCP Server

Before running the full demo, test the MCP server:

```bash
# Test MCP server connectivity
npm run test-mcp

# In another terminal, test with a sample request:
echo '{"jsonrpc":"2.0","id":1,"method":"tools/list"}' | npx @openbnb/mcp-server-airbnb
```

## 📊 Demo Usage

### 1. **Start the Application**
```bash
npm run dev
```

### 2. **Open Browser**
Navigate to http://localhost:3000

### 3. **Enter Listing ID**
Use any Airbnb listing ID (e.g., "12345678")

### 4. **View Analysis Results**
- **Pricing Optimization**: AI recommendations for pricing
- **Feature Recommendations**: Missing amenities analysis  
- **Description Optimization**: Content improvement suggestions
- **Alerts & Insights**: Market changes and opportunities

## 🗄️ Database Schema

### Collections:

**listinganalyses**
- Stores complete competitive analysis results
- Pricing recommendations and market metrics
- Feature and description optimization data

**alerts** 
- Market change notifications
- Competitor activity tracking
- Revenue opportunity alerts

**competitortrackings**
- Historical price tracking per competitor
- Amenity change history
- Description evolution tracking

## 🔄 Automated Features

### Scheduled Jobs:

**Every 6 Hours:**
- Update competitor pricing data
- Generate new alerts for significant changes
- Refresh market metrics

**Daily at 8 AM:**
- Generate market insight reports
- Send summary notifications
- Clean up old data

### Real-time Features:

- **Price Change Alerts**: When competitors adjust pricing
- **Demand Spike Detection**: Market-wide price increases
- **New Amenity Tracking**: Competitor feature additions

## 🚀 Deployment Options

### 1. **Local Development**
```bash
npm run dev
```

### 2. **Docker Deployment**

Create `Dockerfile`:

```dockerfile
FROM node:18-alpine
WORKDIR /app

# Copy package files
COPY package*.json ./
COPY backend/package*.json ./backend/
COPY frontend/package*.json ./frontend/

# Install dependencies
RUN npm run install-all

# Copy source code
COPY . .

# Build application
RUN npm run build

# Expose port
EXPOSE 3001

# Start application
CMD ["npm", "start"]
```

```bash
docker build -t airbnb-demo .
docker run -p 3001:3001 -e OPENAI_API_KEY=your_key airbnb-demo
```

### 3. **Cloud Deployment**

**Environment Variables for Production:**

```env
OPENAI_API_KEY=your_openai_api_key
MONGODB_URI=mongodb+srv://user:pass@cluster.mongodb.net/airbnb-demo
NODE_ENV=production
PORT=3001
```

**Deploy to:**
- **Heroku**: `git push heroku main`
- **Vercel**: `vercel --prod`
- **DigitalOcean**: Use App Platform
- **AWS**: Elastic Beanstalk or ECS

## 🔒 Security Considerations

### API Security:
```typescript
// Add rate limiting
import rateLimit from 'express-rate-limit';

const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100 // limit each IP to 100 requests per windowMs
});

app.use('/api/', limiter);
```

### Environment Variables:
- Never commit `.env` files
- Use proper secrets management in production
- Rotate API keys regularly

## 📈 Business Model Integration

### Subscription Tiers:

**Free Demo:**
- 3 analyses per month
- Basic competitor tracking
- Standard AI recommendations

**Pro ($29/month):**
- Unlimited analyses  
- Real-time alerts
- Advanced AI insights
- Historical data export

**Enterprise ($99/month):**
- Multiple property management
- API access
- Custom reporting
- Priority support

### Revenue Tracking:

```typescript
// Add to backend
const subscriptionSchema = new mongoose.Schema({
  userId: String,
  tier: { type: String, enum: ['free', 'pro', 'enterprise'] },
  analysesUsed: { type: Number, default: 0 },
  analysesLimit: Number,
  billingDate: Date,
  isActive: { type: Boolean, default: true }
});
```

## 🐛 Troubleshooting

### Common Issues:

**MCP Server Connection Failed:**
```bash
# Check if MCP server is accessible
npx @openbnb/mcp-server-airbnb --help

# Test with ignore robots.txt
npx @openbnb/mcp-server-airbnb --ignore-robots-txt
```

**MongoDB Connection Error:**
```bash
# Restart MongoDB
docker-compose restart mongodb

# Check connection
mongosh mongodb://localhost:27017/airbnb-demo
```

**OpenAI API Errors:**
- Verify API key is correct
- Check API quota and billing
- Test with a simple API call

**CORS Issues:**
```typescript
// Update CORS configuration
app.use(cors({
  origin: ['http://localhost:3000', 'https://yourdomain.com'],
  credentials: true
}));
```

## 📚 API Documentation

### Core Endpoints:

**POST /api/analyze**
```json
{
  "listingId": "12345678"
}
```

**GET /api/history/:listingId**
- Returns analysis history

**GET /api/alerts/:listingId?unreadOnly=true**
- Returns alerts for listing

**POST /api/alerts/:listingId/mark-read**
```json
{
  "alertIds": ["alert1", "alert2"]
}
```

## 🤝 Contributing

1. Fork the repository
2. Create feature branch (`git checkout -b feature/amazing-feature`)
3. Commit changes (`git commit -m 'Add amazing feature'`)
4. Push to branch (`git push origin feature/amazing-feature`)
5. Open Pull Request

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🆘 Support

- **Documentation**: Check this README
- **Issues**: Create GitHub issues for bugs
- **Discussions**: Use GitHub Discussions for questions
- **Email**: support@yourcompany.com

---

**🎉 Your Airbnb Competitive Analysis Demo is ready!**

This demo showcases the full potential of AI-powered competitive intelligence for Airbnb hosts, combining real-time data collection, intelligent analysis, and automated insights to help maximize revenue and occupancy.