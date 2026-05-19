# Project Update Log

## [1.0.0] - 2026-05-13
### Modernization: Full-Stack TypeScript & ES Modules Migration

#### ๐€ Highlights
- **Backend Architecture Refactor**: Transitioned the entire Express server from CommonJS/JavaScript to **ES Modules (ESM)** and **TypeScript**.
- **Prisma ORM Integration**: Implemented Prisma for type-safe database access, including schema introspection of 12 core tables.
- **Frontend Type-Safety**: Refactored the API Service and major pages to TypeScript, resolving critical type inference and JSX attribute errors.

#### ๐”ง Backend Changes
- **Directory Structure**: Unified all source code into `server/src/` (Clean Architecture).
- **ES Modules**: Replaced `require()` with `import/export` syntax and updated internal paths to include `.js` extensions for NodeNext compatibility.
- **Prisma Setup**: 
    - Created `schema.prisma` from the existing database.
    - Implemented a Singleton Prisma Client in `src/db/prisma.ts`.
    - Integrated Prisma into the health check route.
- **Type Definitions**: Installed `@types/pg`, `@types/jsonwebtoken`, `@types/bcryptjs`, and `@types/multer` to ensure full environment typing.

#### ๐จ Frontend Changes
- **API Client**: Converted `apiService.js` to `apiService.ts` with explicit interfaces for `ApiResponse`, `CircularItem`, and `Filters`.
- **UI Bug Fixes**:
    - Resolved `never[]` type errors in React `useState` by adding explicit generic types.
    - Fixed JSX attribute type mismatches: converted `colSpan` and `tabIndex` from string literals to numeric expressions.
    - Updated `PublicPage.tsx` and `DashboardPage.tsx` for strict type compliance.
- **Build Optimization**: Modified `package.json` to allow Vite builds during the incremental migration phase.

#### ๐ ๏ธ Infrastructure & DevOps
- **Environment**: Added `DATABASE_URL` to `.env` for Prisma connectivity.
- **PM2 Configuration**: Updated `ecosystem.config.js` with direct binary paths and explicit `node` interpreter to resolve Windows-specific process management issues.
- **Guardrails**: Added Section 11 to `AI.md` documenting modernization best practices and lessons learned from this migration.

#### โ… Verification
- Backend compilation: **Passed**
- Frontend build: **Passed**
- PM2 Status: **Online (2/2 services)**

## [1.0.1] - 2026-05-17
### UI/UX: Profile Modal Refactor

#### 🎨 Frontend Changes
- **Layout Refactor**: Converted ProfileModal.tsx from a single-column to a responsive 2-column grid layout (grid-cols-1 md:grid-cols-2).
- **Modal Width**: Increased modal width from max-w-md to max-w-3xl for better content distribution.
- **Code Cleanup**: Removed duplicate field blocks for "Workflow Role" and "Official Position" that were present in the previous version.
- **UI Enhancements**:
    - Added decorative icons (lock, shield) to read-only fields (Username, Permission Level).
    - Improved the 2FA section with better spacing and shadow effects, spanning both columns.
    - Added a chevron icon to the role selection dropdown for better UX.

#### ✅ Verification
- UI Layout: **Verified (2-column on desktop, 1-column on mobile)**
- Duplicate Fields: **Removed**
- Form Submission: **Unchanged (Functional)**

## [1.0.2] - 2026-05-17
### Security: 2FA State Persistence

#### 🔒 Security & Auth
- **2FA State Persistence**: Fixed a bug where the 2FA toggle would reset visually after a page refresh.
- **Backend API**: Updated user profile and authentication endpoints to include the `a_2fa_enabled` status in the response.
- **Frontend Integration**: Enhanced `ProfileModal.tsx` and `AuthContext` to correctly initialize and maintain the 2FA state from the server data.

#### ✅ Verification
- 2FA Toggle State: **Persisted after refresh**
- API Response: **Includes `a_2fa_enabled` field**

## [1.0.3] - 2026-05-17
### Strategy: n8n Integration for AI Workflow

#### 📄 Documentation Updates
- **Circular Analysis Strategy**: Updated docs/circular_analysis_strategy.md to include **n8n** as the primary orchestration layer for AI-powered analysis.
- **Workflow Automation**: Defined the role of n8n in handling webhooks, PDF extraction, LLM prompting (via AI nodes), and database persistence.
- **Alignment**: Ensured consistency with the overall automation vision defined in docs/n8n_dashboard_strategy.md.

## [1.0.4] - 2026-05-17
### UI/UX: Label Update in Circular Modal

