-- ArogyaAI Database Schema for Supabase PostgreSQL
-- Run this in Supabase SQL Editor to create tables

-- Users table - Linked to Supabase Auth
CREATE TABLE IF NOT EXISTS users (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    phone VARCHAR(20),
    email VARCHAR(255),
    age INTEGER,
    gender VARCHAR(20),
    blood_type VARCHAR(5),
    allergies TEXT[] DEFAULT '{}',
    conditions TEXT[] DEFAULT '{}',
    medications TEXT[] DEFAULT '{}',
    emergency_contact VARCHAR(20),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    last_visit TIMESTAMP WITH TIME ZONE,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Conversations table
CREATE TABLE IF NOT EXISTS conversations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    type VARCHAR(20) DEFAULT 'text',
    message TEXT NOT NULL,
    response JSONB,
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Symptoms log table
CREATE TABLE IF NOT EXISTS symptoms_log (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    symptoms JSONB NOT NULL,
    duration VARCHAR(100),
    severity VARCHAR(20),
    triage_result JSONB NOT NULL,
    redflags_detected TEXT[] DEFAULT '{}',
    logged_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Emergency logs table
CREATE TABLE IF NOT EXISTS emergency_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    emergency_type VARCHAR(100) NOT NULL,
    symptoms_report TEXT,
    triage_score INTEGER,
    action_taken VARCHAR(100),
    contact_alerted VARCHAR(20),
    hospital_referred VARCHAR(255),
    triggered_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    resolved_at TIMESTAMP WITH TIME ZONE
);

-- Appointments table
CREATE TABLE IF NOT EXISTS appointments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    doctor_id VARCHAR(100) NOT NULL,
    doctor_name VARCHAR(255),
    appointment_date DATE NOT NULL,
    appointment_time TIME NOT NULL,
    reason TEXT,
    status VARCHAR(20) DEFAULT 'PENDING',
    location VARCHAR(255),
    notes TEXT,
    booked_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    cancelled_at TIMESTAMP WITH TIME ZONE,
    rescheduled_from TIMESTAMP WITH TIME ZONE
);

