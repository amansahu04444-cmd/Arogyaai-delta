# 🚑 ArogyaAI – Agentic Public Healthcare Assistant

> AI-powered healthcare triage, symptom timeline tracking, emergency detection, and hospital recommendation platform built for underserved communities.

![ArogyaAI Banner](https://img.shields.io/badge/Healthcare-AI-blue)
![React](https://img.shields.io/badge/Frontend-React%20%2B%20Vite-61DAFB)
![Express](https://img.shields.io/badge/Backend-Express.js-000000)
![FastAPI](https://img.shields.io/badge/AI-FastAPI-009688)
![Supabase](https://img.shields.io/badge/Database-Supabase-3ECF8E)
![Gemini](https://img.shields.io/badge/LLM-Gemini%202.5%20Flash-orange)

---

# 📖 Overview

ArogyaAI is an **Agentic AI-powered healthcare assistant** designed to improve healthcare accessibility through:

- 🗣️ Voice-based symptom collection
- 🧠 AI-powered triage
- 📅 Symptom timeline tracking
- 🚨 Emergency detection
- 🏥 Nearby hospital recommendations
- 👨‍👩‍👧 Care Circle management
- 📄 Doctor-ready health summaries

Unlike traditional healthcare chatbots, ArogyaAI functions as a **multi-agent healthcare decision support system** that helps patients organize symptoms, assess urgency, and prepare for consultations.

---

# 🎯 Problem Statement

Patients often visit doctors without maintaining a structured symptom history.

This leads to:

- Missing health context
- Delayed consultations
- Poor symptom tracking
- Difficulty identifying progression patterns

ArogyaAI addresses this through **AI-driven symptom timeline tracking and healthcare triage.**

---

# ✨ Key Features

## 🗣️ Voice Triage

- Hindi support
- English support
- Hinglish support
- Speech-to-Text
- Text-to-Speech

---

## 📅 Symptom Timeline Tracker

Track symptoms day-wise:

- Symptoms
- Severity
- Temperature
- Notes
- Timeline history

Generate a clean timeline summary before visiting a doctor.

---

## 🧠 AI Triage System

Risk Classification:

| Risk Level | Action |
|------------|----------|
| 🟢 Low | Home Care |
| 🟡 Medium | Doctor Consultation |
| 🔴 High | Emergency Attention |

Outputs:

- Triage Score
- Risk Level
- Recommended Action
- Health Summary

---

## 🚨 Emergency Detection

Instantly detects:

- Chest pain
- Difficulty breathing
- Heavy bleeding
- Unconsciousness
- Severe symptoms

Actions:

- Emergency Alert
- Nearby Hospital Recommendation
- Guardian Notification
- SOS Workflow

---

## 🏥 Hospital Recommendation

Provides:

- Nearby hospitals
- Emergency facilities
- Distance information
- Location-based recommendations

---

## 🧠 Patient Memory

Stores:

- Previous symptoms
- Conversations
- Timeline history
- Health summaries

Enables personalized healthcare guidance.

---

## 👨‍👩‍👧 Care Circle

Manage:

- Family members
- Emergency contacts
- Shared healthcare monitoring

---

## 📄 Doctor Summary Report

Automatically generates:

- Symptom timeline
- Triage assessment
- Risk classification
- Consultation summary

---

# 🏗️ System Architecture

```text
Frontend (React + Vite)
          ↓
Backend (Express.js)
          ↓
AI Service (FastAPI + Gemini)
          ↓
Supabase PostgreSQL
```

---

# 🤖 Agentic AI Workflow

```text
User Input
      ↓
Input Agent
      ↓
Symptom Extraction Agent
      ↓
Triage Agent
      ↓
Recommendation Agent
      ↓
Memory Agent
      ↓
Response
```

---

# 🧩 AI Agents

### Input Agent

Responsibilities:

- Speech Processing
- Text Cleaning
- Language Detection

---

### Symptom Extraction Agent

Extracts:

- Symptoms
- Duration
- Severity
- Patient Context

---

### Triage Agent

Determines:

- Risk Level
- Triage Score
- Required Action

---

### Recommendation Agent

Generates:

- Home Care Guidance
- Doctor Recommendation
- Hospital Suggestions

---

### Memory Agent

Maintains:

- Timeline History
- User Context
- Session Summaries

---

# ⚙️ Tech Stack

## Frontend

- React
- Vite
- Tailwind CSS
- Zustand
- Web Speech API
- Leaflet

---

## Backend

- Node.js
- Express.js
- Axios
- JWT
- Telegram Bot API

---

## AI Service

- FastAPI
- Gemini 2.5 Flash
- Pydantic

---

## Database

- Supabase
- PostgreSQL

---

## Maps

- OpenStreetMap
- Leaflet

---

# 📂 Project Structure

```text
arogyaAi-alpha/
│
├── frontend/
│
├── backend/
│
├── ai-service/
│
└── database/
```

---

# 🔌 API Endpoints

## Chat

```http
POST /api/chat
```

---

## Triage

```http
POST /api/triage
```

---

## Emergency

```http
POST /api/emergency
```

---

## Timeline

```http
GET /api/timeline
POST /api/timeline
```

---

## Hospitals

```http
GET /api/hospitals
```

---

## Reports

```http
POST /api/reports
GET /api/reports
```

---

# 🚀 Local Setup

## Clone Repository

```bash
git clone https://github.com/your-username/arogyaai.git
cd arogyaai
```

---

# Frontend

```bash
cd frontend

npm install

npm run dev
```

Runs on:

```text
http://localhost:5173
```

---

# Backend

```bash
cd backend

npm install

npm run dev
```

Runs on:

```text
http://localhost:5000
```

---

# AI Service

```bash
cd ai-service

python -m venv venv

venv\Scripts\activate

pip install -r requirements.txt

uvicorn app.main:app --reload
```

Runs on:

```text
http://localhost:8000
```

---

# Environment Variables

## Frontend

```env
VITE_API_URL=http://localhost:5000
```

---

## Backend

```env
PORT=5000

SUPABASE_URL=your_supabase_url

SUPABASE_SERVICE_KEY=your_supabase_key

AI_SERVICE_URL=http://localhost:8000

JWT_SECRET=your_secret
```

---

## AI Service

```env
GEMINI_API_KEY=your_gemini_api_key
```

---

# 🌍 Deployment

## Frontend

Platform:

```text
Vercel
```

---

## Backend

Platform:

```text
Render
```

---

## AI Service

Platform:

```text
Render
```

---

## Database

Platform:

```text
Supabase
```

---

# 🏆 CPL 2026 Alignment

### Problem Statement

**Symptom Timeline Tracker for Doctors**

ArogyaAI enables patients to:

- Record symptoms day-wise
- Maintain symptom history
- Generate doctor-ready summaries
- Improve consultation efficiency

while extending the solution with:

- AI Triage
- Emergency Detection
- Voice Interface
- Hospital Recommendations
- Care Circle

---

# 🔒 Responsible AI

ArogyaAI does **NOT** provide medical diagnosis.

The platform is designed for:

- Healthcare triage
- Symptom tracking
- Consultation preparation
- Emergency awareness

For medical emergencies:

```text
Contact emergency services immediately.
```

---

# 🚀 Future Scope

- Wearable Integration
- Offline Mode
- Government Health APIs
- Doctor Dashboard
- Appointment Booking
- Multilingual Expansion

---

# 👨‍💻 Team

Built with ❤️ to improve healthcare accessibility through AI.

**ArogyaAI – Healthcare Guidance When It Matters Most**