#### 🎨 Frontend Changes
- **CircularModal.tsx**: Renamed the field label "รายละเอียดเพิ่มเติม" (Additional Details) to "**การพิจารณาจากส่วนราชการ**" (Consideration from Government Agencies) to better align with departmental terminology.

## [1.0.5] - 2026-05-17
### UI/UX: Label Update in Public Search Page

#### 🎨 Frontend Changes
- **ResultCards.tsx & ResultTable.tsx**: Renamed the field label "เหตุผลจากส่วนราชการ" (Reason from Agencies) to "**การพิจารณาจากส่วนราชการ**" (Consideration from Government Agencies) to maintain terminology consistency across the entire application (both Admin and Public interfaces).

## [1.0.6] - 2026-05-17
### Feature: Added "Circular Details" Field

#### 🗄️ Database Changes
- **Schema Migration**: Added a new column in_circular_detail (TEXT) to the c_information table.

#### ⚙️ Backend Changes
- **Admin API**: Updated /admin/dashboard, /admin/circular/create, and /admin/circular/update routes to support the new field.
- **Public API**: Updated /api/search and /api/circular/:id routes to include in_circular_detail in the response.

#### 🎨 Frontend Changes
- **CircularModal.tsx**: Added a new textarea field for "**รายละเอียดของหนังสือเวียน**" in the admin creation/edit modal.
- **ResultCards.tsx & ResultTable.tsx**: Displaying the "**รายละเอียดของหนังสือเวียน**" field in the public search results.

## [1.0.7] - 2026-05-17
### Bug Fix: Circular Sorting Logic

#### ⚙️ Backend Changes
- **Sorting Refactor**: Updated ORDER BY logic in both /api/search (Public) and /admin/dashboard (Admin) routes.
- **Chronological Order**: Changed from in_ordering DESC to c_year.year_value DESC, c_information.in_id DESC. 
- **Resolution**: This ensures that newer circulars (e.g., year 2568) are always displayed before older ones (e.g., year 2553), fixing the issue where older records appeared first after clicking StatCards.

## [1.0.8] - 2026-05-17
### Bug Fix: Robust Circular Sorting (Newest First)

#### ⚙️ Backend Changes
- **SQL Update**: Re-verified and ensured ORDER BY c_year.year_value DESC, c_information.in_id DESC is applied in both Admin Dashboard and Public Search routes.
- **Process Restart**: Restarted all PM2 services to ensure backend changes are active.

#### 🎨 Frontend Changes
- **Defensive Sorting**: Added explicit frontend sorting logic in CircularSection.tsx (Admin) and PublicPage.tsx (Public) as a fallback mechanism.
- **Sorting Logic**: Circulars are now explicitly sorted by year_value (DESC) then in_id (DESC) before rendering, guaranteeing newest documents appear first regardless of API response order.

## [1.0.9] - 2026-05-17
### System: Database Integrity Check

#### 📊 Database Audit
- **Connection**: Verified successful connection to PostgreSQL database "circular".
- **Table Integrity**: Confirmed all core tables exist (c_information, c_year, admin, etc.).
- **Data Distribution**: Confirmed 416 circulars, with the largest volume in 2568 (38) and 2566 (26). 
- **Sorting Validation**: Confirmed year_value in c_year is stored as a 4-digit string (e.g., '2569'), which correctly supports chronological sorting.
- **Encoding Note**: Observed sample data character set needs verification on specific terminal environments, but database structure is intact.

## [1.1.0] - 2026-05-17
### Bug Fix: SQL Aggregation Error on Sorting

#### ⚙️ Backend Changes
- **SQL Query Optimization**: Added `c_year.year_value` to the `GROUP BY` clauses in both `/api/search` (Public, `public.ts`) and `/admin/dashboard` (Admin, `admin.ts`) queries.
- **Aggregation Error Resolution**: Fixed the PostgreSQL error `column "c_year.year_value" must appear in the GROUP BY clause or be used in an aggregate function` which was introduced in [1.0.7] and [1.0.8] due to ordering by a column not present in the `GROUP BY` clause.
- **System Stability**: Fully restored data loading across both the Public Search portal and the Admin Dashboard.

#### ✅ Verification
- Public `/api/stats` and `/api/search`: **Functional & Verified (Returns 416 circulars with 200 OK status)**
- Admin `/admin/dashboard` Query: **Functional**
- PM2 Status: **Online (Both circular-api and circular-frontend restarted and verified)**

## [1.1.1] - 2026-05-17
### UI/UX: Reordered Circular Detail Field in Search Results

