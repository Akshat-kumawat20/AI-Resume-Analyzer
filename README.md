# AI-Resume-Analyzer
An intelligent AI-powered Resume Analyzer that evaluates resumes against a target job role using a multi-step AI agent pipeline. The system extracts key insights, identifies skill gaps, and provides actionable suggestions to improve ATS (Applicant Tracking System) compatibility.

# ✨ Features
 📄 Upload Resume (PDF/DOCX)

Extracts text from resumes using file parsing libraries

🤖 AI-Powered Multi-Step Analysis

• Resume background understanding

• Skill extraction

• Missing skills detection

• Strengths & weaknesses evaluation

• ATS score generation

⚡ Real-Time Streaming (SSE)

• Displays step-by-step analysis progress

• Improves user experience like ChatGPT-style responses

🎯 Role-Based Evaluation

• Analyze resume based on a specific target job role

• Provides tailored suggestions

🧠 ATS Score & Feedback

• Score between 0–100

• Label: Excellent / Good / Needs Work / Poor

• Actionable improvement tips

🔄 Auto Resume Loading (Optional)

• Load resume directly from system path using .env

• Useful for testing and demos

# 🛠️ Tech Stack

• Frontend: HTML, CSS, JavaScript

• Backend: Node.js, Express.js

• File Processing: Multer, pdf-parse, Mammoth

• AI Integration: Ollama API (LLM - Gemma 3)

• Streaming: Server-Sent Events (SSE)

# 🧠 How It Works

1. User uploads resume or uses auto-loaded resume from .env
2. Backend extracts text from PDF/DOCX
3. AI Agent Pipeline executes:

   • Step 1: Resume summarization

   • Step 2: Skill extraction

   • Step 3: Missing skills detection

   • Step 4: Strength & weakness analysis

   • Step 5: ATS scoring & suggestions

4. Results are streamed in real-time to the frontend

# 📊 Output Includes

✅ Skills detected

❌ Missing skills

💪 Strengths

⚠️ Weaknesses

💡 Suggestions

📈 ATS Score (0–100)

# 🚀 Future Improvements

• Resume–Job Description matching

• Chat with Resume (AI assistant)

• Resume rewriting & optimization

• User dashboard & history tracking
