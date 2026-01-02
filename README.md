# 🎓 AI Student Advisor

A full-stack intelligent student consultation platform built with Next.js 16, featuring a multi-agent AI system for personalized academic guidance, career counseling, and wellness support.

## 🚀 Tech Stack

**Frontend:**
- Next.js 16 (App Router) with React 19 & TypeScript
- Tailwind CSS 4 for modern, responsive UI
- Radix UI components for accessibility
- Framer Motion animations
- React Hook Form + Zod validation

**Backend:**
- Next.js API Routes
- Prisma ORM with PostgreSQL
- NextAuth.js authentication
- Supabase integration

**AI & ML:**
- Multi-agent architecture (Academic, Career, Wellness, General)
- RAG with Pinecone vector database
- LangChain for LLM orchestration
- Google Gemini AI & Groq
- Voice transcription & synthesis
- Image analysis with CLIP embeddings

## ✨ Features

- 💬 Real-time chat with AI reasoning visualization
- 🎤 Voice input/output support
- 📄 Document upload and semantic search
- 🤖 Intelligent query routing to specialized agents
- 👤 User authentication and profiles
- 📊 Conversation history tracking
- 🔍 Context-aware responses using RAG

## 🛠️ Getting Started

1. **Install dependencies:**
   ```bash
   npm install
   ```

2. **Set up environment variables:**
   Create a `.env` file with required API keys and database URLs.

3. **Initialize database:**
   ```bash
   npx prisma migrate dev
   ```

4. **Run development server:**
   ```bash
   npm run dev
   ```

5. Open [http://localhost:3000](http://localhost:3000) in your browser.

## 📁 Project Structure

```
├── app/              # Next.js App Router
├── components/       # React components
├── lib/              # Core logic & services
│   ├── agents/      # Multi-agent AI system
│   ├── ai/          # AI services
│   └── db/          # Database operations
├── prisma/          # Database schema
└── scripts/         # Utility scripts
```

## 🔧 Scripts

- `npm run dev` - Start development server
- `npm run build` - Build for production
- `npm run start` - Start production server
- `npm run lint` - Run ESLint

## 🌟 Key Highlights

- Modern full-stack architecture with TypeScript
- Modular AI agent system with tool registry
- Streaming responses for real-time interaction
- Vector-based semantic search
- Comprehensive document processing pipeline

---

Built with Next.js | Powered by AI