-- Family members table for Emergency Alerts
CREATE TABLE IF NOT EXISTS family_members (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    telegram_chat_id VARCHAR(100),
    relation VARCHAR(100),
    phone VARCHAR(20),
    connect_code VARCHAR(10) UNIQUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Symptom Timeline table
CREATE TABLE IF NOT EXISTS symptom_timeline (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    date DATE NOT NULL,
    raw_symptom_text TEXT,
    symptoms TEXT NOT NULL,
    risk_level VARCHAR(20),
    triage_score INTEGER,
    ai_summary TEXT,
    source VARCHAR(50),
    severity VARCHAR(20) NOT NULL,
    temperature VARCHAR(50),
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_conversations_user_id ON conversations(user_id);
CREATE INDEX IF NOT EXISTS idx_conversations_created_at ON conversations(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_symptoms_log_user_id ON symptoms_log(user_id);
CREATE INDEX IF NOT EXISTS idx_symptoms_log_logged_at ON symptoms_log(logged_at DESC);
CREATE INDEX IF NOT EXISTS idx_emergency_logs_user_id ON emergency_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_emergency_logs_triggered_at ON emergency_logs(triggered_at DESC);
CREATE INDEX IF NOT EXISTS idx_appointments_user_id ON appointments(user_id);
CREATE INDEX IF NOT EXISTS idx_appointments_date ON appointments(appointment_date);
CREATE INDEX IF NOT EXISTS idx_family_members_user_id ON family_members(user_id);
CREATE INDEX IF NOT EXISTS idx_symptom_timeline_user_id ON symptom_timeline(user_id);
CREATE INDEX IF NOT EXISTS idx_symptom_timeline_date ON symptom_timeline(date DESC);

-- ============================================
-- ROW LEVEL SECURITY (RLS) POLICIES
-- ============================================
-- IMPORTANT: These policies allow users to only see/edit their own data

-- Enable RLS on all tables
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE symptoms_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE emergency_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE appointments ENABLE ROW LEVEL SECURITY;
ALTER TABLE family_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE symptom_timeline ENABLE ROW LEVEL SECURITY;

-- Users table policies
DROP POLICY IF EXISTS "Users can view own profile" ON users;
CREATE POLICY "Users can view own profile" ON users FOR SELECT USING (auth.uid() = id);

DROP POLICY IF EXISTS "Users can insert own profile" ON users;
CREATE POLICY "Users can insert own profile" ON users FOR INSERT WITH CHECK (auth.uid() = id OR id IS NULL);

DROP POLICY IF EXISTS "Users can update own profile" ON users;
CREATE POLICY "Users can update own profile" ON users FOR UPDATE USING (auth.uid() = id);

-- Conversations policies
DROP POLICY IF EXISTS "Users can view own conversations" ON conversations;
CREATE POLICY "Users can view own conversations" ON conversations FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert own conversations" ON conversations;
CREATE POLICY "Users can insert own conversations" ON conversations FOR INSERT WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update own conversations" ON conversations;
CREATE POLICY "Users can update own conversations" ON conversations FOR UPDATE USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete own conversations" ON conversations;
CREATE POLICY "Users can delete own conversations" ON conversations FOR DELETE USING (auth.uid() = user_id);

-- Symptoms log policies
DROP POLICY IF EXISTS "Users can view own symptom logs" ON symptoms_log;
CREATE POLICY "Users can view own symptom logs" ON symptoms_log FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert own symptom logs" ON symptoms_log;
CREATE POLICY "Users can insert own symptom logs" ON symptoms_log FOR INSERT WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update own symptom logs" ON symptoms_log;
CREATE POLICY "Users can update own symptom logs" ON symptoms_log FOR UPDATE USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete own symptom logs" ON symptoms_log;
CREATE POLICY "Users can delete own symptom logs" ON symptoms_log FOR DELETE USING (auth.uid() = user_id);

-- Emergency logs policies
DROP POLICY IF EXISTS "Users can view own emergency logs" ON emergency_logs;
CREATE POLICY "Users can view own emergency logs" ON emergency_logs FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert own emergency logs" ON emergency_logs;
CREATE POLICY "Users can insert own emergency logs" ON emergency_logs FOR INSERT WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update own emergency logs" ON emergency_logs;
CREATE POLICY "Users can update own emergency logs" ON emergency_logs FOR UPDATE USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete own emergency logs" ON emergency_logs;
CREATE POLICY "Users can delete own emergency logs" ON emergency_logs FOR DELETE USING (auth.uid() = user_id);

-- Appointments policies
DROP POLICY IF EXISTS "Users can view own appointments" ON appointments;
CREATE POLICY "Users can view own appointments" ON appointments FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert own appointments" ON appointments;
CREATE POLICY "Users can insert own appointments" ON appointments FOR INSERT WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update own appointments" ON appointments;
CREATE POLICY "Users can update own appointments" ON appointments FOR UPDATE USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete own appointments" ON appointments;
CREATE POLICY "Users can delete own appointments" ON appointments FOR DELETE USING (auth.uid() = user_id);

-- Family members policies
DROP POLICY IF EXISTS "Users can view own family members" ON family_members;
CREATE POLICY "Users can view own family members" ON family_members FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert own family members" ON family_members;
CREATE POLICY "Users can insert own family members" ON family_members FOR INSERT WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update own family members" ON family_members;
CREATE POLICY "Users can update own family members" ON family_members FOR UPDATE USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete own family members" ON family_members;
CREATE POLICY "Users can delete own family members" ON family_members FOR DELETE USING (auth.uid() = user_id);

-- Symptom timeline policies
DROP POLICY IF EXISTS "Users can view own symptom timeline" ON symptom_timeline;
CREATE POLICY "Users can view own symptom timeline" ON symptom_timeline FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert own symptom timeline" ON symptom_timeline;
CREATE POLICY "Users can insert own symptom timeline" ON symptom_timeline FOR INSERT WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update own symptom timeline" ON symptom_timeline;
CREATE POLICY "Users can update own symptom timeline" ON symptom_timeline FOR UPDATE USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete own symptom timeline" ON symptom_timeline;
CREATE POLICY "Users can delete own symptom timeline" ON symptom_timeline FOR DELETE USING (auth.uid() = user_id);

-- Trigger for updating last_visit on users table
CREATE OR REPLACE FUNCTION update_last_visit()
RETURNS TRIGGER AS $$
BEGIN
    NEW.last_visit = NOW();
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS update_users_last_visit ON users;
CREATE TRIGGER update_users_last_visit
    BEFORE UPDATE ON users
    FOR EACH ROW
    EXECUTE FUNCTION update_last_visit();

-- Medical QR table
CREATE TABLE IF NOT EXISTS medical_qr (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    qr_id VARCHAR(100) UNIQUE NOT NULL,
    qr_url VARCHAR(255) NOT NULL,
    is_public BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE medical_qr ENABLE ROW LEVEL SECURITY;

-- Policies
DROP POLICY IF EXISTS "Users can view own medical QR" ON medical_qr;
CREATE POLICY "Users can view own medical QR" ON medical_qr FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert own medical QR" ON medical_qr;
CREATE POLICY "Users can insert own medical QR" ON medical_qr FOR INSERT WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update own medical QR" ON medical_qr;
CREATE POLICY "Users can update own medical QR" ON medical_qr FOR UPDATE USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete own medical QR" ON medical_qr;
CREATE POLICY "Users can delete own medical QR" ON medical_qr FOR DELETE USING (auth.uid() = user_id);

-- Also allow public select on medical_qr by qr_id so the emergency medical card can be scanned and viewed publicly
DROP POLICY IF EXISTS "Anyone can select medical QR by qr_id" ON medical_qr;
CREATE POLICY "Anyone can select medical QR by qr_id" ON medical_qr FOR SELECT USING (true);

-- Confirm tables created
SELECT 'Tables created successfully!' as status;

-- Add new columns for emergency_logs integration
ALTER TABLE emergency_logs ADD COLUMN IF NOT EXISTS latitude DOUBLE PRECISION;
ALTER TABLE emergency_logs ADD COLUMN IF NOT EXISTS longitude DOUBLE PRECISION;
ALTER TABLE emergency_logs ADD COLUMN IF NOT EXISTS maps_url VARCHAR(255);
ALTER TABLE emergency_logs ADD COLUMN IF NOT EXISTS pdf_sent BOOLEAN DEFAULT FALSE;
ALTER TABLE emergency_logs ADD COLUMN IF NOT EXISTS telegram_sent BOOLEAN DEFAULT FALSE;
ALTER TABLE emergency_logs ADD COLUMN IF NOT EXISTS sent_at TIMESTAMP WITH TIME ZONE DEFAULT NOW();