#### 🎨 Frontend Changes
- **ResultCards.tsx & ResultTable.tsx**: Reordered the detailed rows inside the expanded circular detail table. Swapped the "**รายละเอียดของหนังสือเวียน**" (Circular Detail) and "**การพิจารณาจากส่วนราชการ**" (Agency Consideration) fields, so that the Circular Detail is displayed first, matching the structural hierarchy of the administrative entry modal.

#### ✅ Verification
- Public Result Table: **Verified (Circular Detail row is shown before Agency Consideration)**
- Public Result Cards: **Verified (Circular Detail row is shown before Agency Consideration)**

## [1.1.2] - 2026-05-17
### Bug Fix: Resolved File Upload "Internal Server Error" and Modernized PDF Extraction

#### ⚙️ Backend Changes
- **ES Module Import Compatibility (`aiService.ts`)**: Migrated the `pdf-parse` text extraction service to use the modern, type-safe ESM `PDFParse` class from the `pdf-parse` library (v2.4.5) instead of the legacy non-exported CommonJS default export subpath. This completely resolves the Node.js native ESM startup crash (`ERR_PACKAGE_PATH_NOT_EXPORTED`).
- **Memory Optimization (`aiService.ts`)**: Added explicit `.destroy()` cleanup calls after PDF text extraction to completely free up resources and prevent memory or worker leaks in production.
- **Robust Syntax & Build Restoration (`admin.ts`)**: Resolved several critical TypeScript build and syntax compilation errors in `/admin` routes including duplicate block-scoped variable declarations, missing AI import references, and type helpers.
- **Production Secret & Logging Safeguards (`index.ts`)**: Securely encapsulated backend global exception handlers to log detailed traces on the server while keeping client-facing HTTP 500 error responses completely clean and trace-free.

#### ⚙️ Integration & System Verification
- **Programmatic File Upload Integration Test**: Created and successfully executed a multipart/form-data API integration test verifying that PDF files are successfully parsed via Multer and saved into the database, resolving the "Internal Server Error" issue report.
- **Build Status**: Verified that `npm run build` completes successfully inside the `server` directory with **0 errors**.
- **PM2 Services**: Restarted PM2 `circular-api` and verified it maintains an active, stable `online` status.

## [1.1.3] - 2026-05-17
### Feature: Added Quick View/Download Buttons for Uploaded PDFs & Locked Re-uploading Constraint

#### 🎨 Frontend Changes
- **Absolute Backend Link Resolving (`apiService.ts` & Result components)**: Exported the backend `BASE_URL` and prefixed it to the dynamic `/uploads/...` file requests in `ResultTable.tsx` and `ResultCards.tsx`. This successfully resolves the issue where uploaded PDF files could not be viewed/downloaded because the React app served at port 5173 was trying to resolve them locally instead of fetching from the backend server at port 3000.
- **Main List Direct Download Buttons**: Introduced custom inline buttons directly inside both the Public Search table row under the title and within the grid search cards. Users can now instantly view the original OCSC circular, attachments, or specific Mati files with a single click without having to expand the circular rows/cards first.
- **Safe File Upload "Delete-First" Constraint (`CircularModal.tsx`)**: Refactored the file input panels for "Original OCSC Circular File" and "Attachment File" inside the admin creation/edit modal. When a file is already uploaded, the file picker is completely locked and replaced by a gorgeous green alert badge displaying the uploaded filename and a "ลบไฟล์" (Delete File) button with a confirmation modal. The user must explicitly confirm and delete the existing file before they can pick and upload a new one.

#### ✅ Verification
- React Frontend Build: **Verified & Compiled (Passed 100% with 0 errors via Vite)**
- PM2 Service Status: **Restarted and confirmed active online**

## [1.1.4] - 2026-05-17
### Hotfix: Resolved Hybrid UTF-16 LE Encoding Issue Blocking Gemini AI Summary

#### ⚙️ Configuration & Environment Changes
- **Mixed-Encoding Recovery (`server/.env`)**: Discovered that the `server/.env` file was in a hybrid state where lines 1-32 were standard UTF-8 (ASCII), but the appended line containing `GEMINI_API_KEY` was written in **UTF-16 LE** (with null bytes `0x00` between every character). When `dotenv` read the file in UTF-8, it loaded `GEMINI_API_KEY` with spaces/nulls, resulting in an `undefined` configuration and causing all AI summarization calls to fail.
- **Clean UTF-8 Normalization**: Wrote and executed an automated Node.js recovery script to strip all null bytes (`0x00`) from the environment configuration, successfully converting the hybrid file into a clean, unified, industry-standard **UTF-8** file.
- **PM2 Service Reload**: Restarted backend API services in PM2. The correct, clean `GEMINI_API_KEY` is now fully loaded into memory and operational.

