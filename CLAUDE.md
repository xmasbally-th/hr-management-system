# HR Management Information System - AI Agent Instructions

## 1. Project Context
You are an expert full-stack developer assisting in building a comprehensive HR Management Information System for ~100 users.
The system is uniquely designed to support a **Hybrid Workflow**, accommodating both digital requests and physical paper workflows (where HR inputs data on behalf of employees and uploads scanned signed documents)[cite: 1].

## 2. Tech Stack
- **Framework:** Next.js (App Router)
- **Styling:** Tailwind CSS, Shadcn UI
- **Database & Auth:** Supabase (PostgreSQL, Supabase Auth, Storage)
- **Supabase Client:** Strictly use `@supabase/ssr`.
- **Deployment:** Vercel

## 3. Core Business Logic & Workflows

### 3.1 Role-Based Access Control (RBAC)
The system has 4 strict roles[cite: 1]:
- **Employee:** View own data, submit leave/travel requests[cite: 1].
- **Manager:** Read-only access to all personnel data, approve/reject requests, view reports[cite: 1].
- **HR:** Full access to all personnel data, manage all requests, input data for paper-based requests, upload scanned documents, generate reports[cite: 1].
- **Admin:** Full system access, manage document templates, import/export, system settings[cite: 1].

### 3.2 Leave Management (4 Types)
The system handles 4 specific leave types, each with unique rules[cite: 1]:
1. **Sick Leave:** Requires reason, contact number, and medical certificate (optional)[cite: 1].
2. **Personal Leave:** Requires reason and contact number[cite: 1].
3. **Maternity Leave:** Requires expected delivery date, fixed 90 days[cite: 1].
4. **Vacation Leave (Most Complex):** Requires calculation of accumulated days + annual days, assignment of up to 3 acting substitutes, and optional branch head opinion[cite: 1].

### 3.3 Official Travel Requests (3 Types)
Handles requests for Training/Seminars, Student Supervision, and Official Contacts[cite: 1].
- **IMPORTANT BUDGET RULE:** Travel expenses must be tracked in two phases:
  1. **Estimated Budget:** Input during the initial request phase.
  2. **Actual Disbursed Budget:** Input after the travel is completed and the employee claims the expenses.
- Must auto-generate official appointment orders (Word documents) from templates[cite: 1].

### 3.4 The "Paper Channel" Workflow
For users submitting physical forms[cite: 1]:
1. Employee submits paper to HR[cite: 1].
2. HR inputs data into the system on their behalf[cite: 1].
3. (For Travel) System generates official order docs. HR prints them[cite: 1].
4. HR routes physical docs for Manager signature[cite: 1].
5. HR scans the signed docs, uploads to Supabase Storage, and marks status as Processing/Completed[cite: 1].
6. HR forwards the original paper to the main agency[cite: 1].

### 3.5 Tracking & Notifications
- Every workflow step must trigger automated notifications to relevant parties (e.g., Status changes to 'Awaiting Signature', 'Approved', 'Completed')[cite: 1].

## 4. Database Schema Highlights
- `profiles`: Core user data + Role + Status[cite: 1].
- `leave_vacation_details`: Specific table for vacation complexities (accumulated days, substitutes)[cite: 1].
- `travel_expenses`: Tracks travel costs[cite: 1]. **Must include `expense_category`, `estimated_amount` (decimal), and `actual_amount` (decimal) to handle budget separation.**
- `document_tracking`: Tracks the physical location of paper documents (scanned date, sent to agency date)[cite: 1].
- `employee_trainings`: Logs all training and seminar history[cite: 1].

## 5. AI Agent Strict Execution Rules
1. **Wait for Approval:** Execute tasks strictly step-by-step. After completing a requested step (code or SQL), **STOP IMMEDIATELY**. Provide a short summary and explicitly ask the user for approval to proceed to the next step.
2. **Do Not Hallucinate DB Schema:** Always refer to the schema structure outlined in this document. If a column is missing, ask the user before creating it.
3. **Server Actions First:** Use Next.js Server Actions for data mutations instead of API routes.
4. **RLS is Mandatory:** Ensure every Supabase table has strict Row Level Security policies matching the RBAC rules.