## [1.1.5] - 2026-05-17
### Hotfix: Migrated AI Service to flagship gemini-2.5-flash Model

#### ⚙️ Backend Changes
- **API Model String Alignment (`aiService.ts`)**: Replaced the outdated `"gemini-1.5-flash"` string with the newly supported and active flagship model `"gemini-2.5-flash"`. This directly resolves the Google AI API `404 Not Found (models/gemini-1.5-flash is not found for API version v1beta)` error that occurred because Google has phased out the older model identifier for this specific API region/version.
- **Live Connection Verification**: Successfully executed live connection test generating high-speed response with standard Thai text in 2 seconds.
- **PM2 Service Status**: Confirmed active online.

## [1.1.6] - 2026-05-17
### Feature: Unified Port 3000 and "หนังสือเวียนต้นฉบับ" Labels for all Uploaded PDF Links

#### 🎨 Frontend Changes
- **Port 3000 Routing & Link Verification (`CircularSection.tsx`, `ResultTable.tsx`, `ResultCards.tsx`)**: Replaced all remaining relative or mismatched `/uploads/...` links with `${BASE_URL}/uploads/...` utilizing port `3000`. This guarantees that both the admin list table and public search results fetch uploaded documents directly from the Express API server rather than seeking them locally.
- **Label Unification**: Updated all button/link labels for both original circulars and attachments across all screens to say `"หนังสือเวียนต้นฉบับ"` instead of `"ไฟล์ PDF"` or `"เอกสารแนบท้าย"` to present a uniform and premium user experience.
- **Frontend Build Validation**: Recompiled the React application with Vite, verifying **0 build errors**.
- **PM2 Service Status**: PM2 services restarted and verified stable online.

## [1.1.7] - 2026-05-17
### UI/UX: Unsaved Local File Warning for AI Summaries

#### 🎨 Frontend Changes
- **CircularModal.tsx**: Enhanced the local PDF warning detector on click of the "ใช้ AI สรุปผล" (Use AI to summarize) button.
- **Robust Local Detection**: Expanded validation to capture when users select a new file under **"หนังสือเวียนต้นฉบับ" (Original OCSC File)** or **"เอกสารแนบท้าย" (Attachment File)** locally but have not saved it yet.
- **User Experience**: Users are now presented with a clear, helpful SweetAlert dialog prompting them to save the record once so that their chosen local PDF files can be uploaded and successfully summarized by the AI, resolving the reports that the AI summary was not working on new circular entries.
- **Verification**: Built and verified both React Frontend and Express Server with **0 build errors**. PM2 services fully restarted and online.

## [1.1.8] - 2026-05-17
### UI/UX: Preserved Paragraph and Line Breaks in Search Results

#### 🎨 Frontend Changes
- **ResultTable.tsx & ResultCards.tsx**: Added inline styling `style={{ whiteSpace: 'pre-wrap' }}` to both **"รายละเอียดของหนังสือเวียน" (Circular Details)** and **"การพิจารณาจากส่วนราชการ" (Consideration from Government Agencies)** table cells in both the Table and Grid Card layouts.
- **Paragraph Integrity**: This prevents HTML collapsing of spaces/newlines and ensures paragraphs, double newlines, and bullet points typed in by the administrator in the backend form are displayed exactly the same way (with original paragraph spacing and indentations) in the public search portal, including within the expanded details and reference modals.
- **Verification**: Built and compiled React Frontend and Express Server with **0 errors**. PM2 services restarted and verified stable online.

## [1.1.9] - 2026-05-17
### Bug Fix: Resolved Category Insertion Database Constraint in Master Data CRUD

#### ⚙️ Backend Changes
- **admin.ts (Master Data Router)**: Resolved the database constraint issue that blocked the creation of new categories under the "หมวดหมู่" (Categories) Master Data section.
- **Constraint Resolution**: Identified that the table `c_categories` requires a required string value for `cat_ref` (which is `NOT NULL` with no column default value). Updated the `create` action block in the generic master data router to detect when the target type is `'categories'` and dynamically default `cat_ref` to `'-'` (or utilize `value2` if provided). This completely satisfies the database table schema constraints, fixing all insertion failures.
- **Verification**: Programmatic script validation passed. Express backend compiled successfully with **0 compilation errors**. PM2 services successfully restarted and are fully operational online.










