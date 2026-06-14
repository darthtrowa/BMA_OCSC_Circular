# Project Update Log

## [1.4.3] - 2026-06-14

### Bug Fix: Resolved Missing Parallel Documents in Inbox (Shared Client Support)

#### 🎨 Frontend Changes

- **DashboardPage.tsx (client)**: Added the `checkIsCurrentOwner` helper to resolve parallel assignments. Updated count calculations (inboxCount, actingCount, trackingCount) to handle parallel ownership where the primary document current owner ID is null.
- **WorkflowInboxSection.tsx (client)**: Added the `checkIsCurrentOwner` helper and replaced all direct `in_current_owner_id` comparisons with `checkIsCurrentOwner` across all tabs (myTasks, myProcessedTasks, myCreatedTasks, actingTasks). This matches the fix previously applied to `client-admin` to ensure users running the unified client frontend see their assigned parallel tasks.

### UI/UX: Hidden Manual Assignment Option When Automatic Route is Available

#### 🎨 Frontend Changes

- **WorkflowActionModal.tsx**: Hidden the "มอบหมายงาน / ส่งข้ามสายงาน" (Manual Assignment / Cross-Division Forward) block when an automatic hierarchical recipient (`autoUpAssignee`) is present. This eliminates unnecessary options and enforces strict, automated routing down the correct path.

### Bug Fix: Resolved Duplicate Staging Queue Items in Bot Findings (Auto-imported Detection)

#### ⚙️ Backend Changes

- **admin.ts**: Updated the `GET /bot-findings` route to automatically check and update any `PENDING` bot findings to `IMPORTED` if a matching circular already exists in the `c_information` table (matching either by post URL or document number + year). This resolves the issue where circulars created manually or saved in an inconsistent draft state would remain stuck/visible in the Bot Findings queue.

### UI/UX & Workflow: Separated Single-Division Sequential Flow and Multi-Division Parallel Flow

#### ⚙️ Backend Changes

- **workflowService.ts**: Separated the routing logic for `HR_DIRECTOR` (or acting delegate) distributing work. If **more than 1 division** (`assignedAgencies.length > 1`) is selected, it triggers parallel assignment (`useParallelAssign = true`). If **exactly 1 division** (`assignedAgencies.length === 1`) is selected, it uses sequential flow (`useParallelAssign = false`) and queries the corresponding `DIV_DIRECTOR` (or active delegate) to set as `autoUpAssignee`. This prevents showing the manual assignee dropdown in both cases and flows.

#### 🎨 Frontend Changes

- **WorkflowActionModal.tsx**: Made the auto-forward routing label context-aware. If the next assignee's role is `'DIV_DIRECTOR'`, it renders `'ส่งต่อไปยัง ผอ.กอง:'` (Forward to Division Director) instead of `'เสนอเรื่องขึ้นไปที่:'` (Submit up to) for cleaner UX.

### UI/UX: Hidden File Delete Buttons in Circular Details Modal (View Mode)

#### 🎨 Frontend Changes

- **CircularModal.tsx**: Hidden the "ลบไฟล์" (Delete file) buttons for both the "หนังสือเวียนสำนักงาน ก.พ." (Original circular PDF) and "เอกสารแนบท้าย" (Attachments) sections, and the "+ เพิ่มรายการไฟล์สิ่งที่ส่งมาด้วย" (Add attachment) button, when the modal is opened in read-only/view mode (`isView = true`).

### Bug Fix: Resolved PostgreSQL GROUP BY Error in User List Endpoint

#### 🗄️ Backend Changes

- **admin.ts**: Added `ag.ag_role` to the `GROUP BY` clause in `GET /users` endpoint query. This fixes the database compilation exception `column "ag.ag_role" must appear in the GROUP BY clause or be used in an aggregate function` when retrieving user accounts list on the Admin Management dashboard.

### UI/UX: Stylized Assignee Name Layout in Workflow Action Modal

#### 🎨 Frontend Changes

- **WorkflowActionModal.tsx**: Wrapped the target assignee's name in the automatic up-routing display with styling to show the name on a new line, in a smaller (`text-xs`), thinner (`font-normal`), and gray (`text-slate-500`) style as requested by the user.

### Bug Fix: Fixed Validation Error During Parallel Assignment

#### ⚙️ Frontend Changes

- **WorkflowActionModal.tsx**: Fixed a bug where a validation error ("กรุณาเลือกผู้รับมอบหมาย/ผู้รับผิดชอบ") incorrectly blocked document forwarding during parallel assignment (`useParallelAssign = true`). The form submission logic now properly bypasses the single-user selection requirement for parallel forward actions.

#### 🗄️ Backend Changes

- **workflowService.ts**: Updated the `getNextAssignees` logic so that `useParallelAssign` is only triggered if the HR_DIRECTOR is sending the document to **more than 1 agency** (`assignedAgencies.length > 1`). If sent to a single agency, the workflow will now correctly proceed as a standard sequential flow (`forward`), allowing the user to select the specific action/assignee from the dropdown.

### Bug Fix: Fixed Parallel Assignment Visibility in Inbox

#### 🗄️ Backend Changes

- **admin.ts**: Updated the `GET /admin/dashboard` query to include `parallel_owner_ids` using a subquery on `c_parallel_assignments`. This ensures the frontend receives the list of all active owners for a parallel document.

#### 🎨 Frontend Changes

- **WorkflowInboxSection.tsx**: Updated the task filtering logic to utilize a new `checkIsCurrentOwner` helper function. The inbox now correctly displays documents assigned via parallel assignment by matching the logged-in user's ID against the `parallel_owner_ids` list. This resolves the issue where documents sent out by HR_DIRECTOR disappeared instead of showing up in the DIV_DIRECTOR's inbox.

## [1.4.2] - 2026-06-07

### Removed Dynamic Workflow Builder System

#### 🗄️ Database Changes

- **Migration Script**: Removed dynamic workflow builder columns (`ag_template_id`, `pa_template_id`, `pa_active_node_id`, `in_template_id`, `in_active_node_id`) and completely dropped the `workflow_templates`, `workflow_nodes`, and `workflow_edges` tables as the system now relies entirely on the hierarchical workflow engine.

#### ⚙️ Backend Changes

- **index.ts & workflowTemplateRoutes.ts**: Removed all API routes and imports associated with the dynamic node-based builder (`/api/admin/workflows`).
- **parallelWorkflowService.ts**: Removed dynamic template logic from the parallel assignment engine and fixed a runtime crash caused by querying the deleted `ag_template_id` column. The assignment now directly falls back to the active `DIV_DIRECTOR` or `HR_DIRECTOR` hierarchy logic. Additionally, fixed a major bug where the system could not find the `DIV_DIRECTOR` because they were assigned to a child "POSITION" agency (e.g. `ag_id=48` inside `ag_id=2`), and the query failed to account for `parent_ag_id`. Also fixed `a_status` matching (from `'active'` to `'1'`).

#### 🎨 Frontend Changes

- **App.tsx & Sidebar.tsx**: Removed the builder page from the client router and navigation menu.
- **Components**: Deleted `WorkflowBuilderPage.tsx` and `WorkflowBuilder.tsx` components to clean up the codebase.
- **AgencyFormModal.tsx**: Removed the "กระบวนการทำงานหลัก (Workflow Template)" dropdown field as the system no longer supports custom workflow bindings per agency.
- **WorkflowInboxSection.tsx**: Fixed a critical workflow sequence bug where COORDINATORs were incorrectly bypassing the internal approval chain and distributing work directly to external agencies. The button for COORDINATOR is now strictly "เสนอหัวหน้ากลุ่ม" (submit to GRP_LEADER). The "กระจายงาน" (Parallel Assign) button has been rightfully shifted to the HR_DIRECTOR, who executes the distribution after internal approval.

## [1.4.1] - 2026-06-07

### Refactored Workflow Processing to Match Real-World Procedures

#### ⚙️ Backend Changes

- **workflow.ts**: Added `'PENDING_CLOSE'` status to the `WorkflowStatus` type union.
- **workflowRoutes.ts**: Changed role check for `/parallel-assign` to allow both `COORDINATOR` and `HR_DIRECTOR` roles. Added POST `/close` route to close workflows in `'PENDING_CLOSE'` status.
- **workflowService.ts**: Modified the `approve` method to set document status to `'PENDING_CLOSE'` instead of `'COMPLETED'` when approving to the `COORDINATOR`. Added the `closeWorkflow` method.
- **parallelWorkflowService.ts**: Modified `checkAndAdvance` to route the document to the active `HR_DIRECTOR` (or their level-1 acting delegate) in `'PENDING_HR_APPROVAL'` status when all parallel tracks are finished, instead of completing it directly.

#### 🎨 Frontend Changes

- **ParallelAssignModal.tsx**: Added `preSelectedAgencies` prop and auto-populated the modal tracks when opened.
- **WorkflowInboxSection.tsx**: Enabled `HR_DIRECTOR` to trigger the parallel tracks modal. Added the "Close Work" (ปิดงาน) button for the `COORDINATOR` when document status is `'PENDING_CLOSE'`. Passed `preSelectedAgencies` to `ParallelAssignModal`. Added `sweetalert2` import and `'PENDING_CLOSE'` badge style mapping.
- **apiService.ts**: Added `closeWorkflow` method to `workflowApi`.
- **WorkflowActionModal.tsx**: Fixed a bug where parallel-specific APIs (`parallelDelegate`, `parallelSubmit`, and `parallelReject`) were not called when `paId` was defined. Skipped user selector and validation for parallel rejections.

## [1.4.0] - 2026-06-06

### Feature: Position System & Account Role Refactoring

#### 🗄️ Database Changes

- **Migration Script**: Added `ag_type` (VARCHAR) and `ag_role` (VARCHAR) to `c_agency` table to support creating Positions directly inside the organizational hierarchy.

#### ⚙️ Backend Changes

- **admin.ts**: Updated agency CRUD endpoints to handle `ag_type` and `ag_role`.
- **admin.ts**: Refactored user creation/update. System roles (`a_role`) are now automatically calculated. If `a_permiss` is admin/superadmin, the role is forced to `SYSTEM_ADMIN`. Otherwise, it inherits `ag_role` from the user's assigned position (defaulting to `STAFF`).
- **admin.ts**: Added a new endpoint `PATCH /api/admin/users/:id/agency` to allow assigning users to positions or agencies via the organization chart.

#### 🎨 Frontend Changes

- **AgencyFormModal.tsx**: Added toggles to specify if a new hierarchy node is a "ส่วนราชการ (Agency)" or a "ตำแหน่ง (Position)", allowing assignment of position-specific workflow roles.
- **AgencyTreeSection.tsx**: Visually differentiated position nodes using teal badges, ID card icons, and rendered their system role tags directly in the tree.
- **AgencyMembersDrawer.tsx**: Implemented an "Attach Account" dropdown to easily pull unassigned users into a specific position, and a "Detach" button to remove them.
- **UserSection.tsx**: Removed the manual "Workflow Role" dropdown from the User form since roles are now governed by the Position System. Added an informational banner explaining the new inheritance rule.

## [1.3.5] - 2026-06-06

### Fixed

- **Network Error & CORS Rate Limiting**: Fixed a CORS bug where rate limiter blocks (429 responses) lacked the necessary CORS headers, causing browsers to reject them as a "Network Error". Moved the CORS middleware registration in `server/src/index.ts` to be initialized before the rate limiters.
- **API Rate Limits**: Increased the standard API rate limiter (`apiLimiter`) maximum allowed requests from 200 to 2000 per 15 minutes to prevent local development and rapid testing from triggering rate limit blocks.
- **Workflow Template Routes Exports**: Re-ordered code structure in `server/src/routes/workflowTemplateRoutes.ts` to place `export default router;` at the absolute end of the file for consistency and robustness.

## [1.3.4] - 2026-06-05

### Added

- **Workflow Architecture Documentation**: บันทึกสถาปัตยกรรมการออกแบบกระบวนการทำงานแบบย่อยและไดนามิก (Modular & Dynamic Workflow Design) เป็นภาษาไทยไว้ที่ [workflow_modular_design.md](file:///e:/BMA_OCSC_Circular/docs/workflow_modular_design.md) เพื่อใช้อ้างอิงแนวทางออกแบบเชิงระบบของ BMA OCSC Circular

## [1.3.3] - 2026-06-05

### Fixed

- **Workflow Builder Update Bug**: แก้ไขบัคตอนบันทึก Workflow Template เดิมที่เกิด Error 409 (Conflict) โดยเพิ่ม API endpoint `PUT /api/admin/workflows/templates/:id` สำหรับการแก้ไข (Update) Template เดิมแทนการสร้างใหม่ทั้งหมด ทำให้สามารถบันทึกการแก้ไขได้อย่างถูกต้อง

## [1.3.2] - 2026-06-05

### Feature: Admin Sidebar Workflow Builder Link & Connection Actions Configuration

#### 🎨 Frontend Changes

- **Sidebar.tsx**:
  - Imported `Link` from `react-router-dom` and added a `navLinkItem` helper.
  - Added "ตั้งค่าขั้นตอนการทำงาน (Workflow)" menu item under the "จัดการระบบ" (Manage System) section.
  - Restricted access to the workflow builder link to `superadmin`/`admin` (`isSuperAdmin`) roles.
- **WorkflowBuilderPage.tsx**:
  - Imported `Link` from `react-router-dom` and added a back arrow button to return to `/dashboard`.
- **WorkflowBuilder.tsx**:
  - Enabled action specification (มอบหมาย, เสนอ, ส่งต่อ, and custom label) on connection paths (edges) in the property sidebar.
  - Configured custom text styling and dark-mode background labels for React Flow edges.
  - Added an **"Outgoing Connection Creator"** panel inside the Node Properties sidebar to let users select a target node and action, then connect them via a button click.
  - Enabled deleting edges and nodes directly from the sidebar.

## [1.3.1] - 2026-06-04

### Feature: Workflow Builder Acting Delegation Integration

#### 🎨 Frontend Changes

- **WorkflowBuilder.tsx**: Integrated "Situational Awareness" UI for Acting Roles. When a user clicks a node assigned to a `ROLE` (e.g. `HR_DIRECTOR`), the right sidebar fetches and displays a real-time list of personnel currently acting in that role.
- **WorkflowBuilder.tsx**: Added a shortcut button "ตั้งค่า ➕" that links directly to `/circular/admin/dashboard/users` for seamless delegation management without breaking the Template workflow.
- **workflowEngineApi.ts**: Added `getActiveDelegationsByRole` method to fetch active acting personnel.

#### ⚙️ Backend Changes

- **delegationRoutes.ts**: Created `GET /api/admin/delegations/active-by-role/:role` endpoint to fetch active delegations filtered by `delegated_role`.
- **Build & PM2**: Re-compiled TS backend (`npm run build`) and restarted PM2 instance (`circular-api`) to apply route changes.

## [1.3.0] - 2026-06-04

### Feature: Dynamic Workflow Engine Implementation & Architecture

#### 🗄️ Database Changes

- **Migration Script**: Altered `c_workflow_inbox` via `ALTER TABLE ADD COLUMN IF NOT EXISTS` to safely migrate the existing legacy table without losing data.
- **Workflow Engine Schema**: Added and ensured tables for `workflow_templates`, `workflow_nodes`, and `workflow_edges` for a dynamic node-based approval engine.
- **Template Seeding**: Created and executed `seed_workflow.cjs` to seed the default "OCSC Circular Workflow (Standard)" template (U-Shape flow with 10 steps).

#### ⚙️ Backend Changes

- **workflowTemplateRoutes.ts**: Implemented full REST API CRUD for managing workflow templates, nodes, and edges (`/api/admin/workflows/templates`).
- **Circular Approval Endpoint**: Created `/api/admin/workflows/circular/approve` supporting both `SELF` and `ACTING` contexts, safely verifying active delegations.
- **index.ts**: Mounted the new `workflowTemplateRoutes` under `/api/admin/workflows`.
- **Build & PM2**: Successfully built the TypeScript backend (`npm run build`) and restarted the `circular-api` PM2 instance to register the new routes.

#### 🎨 Frontend Changes

- **WorkflowBuilderPage.tsx**: Connected the Workflow Builder React Flow UI to the new backend API endpoints (`listTemplates`, `createTemplate`, etc.).
- **Error Handling**: Enhanced `loadTemplates` function to explicitly catch and display loading errors in the UI, replacing silent failures.
- **Vite Configuration**: Updated proxy configuration in `client/vite.config.ts` to correctly route `/circular/admin/.*` to `http://127.0.0.1:5175`.
- **IPv4 Binding**: Enforced `host: '127.0.0.1'` inside `client-admin/vite.config.ts` to fix IPv4/IPv6 mismatches causing `ECONNREFUSED` 500 HTTP Proxy Errors.

#### ✅ Verification

- React Frontend (Admin & Client) build: **Passed**
- API Endpoints: Verified 401 Unauthorized returns correctly when accessed without token.
- PM2 Status: **circular-api restarted and fully online.**

## [1.2.3] - 2026-05-27

### Bug Fix: Resolved 'err' is of type 'unknown' in test_login.ts

#### ⚙️ Backend Changes

- **test_login.ts**:
  - Resolved TypeScript compile error `"err is of type 'unknown'"` inside the `testLogin()` catch block by safely narrowing the error type using `axios.isAxiosError(err)`.

#### ✅ Verification

- Backend compilation (`tsc`): **Passed with 0 errors**

## [1.2.2] - 2026-05-26

### UI/UX & Workflow: Reordered Circular Modal Fields, Resolution Options, and Task Submission Updates

#### 🎨 Frontend Changes

- **CircularModal.tsx & WorkflowActionModal.tsx & WorkflowHistoryModal.tsx (React Portals Bug Fix)**:
  - Imported and integrated **React Portals (`createPortal`)** to render all three workflow/circular modals directly to `document.body` instead of inline within nested components.
  - Set the outermost overlay container `z-index` to `z-[9999]` to guarantee it sits at the absolute top of the global viewport stacking context.
  - **Resolution**: Completely resolved a classic browser compositing and stacking context bug (especially in Chromium browsers) where overlapping `backdrop-filter` layers (specifically the sticky, blurred header with `bg-white/80 backdrop-blur-md`) would render on top of the modal's dark overlay as a white/translucent horizontal strip.
- **CircularModal.tsx (Layout)**:
  - Moved the **"อ้างอิงหนังสือเวียน" (Circular Reference)** selection field so it renders immediately below the **"ชื่อเรื่อง" (Subject)** textarea in both standard edit and task-submission modes.
  - Swapped the vertical ordering of the **"มติคณะทำงาน" (Working Group Resolution)** and **"มติ ก.ก." (Committee Resolution)** dropdown selection inputs, displaying "มติคณะทำงาน" before "มติ ก.ก.".
  - Supported dual-mode functionality (`mode="edit"` and `mode="task-submit"`), filtering out administrative resolution/status inputs in task submission mode.
- **WorkflowInboxSection.tsx**:
  - Integrated the Pencil button for `COORDINATOR` users to edit and submit DRAFT status task workflow records.
  - Handled on-demand loading of active `HR_Director` users dynamically.
  - Re-used the modular `CircularModal` inside the task submit flow.
- **WorkflowHistoryModal.tsx**:
  - Rendered embedded user name and position snapshots in the workflow status log history.
- **apiService.ts**:
  - Added frontend support for active user lookup via workflow roles.

#### ⚙️ Backend Changes

- **admin.ts**:
  - Created backend user lookup route `GET /users/by-role` restricting the output to active administrative users matching the designated workspace roles (e.g. `HR_Director`).
- **workflowService.ts**:
  - Embedded name and official position snapshots into history records when submitting workflow tasks.

#### ✅ Verification

- React Frontend compile and build: **Passed (Compiled successfully with 0 errors via Vite)**

## [1.2.1] - 2026-05-25

### RBAC: Coordinator and Staff Menu Access Configuration & Login Context Fix

#### 🎨 Frontend Changes

- **Sidebar.tsx**:
  - Updated to receive the user's `role` prop from the authenticated session.
  - Allowed users with the `COORDINATOR` and `STAFF` roles to view and access the **"หนังสือเวียน" (Circular Documents)** menu in addition to SuperAdmins.
  - Allowed users with the `COORDINATOR` role (but **NOT** `STAFF`) to view and access the **"คิวงานบอต" (Bot Queue)** menu in addition to SuperAdmins.
  - **HOTFIX**: Explicitly allowed `SYSTEM_ADMIN` role to see both the "Circular Documents" and "Bot Queue" menus in the Sidebar, ensuring they aren't hidden if their security level is just User.
  - Implemented a dynamic rose-colored numerical notification badge next to the **"กล่องข้อความงาน" (Workflow Inbox)** menu item, displaying the count of pending active tasks when `inboxCount > 0`.
  - Updated the **"กล่องข้อความงาน" (Workflow Inbox)** icon from a generic tray (`bx-inbox`) to a highly professional checklist/task sheet icon (`bx-task`) in both the Sidebar and the section header.
- **CircularSection.tsx**:
  - Restricted visibility of the **"ตรวจสอบหนังสือเวียน (Bot)" (Check Bot Findings)** and **"เพิ่มหนังสือเวียนใหม่" (Add New Circular)** buttons so that they are only visible to users with the `SYSTEM_ADMIN` or `COORDINATOR` roles across all security levels.
- **ProfileModal.tsx**:
  - Fixed a state desynchronization bug where updating the `role` in the profile modal did not immediately update the `AuthContext` or `localStorage`. The application now calls `login()` directly after saving the profile so UI access restrictions (like button visibilities) update instantly without requiring a re-login.
- **DashboardPage.tsx**:
  - Passed the `admin?.role` prop into the `<Sidebar />` component.
  - Dynamically initialized `activeSection` state based on the logged-in user's permission level. If the user's security level is not Admin (`permiss !== 'superadmin' && permiss !== 'admin'`), the default landing page upon entering the system is set to **"หนังสือเวียน" (Circular Documents)** instead of "ภาพรวมระบบ" (Dashboard Overview).
  - Calculated `pendingTasksCount` (number of active workflow tasks assigned to the logged-in user) and passed it to the `Sidebar` as `inboxCount`.
- **AuthContext.tsx & LoginPage.tsx**:
  - Fixed a critical bug where the user's Workflow `role` field was not extracted from the login API response and not persisted in `localStorage` or loaded into the active React `admin` state. This was causing users like `admincsc01` (Security level `user`, Role `COORDINATOR`) to have `role` as `undefined` in their session, hiding the Circular Documents and Bot Queue menus.
  - Now correctly saves `admin_role` to `localStorage` on login and loads it upon context initialization.

#### ✅ Verification

- React Frontend compile and build: **Passed (Compiled successfully with 0 errors via Vite)**

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

## [1.1.18] - 2026-05-22

### Bug Fix: Circular Number Sorting Logic

#### 🎨 Frontend Changes

- **Sorting Logic (CircularSection, PublicPage)**:
  - Updated the default sorting algorithm to explicitly order circulars by their natural numeric sequence (using `localeCompare` with `numeric: true`) instead of just falling back to insertion order (`in_id`).
  - Now correctly sorts `ว 10` before `ว 2` within the same year (when ordering newest to oldest), completely resolving the problem of misordered circulars on both the admin dashboard and public-facing portal.

#### ✅ Verification

- React Frontend build: **Passed (Compiled successfully with 0 errors via Vite)**

## [1.1.19] - 2026-05-22

### Feature: Dynamic Multiple File Attachment UI with "+" Record Adder

#### 🎨 Frontend Changes

- **CircularModal.tsx**:
  - Refactored `attFiles` state to allow `(File | null)[]` representing slots.
  - Swapped the `multiple` attribute file input with a dynamic record slot list.
  - Implemented a custom dashed button with a `+` icon labelled **"เพิ่มรายการไฟล์สิ่งที่ส่งมาด้วย"** to append new file slots.
  - Each slot renders a standard file input when empty, or a styled indigo box with the selected file name and a **"เปลี่ยนไฟล์"** button when populated.
  - Added a red trash icon next to each slot to allow the administrator to delete that specific slot record.
  - Updated the `handleSave` controller to clean out empty slots (filtering out `null` elements) prior to generating `FormData` for backend upload.

#### ✅ Verification

- React Frontend build: **Passed (Compiled successfully with 0 errors via Vite)**

## [1.1.20] - 2026-05-22

### Bug Fix: Robust AI Summarization with Exponential Backoff Retry Logic

#### ⚙️ Backend Changes

- **aiService.ts**:
  - Implemented an exponential backoff retry mechanism (max 4 attempts, initial delay of 1500ms, doubling on each retry) for Gemini AI API calls.
  - Added robust detection for transient HTTP/SDK errors (503 Service Unavailable, 429 Rate Limits/Resource Exhausted, and network timeouts) to gracefully handle high-demand spikes from the upstream Google Generative AI API without failing immediately.
  - Successfully validated local compilation and restarted PM2 backend processes (`circular-api`).

#### ✅ Verification

- TypeScript backend compilation (`tsc`): **Passed**
- PM2 Service status: **Restarted and running online (100% healthy)**

## [1.1.21] - 2026-05-22

### Feature: Display Circular Year in Bot Findings Queue

#### 🎨 Frontend Changes

- **BotQueueSection.tsx**:
  - Added a year badge displaying only the extracted year number (e.g. `2568`) from the bot's metadata payload inside the bot findings queue table.
  - The badge is styled using a harmonious amber color theme (`bg-amber-50 text-amber-800 border-amber-100`) with a calendar icon to maintain a premium look and align with existing metadata elements like document numbers.
  - Verified and successfully ran production builds and restarted the client service in PM2 (`circular-frontend`).

#### ✅ Verification

- React Frontend build: **Passed (Compiled successfully with 0 errors via Vite)**
- PM2 Service status: **Restarted and running online (100% healthy)**

## [1.1.22] - 2026-05-23

### Feature: AI Metadata Extraction (Date & Referenced Circulars)

#### ⚙️ Backend Changes

- **aiService.ts**:
  - Configured Gemini model `gemini-2.5-flash` to output structured JSON format utilizing `generationConfig: { responseMimeType: "application/json" }`.
  - Upgraded prompt to request JSON object with keys `summary`, `docDate`, and `references`.
  - Added robust JSON parsing fallback that defaults to raw text if model output structure deviates.

#### 🎨 Frontend Changes

- **CircularModal.tsx**:
  - Enhanced the "ใช้ AI สรุปผล" (Use AI to summarize) button callback to handle the structured JSON response containing `summary`, `docDate`, and `references`.
  - Automatically populates the "ลงวันที่" (Document Date) field if it is currently empty.
  - Implemented boundary-safe fuzzy matching logic to search for references matching extracted circular numbers in the database (`allData.information`), and pre-select matching records in the "อ้างอิงหนังสือเวียน" (References) multi-select dropdown.
  - Displayed premium status feedback inside the success alert showing exactly what metadata was auto-extracted and applied (e.g. date set, and number of new references auto-linked).

#### ✅ Verification

- TypeScript backend compilation (`tsc`): **Passed**
- React Frontend build: **Passed (Compiled successfully with 0 errors via Vite)**
- PM2 Service status: **Restarted and running online (100% healthy)**

## [1.1.23] - 2026-05-23

### UI/UX: Replaced Direct PDF Badges with Website Link Button in Admin Circulars Table

#### 🎨 Frontend Changes

- **CircularSection.tsx**:
  - Removed direct PDF download links (Original PDF & Attachment files) from the first page of the admin circulars table.
  - Implemented the `renderWebsiteLink` helper to retrieve the URL from the `in_link` field.
  - Renders a styled, responsive **"Link เว็บไซต์หนังสือเวียน"** (Circular Website Link) button with a globe icon (`bx-world`) to direct administrators straight to the circular's webpage, simplifying list view clarity.

#### ✅ Verification

- React Frontend build: **Passed (Compiled successfully with 0 errors via Vite)**
- PM2 Service status: **Restarted and running online (100% healthy)**

## [1.1.24] - 2026-05-23

### UI/UX: Wrapped Long Status Badge Text in Admin Views

#### 🎨 Frontend Changes

- **CircularSection.tsx & ExecutiveDashboard.tsx**:
  - Enhanced the status badge rendering components.
  - If the status string equals `'รอผลการพิจารณาจากคณะทำงานฯ'`, it splits the text into two lines with a `<br />` tag:
    ```
    รอผลการพิจารณาจาก
    คณะทำงานฯ
    ```
  - Configured status spans to use `inline-block text-center rounded-xl py-1.5` classes to center the wrapped text and scale the pill badge background container symmetrically.

#### ✅ Verification

- React Frontend build: **Passed (Compiled successfully with 0 errors via Vite)**
- PM2 Service status: **Restarted and running online (100% healthy)**

## [1.1.25] - 2026-05-23

### UI/UX: Wrapped Multiple Agencies onto New Lines in Search Results

#### 🎨 Frontend Changes

- **ResultTable.tsx & ResultCards.tsx & CircularSection.tsx**:
  - Refactored the responsible department ("ผู้รับผิดชอบ") rendering.
  - Replaced the comma-joined string representation (`.join(', ')`) with individual block-level elements (`div` / `span` stack) so that each agency is displayed on its own line if there are multiple agencies assigned to a circular.
  - In `ResultTable.tsx` and `ResultCards.tsx` (public view), within the table details sub-table, each agency name now renders in a separate `div` tag.
  - In the main search results view (both table row and grid card layouts), as well as the admin `CircularSection.tsx` table, multiple agencies are grouped in a vertical `flex-col` layout, where each item displays on a new line accompanied by the buildings icon.

#### ✅ Verification

- React Frontend build: **Passed (Compiled successfully with 0 errors via Vite)**
- PM2 Service status: **Restarted and running online (100% healthy)**

## [1.1.26] - 2026-05-23

### UI/UX: Display Only Original Circular Button in Search Results List

#### 🎨 Frontend Changes

- **ResultTable.tsx & ResultCards.tsx**:
  - Modified the quick action button bar in both search result layouts (Table rows and Grid cards).
  - Removed direct attachment buttons ("เอกสารแนบท้าย") and special resolution files ("มติ ก.ก. เฉพาะเรื่อง") from the main list row and card views to prevent visual clutter.
  - Kept only the **"หนังสือเวียนต้นฉบับ" (Original OCSC Circular)** button for quick download/access. All secondary files (attachments, special case resolutions, source website links) remain fully accessible and structured inside the expanded details sub-table.

#### ✅ Verification

- React Frontend build: **Passed (Compiled successfully with 0 errors via Vite)**
- PM2 Service status: **Restarted and running online (100% healthy)**

## [1.1.27] - 2026-05-23

### UI/UX: Bot Queue Section Year Formatting

#### 🎨 Frontend Changes

- **BotQueueSection.tsx**:
  - Implemented the `cleanYear` utility helper function to dynamically remove prefixes like "ปี พ.ศ. " or "พ.ศ. " from scraped and master data year fields.
  - Updated the bot findings list to output only the numeric year representation (e.g. `2568` instead of `ปี พ.ศ. 2568`).
  - Cleaned year matching logic to correctly identify years in master data.
  - Swapped the form validation alerts and input label text from "ปี พ.ศ." to simply "ปี" to keep the metadata consistent and streamlined.

#### ✅ Verification

- React Frontend: **Code changes completed**
- PM2 Service status: **Ready for rebuild and restart**

## [1.1.28] - 2026-05-23

### System: Add GEMINI.md Rules to Agent Rules Folder

#### ⚙️ Configuration & Environment Changes

- **gemini.md**:
  - Created [gemini.md](file:///e:/BMA_OCSC_Circular/.agents/rules/gemini.md) in the agent rules folder `.agents/rules/` to ensure the project instructions, stack constraints, and guardrails are automatically read and enforced by agentic AI workflows.

#### ✅ Verification

- File existence and layout: **Verified**

## [1.1.29] - 2026-05-23

### UI/UX: Added PDF Viewer Buttons in Circular Modal

#### 🎨 Frontend Changes

- **CircularModal.tsx**:
  - Imported `BASE_URL` from the API service configuration.
  - Added visual eye icon buttons ("ดูไฟล์" / "ดูไฟล์เดิม") next to the file displays within the edit/create circular modal.
  - Enabled viewing of saved/uploaded original OCSC circulars, kept attachments, and existing MKK files via direct links to backend uploads.
  - Integrated secure `URL.createObjectURL` handlers for newly selected local files (original PDF, attachment slots, and MKK upload files) to allow administrators to instantly preview their local documents in the browser before final form submission.

#### ✅ Verification

- React Frontend layout and logic: **Updated and verified**

## [1.1.30] - 2026-05-23

### UI/UX: Expanded Remarks (หมายเหตุ) Field in Circular Modal

#### 🎨 Frontend Changes

- **CircularModal.tsx**:
  - Converted the "หมายเหตุ" (Remarks) field wrapper to `md:col-span-2` (making it span 2 columns on desktop devices).
  - Replaced the single-line text `input` with a 3-row `textarea` element (`rows={3}`) and disabled arbitrary user resizing using the `resize-none` class.
  - Matches the visual presentation and spacing of the "รายละเอียดของหนังสือเวียน" (Circular Details) field for layout balance.

#### ✅ Verification

- React Frontend layout: **Updated and verified**

## [1.1.31] - 2026-05-23

### UI/UX: Refactored Circular Search Result Cards Layout

#### 🎨 Frontend Changes

- **ResultCards.tsx**:
  - Combined the "ลงวันที่" (Document Date) display text directly next to the "เลขหนังสือเวียน" (Circular Number) inside the main card header, using the same bold font and size (`text-lg font-bold`).
  - Removed the calendar icon from the date display to reduce visual clutter.
  - Moved the "ชื่อหนังสือ" (Circular Title) text directly below the number-date header stack on a new line and added a distinct font weight (`font-semibold`).
  - Positioned the **"หนังสือเวียนต้นฉบับ" (Original PDF)** button directly following the circular title on the next line.
  - Removed the **"เว็บไซต์หนังสือเวียนสำนักงาน ก.พ."** button from the main card view.
  - Relocated the styled website link button inside the expanded details table, placing it directly under the **"LINK เว็บไซต์ต้นทาง"** field.

#### ✅ Verification

- React Frontend card layout: **Refactored and verified**

## [1.1.32] - 2026-05-23

### UI/UX: Renamed Circular Links and Integrated 'สิ่งที่ส่งมาด้วย' (QR Code) Button

#### ⚙️ Backend Changes

- **public.ts**:
  - Added `c_information.in_qr_link` to the database SELECT fields in both search (`/api/search`) and details (`/api/circular/:id`) routes to allow the public search interface to consume QR Code link data.

#### 🎨 Frontend Changes

- **ResultCards.tsx & ResultTable.tsx**:
  - Updated the helper `processFileLink` to map external URL links to the name **"ข้อมูลหนังสือเวียน"** (instead of "เว็บไซต์หนังสือเวียนสำนักงาน ก.พ.") and PDF attachments to **"หนังสือเวียนต้นฉบับ"**.
  - Renamed details table row header **"LINK เว็บไซต์ต้นทาง"** to **"ข้อมูลหนังสือเวียน"** and **"หนังสือเวียนต้นฉบับ (สำนักงาน ก.พ.)"** to **"หนังสือเวียนต้นฉบับ"**.
  - Integrated the **"สิ่งที่ส่งมาด้วย"** quick action button (with a paperclip icon `bx bx-paperclip` and indigo background) on the search result cards and table list view pointing to `item.in_qr_link` when it exists.

#### ✅ Verification

- React Frontend build: **Passed (Compiled successfully with 0 errors via Vite)**

## [1.1.33] - 2026-05-23

### UI/UX: Aligned PDF Buttons Inline with Circular Header

#### 🎨 Frontend Changes

- **ResultCards.tsx**:
  - Combined the circular number and date `<h5>` header with the action buttons container inside a flex row (`flex flex-wrap items-center gap-3`).
  - This places the **"หนังสือเวียนต้นฉบับ"** and **"สิ่งที่ส่งมาด้วย"** PDF action buttons directly inline next to the circular number and date on the same row.
  - Adjusted the layout margins to keep spacing well-balanced on desktop and mobile viewports.

#### ✅ Verification

- React Frontend card header layout: **Aligned inline and verified**

## [1.1.34] - 2026-05-23

### UI/UX: Renamed Website Link fields to 'Link สำนักงาน ก.พ.'

#### 🎨 Frontend Changes

- **ResultCards.tsx & ResultTable.tsx**:
  - Renamed the details table row header **"ข้อมูลหนังสือเวียน"** to **"Link สำนักงาน ก.พ."**.
  - Updated the button and link labels within this row, as well as the link text inside `processFileLink` helper, to **"Link สำนักงาน ก.พ."** (instead of "ข้อมูลหนังสือเวียน") to specify the target origin of the document website.

#### ✅ Verification

- React Frontend layout labels: **Renamed and verified**

## [1.1.35] - 2026-05-23

### UI/UX: Kept 'Link สำนักงาน ก.พ.' Header while Showing 'ข้อมูลหนังสือเวียน' Link Button

#### 🎨 Frontend Changes

- **ResultCards.tsx & ResultTable.tsx**:
  - Reverted the link buttons text and `processFileLink` helper return text to **"ข้อมูลหนังสือเวียน"** (instead of "Link สำนักงาน ก.พ.").
  - Kept the table row header as **"Link สำนักงาน ก.พ."** to preserve clarity on the link's target authority.

#### ✅ Verification

- React Frontend layout: **Updated and verified**

## [1.1.36] - 2026-05-23

### TypeScript: Fixed Missing in_qr_link in CircularItem Interface

#### 🎨 Frontend Changes

- **ResultCards.tsx**:
  - Added `in_qr_link?: string;` as an optional property in the `CircularItem` type definition. This fixes the TypeScript compilation error caused by using the property `item.in_qr_link` in the card component layout.

#### ✅ Verification

- TypeScript compilation error: **Resolved**

## [1.1.37] - 2026-05-23

### UI/UX: Added 'สิ่งที่ส่งมาด้วย' Button Inline under 'Link สำนักงาน ก.พ.' Row

#### 🎨 Frontend Changes

- **ResultCards.tsx & ResultTable.tsx**:
  - Refactored the **"Link สำนักงาน ก.พ."** row container in the details sub-table to use flex-wrap layout.
  - Positioned the **"สิ่งที่ส่งมาด้วย"** button pointing to `in_qr_link` directly next to the **"ข้อมูลหนังสือเวียน"** button (if both exist) under this row for unified navigation.

#### ✅ Verification

- React Frontend layout: **Updated and verified**

## [1.1.38] - 2026-05-23

### AI: Prevent Formatting Asterisks in Summarization Outputs

#### ⚙️ Backend Changes

- **aiService.ts**:
  - Modified the Gemini AI system instructions prompt to explicitly prohibit using asterisks (`*` or `**`) for bold text, headers, and bullet points inside the `summary` field.
  - Implemented a regex clean-up wrapper (`.replace(/\*/g, '')`) on the generated text output (both parsed JSON and raw text fallback) to guarantee that all formatting asterisks are stripped programmatically before the summary is returned to the client and stored in the database.

#### ✅ Verification

- Server build and compilation: **Passed**

## [1.1.39] - 2026-05-23

### UI/UX: Admin Circular Modal Layout Enhancements

#### 🎨 Frontend Changes

- **CircularModal.tsx**:
  - Placed "เลขที่หนังสือ" (Circular Number), "ลงวันที่" (Document Date), and "ปี พ.ศ." (Year) fields in the same row on desktop screens using responsive layout (`md:col-span-2 grid grid-cols-1 md:grid-cols-3 gap-5`).
  - Expanded the vertical space of the "รายละเอียดของหนังสือเวียน" (Circular Details) textarea by increasing default `rows` from `3` to `6` and enabling vertical resizing (`resize-y`).

#### ✅ Verification

- UI Layout: **Verified (Symmetrical 3-column row layout for date/number/year on desktop, and expanded vertical text area for details)**

## [1.1.40] - 2026-05-23

### Bug Fix: Strict Matching and Date Validation for AI References

#### ⚙️ Backend Changes

- **aiService.ts**:
  - Updated Gemini system prompt to extract references as structured objects with both `"number"` and `"date"` attributes rather than plain text strings.
  - Adjusted the return type of `summarizePdf` to `any[]` to handle the new references object structure.

#### 🎨 Frontend Changes

- **CircularModal.tsx**:
  - Implemented the `normalizeDateStr` utility function to normalize Thai date strings by mapping full Thai month names to standard abbreviations (e.g. `"ตุลาคม"` to `"ต.ค."`) and removing all whitespace characters and common prefixes (like `"วันที่"`, `"ลงวันที่"`, `"เมื่อวันที่"`).
  - Updated the reference matching logic. When scanning the database list for matches, the system now requires both the circular number and the document date to be non-empty and match the AI-extracted metadata.
  - Prevents random duplicate references (e.g. matching `ว 2` from other years) from being added when summarizing circular files.

#### ✅ Verification

- Reference Extraction: **Verified (Only references matching both number and date are automatically linked)**

## [1.1.41] - 2026-05-23

### Feature: Immediate PDF Upload in Admin Circular Modal

#### ⚙️ Backend Changes

- **admin.ts**:
  - Implemented `POST /admin/circular/upload-single` endpoint using Multer to support single file uploads.
  - Returns the uploaded filename, and uses field names (`in_original_file`, `in_attachment_file`, `mkk_ref_upload_in`) to automatically apply matching name prefixes (`orig`, `att`, `mkk`).

#### 🎨 Frontend Changes

- **apiService.ts**:
  - Added the `uploadSingle` method to `adminApi` to post Multipart/Form-Data files to `/admin/circular/upload-single`.
- **CircularModal.tsx**:
  - Added an "อัปโหลดทันที" (Upload Immediately) button next to local file previews in the original circular, attachments, and MKK file sections.
  - When clicked, it uploads only the selected file, updates the modal's state (converting from a local file state to an uploaded path/badged link), and clears local state variables without closing the modal or saving the rest of the form.
  - Enables administrators to run the AI summary instantly on newly selected files without having to close and reopen the modal.

#### ✅ Verification

- Async File Upload: **Verified (File uploads immediately and updates the UI state correctly while keeping the modal open)**

## [1.1.42] - 2026-05-23

### Security Fixes: Critical Backend Vulnerabilities

#### ⚙️ Backend Changes

- **admin.ts**:
  - Replaced \`requireAdmin\` with \`requireSuperAdmin\` on all \`/users\` endpoints to strictly limit user management to super administrators.
  - Mitigated MIME spoofing in Multer configuration by forcing all uploaded filenames to have the \`.pdf\` extension.
  - Implemented a global \`isSyncing\` lock on the \`POST /bot-findings/sync\` endpoint to prevent DoS via concurrent heavy sync operations, returning \`429 Too Many Requests\` when locked.
- **aiService.ts**:

#### ✅ Verification

- React Frontend layout: **Updated and verified**

## [1.1.31] - 2026-05-23

### UI/UX: Refactored Circular Search Result Cards Layout

#### 🎨 Frontend Changes

- **ResultCards.tsx**:
  - Combined the "ลงวันที่" (Document Date) display text directly next to the "เลขหนังสือเวียน" (Circular Number) inside the main card header, using the same bold font and size (`text-lg font-bold`).
  - Removed the calendar icon from the date display to reduce visual clutter.
  - Moved the "ชื่อหนังสือ" (Circular Title) text directly below the number-date header stack on a new line and added a distinct font weight (`font-semibold`).
  - Positioned the **"หนังสือเวียนต้นฉบับ" (Original PDF)** button directly following the circular title on the next line.
  - Removed the **"เว็บไซต์หนังสือเวียนสำนักงาน ก.พ."** button from the main card view.
  - Relocated the styled website link button inside the expanded details table, placing it directly under the **"LINK เว็บไซต์ต้นทาง"** field.

#### ✅ Verification

- React Frontend card layout: **Refactored and verified**

## [1.1.32] - 2026-05-23

### UI/UX: Renamed Circular Links and Integrated 'สิ่งที่ส่งมาด้วย' (QR Code) Button

#### ⚙️ Backend Changes

- **public.ts**:
  - Added `c_information.in_qr_link` to the database SELECT fields in both search (`/api/search`) and details (`/api/circular/:id`) routes to allow the public search interface to consume QR Code link data.

#### 🎨 Frontend Changes

- **ResultCards.tsx & ResultTable.tsx**:
  - Updated the helper `processFileLink` to map external URL links to the name **"ข้อมูลหนังสือเวียน"** (instead of "เว็บไซต์หนังสือเวียนสำนักงาน ก.พ.") and PDF attachments to **"หนังสือเวียนต้นฉบับ"**.
  - Renamed details table row header **"LINK เว็บไซต์ต้นทาง"** to **"ข้อมูลหนังสือเวียน"** and **"หนังสือเวียนต้นฉบับ (สำนักงาน ก.พ.)"** to **"หนังสือเวียนต้นฉบับ"**.
  - Integrated the **"สิ่งที่ส่งมาด้วย"** quick action button (with a paperclip icon `bx bx-paperclip` and indigo background) on the search result cards and table list view pointing to `item.in_qr_link` when it exists.

#### ✅ Verification

- React Frontend build: **Passed (Compiled successfully with 0 errors via Vite)**

## [1.1.33] - 2026-05-23

### UI/UX: Aligned PDF Buttons Inline with Circular Header

#### 🎨 Frontend Changes

- **ResultCards.tsx**:
  - Combined the circular number and date `<h5>` header with the action buttons container inside a flex row (`flex flex-wrap items-center gap-3`).
  - This places the **"หนังสือเวียนต้นฉบับ"** and **"สิ่งที่ส่งมาด้วย"** PDF action buttons directly inline next to the circular number and date on the same row.
  - Adjusted the layout margins to keep spacing well-balanced on desktop and mobile viewports.

#### ✅ Verification

- React Frontend card header layout: **Aligned inline and verified**

## [1.1.34] - 2026-05-23

### UI/UX: Renamed Website Link fields to 'Link สำนักงาน ก.พ.'

#### 🎨 Frontend Changes

- **ResultCards.tsx & ResultTable.tsx**:
  - Renamed the details table row header **"ข้อมูลหนังสือเวียน"** to **"Link สำนักงาน ก.พ."**.
  - Updated the button and link labels within this row, as well as the link text inside `processFileLink` helper, to **"Link สำนักงาน ก.พ."** (instead of "ข้อมูลหนังสือเวียน") to specify the target origin of the document website.

#### ✅ Verification

- React Frontend layout labels: **Renamed and verified**

## [1.1.35] - 2026-05-23

### UI/UX: Kept 'Link สำนักงาน ก.พ.' Header while Showing 'ข้อมูลหนังสือเวียน' Link Button

#### 🎨 Frontend Changes

- **ResultCards.tsx & ResultTable.tsx**:
  - Reverted the link buttons text and `processFileLink` helper return text to **"ข้อมูลหนังสือเวียน"** (instead of "Link สำนักงาน ก.พ.").
  - Kept the table row header as **"Link สำนักงาน ก.พ."** to preserve clarity on the link's target authority.

#### ✅ Verification

- React Frontend layout: **Updated and verified**

## [1.1.36] - 2026-05-23

### TypeScript: Fixed Missing in_qr_link in CircularItem Interface

#### 🎨 Frontend Changes

- **ResultCards.tsx**:
  - Added `in_qr_link?: string;` as an optional property in the `CircularItem` type definition. This fixes the TypeScript compilation error caused by using the property `item.in_qr_link` in the card component layout.

#### ✅ Verification

- TypeScript compilation error: **Resolved**

## [1.1.37] - 2026-05-23

### UI/UX: Added 'สิ่งที่ส่งมาด้วย' Button Inline under 'Link สำนักงาน ก.พ.' Row

#### 🎨 Frontend Changes

- **ResultCards.tsx & ResultTable.tsx**:
  - Refactored the **"Link สำนักงาน ก.พ."** row container in the details sub-table to use flex-wrap layout.
  - Positioned the **"สิ่งที่ส่งมาด้วย"** button pointing to `in_qr_link` directly next to the **"ข้อมูลหนังสือเวียน"** button (if both exist) under this row for unified navigation.

#### ✅ Verification

- React Frontend layout: **Updated and verified**

## [1.1.38] - 2026-05-23

### AI: Prevent Formatting Asterisks in Summarization Outputs

#### ⚙️ Backend Changes

- **aiService.ts**:
  - Modified the Gemini AI system instructions prompt to explicitly prohibit using asterisks (`*` or `**`) for bold text, headers, and bullet points inside the `summary` field.
  - Implemented a regex clean-up wrapper (`.replace(/\*/g, '')`) on the generated text output (both parsed JSON and raw text fallback) to guarantee that all formatting asterisks are stripped programmatically before the summary is returned to the client and stored in the database.

#### ✅ Verification

- Server build and compilation: **Passed**

## [1.1.39] - 2026-05-23

### UI/UX: Admin Circular Modal Layout Enhancements

#### 🎨 Frontend Changes

- **CircularModal.tsx**:
  - Placed "เลขที่หนังสือ" (Circular Number), "ลงวันที่" (Document Date), and "ปี พ.ศ." (Year) fields in the same row on desktop screens using responsive layout (`md:col-span-2 grid grid-cols-1 md:grid-cols-3 gap-5`).
  - Expanded the vertical space of the "รายละเอียดของหนังสือเวียน" (Circular Details) textarea by increasing default `rows` from `3` to `6` and enabling vertical resizing (`resize-y`).

#### ✅ Verification

- UI Layout: **Verified (Symmetrical 3-column row layout for date/number/year on desktop, and expanded vertical text area for details)**

## [1.1.40] - 2026-05-23

### Bug Fix: Strict Matching and Date Validation for AI References

#### ⚙️ Backend Changes

- **aiService.ts**:
  - Updated Gemini system prompt to extract references as structured objects with both `"number"` and `"date"` attributes rather than plain text strings.
  - Adjusted the return type of `summarizePdf` to `any[]` to handle the new references object structure.

#### 🎨 Frontend Changes

- **CircularModal.tsx**:
  - Implemented the `normalizeDateStr` utility function to normalize Thai date strings by mapping full Thai month names to standard abbreviations (e.g. `"ตุลาคม"` to `"ต.ค."`) and removing all whitespace characters and common prefixes (like `"วันที่"`, `"ลงวันที่"`, `"เมื่อวันที่"`).
  - Updated the reference matching logic. When scanning the database list for matches, the system now requires both the circular number and the document date to be non-empty and match the AI-extracted metadata.
  - Prevents random duplicate references (e.g. matching `ว 2` from other years) from being added when summarizing circular files.

#### ✅ Verification

- Reference Extraction: **Verified (Only references matching both number and date are automatically linked)**

## [1.1.41] - 2026-05-23

### Feature: Immediate PDF Upload in Admin Circular Modal

#### ⚙️ Backend Changes

- **admin.ts**:
  - Implemented `POST /admin/circular/upload-single` endpoint using Multer to support single file uploads.
  - Returns the uploaded filename, and uses field names (`in_original_file`, `in_attachment_file`, `mkk_ref_upload_in`) to automatically apply matching name prefixes (`orig`, `att`, `mkk`).

#### 🎨 Frontend Changes

- **apiService.ts**:
  - Added the `uploadSingle` method to `adminApi` to post Multipart/Form-Data files to `/admin/circular/upload-single`.
- **CircularModal.tsx**:
  - Added an "อัปโหลดทันที" (Upload Immediately) button next to local file previews in the original circular, attachments, and MKK file sections.
  - When clicked, it uploads only the selected file, updates the modal's state (converting from a local file state to an uploaded path/badged link), and clears local state variables without closing the modal or saving the rest of the form.
  - Enables administrators to run the AI summary instantly on newly selected files without having to close and reopen the modal.

#### ✅ Verification

- Async File Upload: **Verified (File uploads immediately and updates the UI state correctly while keeping the modal open)**

## [1.1.42] - 2026-05-23

### Security Fixes: Critical Backend Vulnerabilities

#### ⚙️ Backend Changes

- **admin.ts**:
  - Replaced `requireAdmin` with `requireSuperAdmin` on all `/users` endpoints to strictly limit user management to super administrators.
  - Mitigated MIME spoofing in Multer configuration by forcing all uploaded filenames to have the `.pdf` extension.
  - Implemented a global `isSyncing` lock on the `POST /bot-findings/sync` endpoint to prevent DoS via concurrent heavy sync operations, returning `429 Too Many Requests` when locked.
- **aiService.ts**:
  - Mitigated Server-Side Request Forgery (SSRF) by validating hostnames in HTTP URLs against local subnets and addresses (e.g. `localhost`, `127.0.0.1`, `169.254.x.x`, `10.x.x.x`).
  - Mitigated Path Traversal vulnerabilities by wrapping local PDF paths with `path.resolve` and ensuring the resolved paths rigidly start within the absolute `uploads` directory limit.
- **index.ts**:
  - Hardened endpoints against brute-force attacks by applying the `express-rate-limit` middleware directly to all `/admin/auth/*` routes.

#### ✅ Verification

- Security Policy: **Verified (tsc compiled without errors, rate limit applied, SSRF and path traversal validation implemented)**

## [1.1.43] - 2026-05-23

### Security Fixes: Phase 2 Backend Hardening

#### ⚙️ Backend Changes

- **admin.ts**:
  - **Resource Exhaustion Prevention**: Reduced `in_attachment_file` Multer maxCount from 20 to 5 to mitigate excessive file processing overhead.
  - **Information Exposure Prevention**: Sanitized multiple `catch (e: any)` blocks. Replaced raw `e.message` exposure in JSON responses with generic messages like `Internal Server Error`, while keeping the raw message exclusively in server-side `console.error` logs.
  - **Self-Deletion Prevention**: Added a safeguard in `DELETE /users/:id` to prevent administrators from mistakenly (or maliciously) deleting the account they are currently logged in with.
  - **Cryptographic Standardization**: Removed legacy custom prefixing logic (`"01234567890123456789" + hash`) when creating and updating passwords. Standardized `bcrypt.compare` to evaluate pure bcrypt hashes without replacing legacy `$2y$` structures, aligning with modern cryptographic standards.

#### ✅ Verification

- Hardening Checks: **Verified (tsc compiled without errors)**

## [1.1.44] - 2026-05-23

### Security Fixes: Token Versioning (Stateful JWT)

#### ⚙️ Backend Changes

- **admin.ts**:
  - Implemented automatic database migration script on startup to add `a_token_version` (INT DEFAULT 1) to the `admin` table if it does not exist.
  - Updated the JWT signing payload in the `POST /auth/login` and `POST /auth/verify-otp` endpoints to inject the current `token_version`.
  - Enforced token invalidation on password changes. The `PUT /users/:id` and `POST /profile/change-password` routes now increment the user's `a_token_version` by 1 upon a successful password update.
- **auth.ts**:
  - Transitioned authorization middleware (`requireAdmin`, `requireSuperAdmin`, `requireRole`) to `async` functions to support database queries.
  - Implemented token version cross-checking. The middleware now fetches the active `a_token_version` from the database and compares it against the `token_version` embedded within the incoming JWT. Any mismatch strictly returns a `401 Unauthorized` with a "Session expired due to password change" message.

#### ✅ Verification

- Token Versioning: **Verified (tsc compiled without errors)**

## [1.1.45] - 2026-05-23

### Security Fixes: Phase 3 — Comprehensive Audit Remediation

#### ⚙️ Backend Changes

- **docker-compose.yml** (CRITICAL):
  - Removed hardcoded fallback DB password `1956wine`. The `DB_PASSWORD` environment variable is now required (`${DB_PASSWORD:?DB_PASSWORD must be set}`).
- **admin.ts** (CRITICAL + HIGH):
  - Replaced `upload.any()` on `/circular/upload-single` with `upload.fields()` restricted to 3 named fields (maxCount: 1 each), closing an unrestricted file upload vector.
  - Replaced `SELECT *` on login query with explicit column selection, minimizing data exposure.
  - Replaced `SELECT *` on bot-findings queries with explicit column selection.
  - Fixed bot sync error leaking internal error messages to client. Errors are now logged server-side only.
- **index.ts** (HIGH + MEDIUM):
  - Enabled Content Security Policy (CSP) via Helmet with directives for `defaultSrc`, `scriptSrc`, `styleSrc`, `fontSrc`, `imgSrc`, `connectSrc`.
  - Added explicit body size limits (`1mb`) to `express.json()` and `express.urlencoded()`.
  - Split rate limiters: public API (`/api`) now allows 200 req/15min, while auth endpoints (`/admin/auth`) are restricted to 15 req/15min.
  - Removed request path reflection from 404 responses to prevent information leakage.
  - Made CORS localhost origins conditional on `NODE_ENV !== 'production'`.
- **aiService.ts** (HIGH + MEDIUM):
  - Strengthened SSRF hostname validation with a centralized `isInternalHost()` function covering IPv6 (`::1`, `[::]`), `0.0.0.0`, IPv6 private ranges (`fc`, `fd`, `fe80`), and octal/decimal IP notation.
  - Removed raw `error.message` concatenation from thrown errors to prevent information exposure.
- **migrate.ts** (HIGH):
  - Replaced string-interpolated SQL column lookups with parameterized queries (`$1`, `$2`).
  - Added a whitelist validation for allowed column names and types.
- **emailService.ts** (LOW):
  - Made TLS `rejectUnauthorized` environment-aware: defaults to `true` in production, `false` in development. Configurable via `SMTP_TLS_REJECT_UNAUTHORIZED`.

#### ✅ Verification

- Full Audit Remediation: **Verified (tsc compiled without errors)**

## [1.1.46] - 2026-05-23

### Security Hardening: Enforce DB_PASSWORD Requirements

#### ⚙️ Database & Environment Changes

- **database.ts**:
  - Implemented startup validation to ensure `DB_PASSWORD` is explicitly set in the environment variables. The server will now log an error and exit immediately if `DB_PASSWORD` is empty or undefined.
- **.env** & **.env.docker**:
  - Removed the hardcoded fallback password `1956wine` and replaced it with placeholders (`your_secure_db_password_here`), forcing developers to define their own secure credentials in local and container environments.
- **DOCKER_DEPLOY_GUIDE.md**:
  - Replaced legacy password references with secure placeholders in step-by-step examples.

#### ✅ Verification

- DB_PASSWORD Enforcement: **Verified (tsc compiles cleanly)**

## [1.1.47] - 2026-05-23

### Bug Fix: Frontend Login Loop / Stuck Issue

#### 🐛 Frontend Changes

- **apiService.ts**:
  - **Issue**: The global Axios response interceptor was catching `401 Unauthorized` responses and immediately performing a hard page reload (`window.location.href = '/admin/login'`). When a user typed an incorrect password (or an old password made invalid by the new hashing algorithm), the API returned 401. This caused the page to instantly refresh before the error message could be displayed, making the login screen appear "stuck" or unresponsive.
  - **Fix**: Excluded the `/auth/login` and `/auth/verify-otp` endpoints from the global 401 redirect logic. Error messages ("Username or Password incorrect") are now properly passed to the `LoginPage` component and displayed to the user via `Swal.fire`.

## [1.1.48] - 2026-05-23

### DevOps & Security Hardening (Kalama Sutta Architecture)

#### ⚙️ Docker & Infrastructure Changes

- **docker-compose.yml**:
  - Removed explicit port mapping (`3000:3000`) from the `server` service to enforce routing exclusively through the Nginx proxy and prevent direct external access bypasses.
  - Hardened PostgreSQL default password handling by enforcing a strict absence check (`POSTGRES_PASSWORD: ${DB_PASSWORD?Error: DB_PASSWORD missing}`).

- **server/Dockerfile**:
  - Transitioned the base image from `node:20-slim` to `node:20-alpine` for both builder and production stages to minimize attack surface and image size.
  - Updated package manager commands from `apt-get` to `apk` for compatibility with Alpine Linux.
  - Implemented principle of least privilege by dropping root privileges and running the application as `USER node`.

- **client/nginx.conf**:
  - Added global gzip compression for text-based resources (`text/plain`, `application/json`, `application/javascript`, `text/css`) to improve transmission performance.
  - Hardened the `/uploads/` directory block by removing `access_log off;` and injecting `add_header X-Content-Type-Options nosniff;` to prevent MIME-sniffing vulnerabilities.
  - Documented a structural warning regarding potential routing conflicts between Express API namespaces and React frontend routes.

## [1.1.49] - 2026-05-23

### Bug Fix: Database Schema & API Route Alignment

#### ?? Backend Changes

- **Schema Consistency**: Added missing columns (in_doc_date to c_information and ot_payload to c_bot_findings as jsonb) to the Docker PostgreSQL instance to resolve HTTP 500 errors during public search and admin dashboard loads.
- **API Namespace**: Corrected missed /admin/... frontend API calls in piService.ts (e.g. getDashboardData, getUsers) to /api/admin/... ensuring the Nginx proxy correctly routes dashboard data requests instead of serving static HTML.
- **Security Patch**: Updated uthLimiter path to /api/admin/auth and mitigated SSRF vulnerabilities in iService.ts by explicitly enforcing maxRedirects: 0 and catching HTTP 3xx status codes to throw proper generic errors.
- **TLS Handling**: Added ca-certificates to the Alpine node image and enabled a local TLS bypass (SMTP_TLS_REJECT_UNAUTHORIZED=false) for Nodemailer to ensure OTP emails are successfully dispatched through constrained network environments without triggering self-signed certificate errors.

## [1.1.50] - 2026-05-23

### Security & Scaling Refactoring

#### ?? Backend Changes

- **admin.ts (Transactions)**: Wrapped the multi-table INSERT and UPDATE SQL queries inside /circular/create and /circular/update with PostgreSQL transactions (BEGIN, COMMIT, ROLLBACK). This guarantees atomicity and prevents orphaned relations (e.g. categories, agencies, references) if an insert fails mid-execution.
- **admin.ts (IDOR Fix)**: Upgraded access control for PATCH /users/:id/2fa from
  equireAdmin to
  equireSuperAdmin to prevent IDOR (Insecure Direct Object Reference) vulnerabilities, ensuring only super-administrators can toggle 2FA constraints for other users.
- **admin.ts (Scalability)**: Documented an architectural TODO flag for implementing LIMIT/OFFSET pagination inside the heavy GET /admin/dashboard SQL query to prevent future Out-Of-Memory (OOM) risks as database volume grows.
- **index.ts & aiService.ts**: Confirmed and validated prior critical patches including uthLimiter namespacing to /api/admin/auth and SSRF prevention via maxRedirects: 0 during PDF text extraction.

## [1.1.51] - 2026-05-23

### Data Integrity & Validation

#### ?? Backend Changes

- **admin.ts (Zod Validation)**: Integrated zod schema validation (circularSchema) into the POST /circular/create and POST /circular/update endpoints.
- **Validation Gate**: Applied strict type enforcement (safeParse) on incoming multipart/form-data payload fields (e.g., in_num_date, in_detail) immediately after Multer processing. Requests with missing or malformed data are now instantly rejected with a 400 Bad Request and detailed error formatting, halting execution before any database transaction begins.

## [1.1.52] - 2026-05-23

### Final Architectural Cleanup

#### ?? Backend Changes

- **admin.ts (Middleware Validation)**: Refactored Zod validation into a reusable alidate(schema) middleware function, elegantly chaining it into route definitions (e.g., alidate(circularSchema)) to keep endpoint controllers clean and DRY.
- **admin.ts (Server-side Pagination)**: Upgraded the heavy GET /admin/dashboard endpoint to support server-side pagination to prevent potential Out-Of-Memory (OOM) issues as the database grows. Implemented query parameter extraction (page and limit), LIMIT/OFFSET SQL injections, and total count calculations. The API now returns a structured pagination metadata object alongside the data.

## [1.1.53] - 2026-05-25

### Clean Code & Optimization: System-wide Dead Code Cleanup

#### ⚙️ Backend Changes

- **Removed Unused File (`test-db.cjs`)**: Deleted the legacy JavaScript database connection test script that contained hardcoded local credentials.
- **Refactored AI Helpers (`aiService.ts`)**: Converted `extractTextFromPdf` and `getPdfBuffer` to private module functions by removing the redundant `export` keyword, as they are strictly consumed internally.
- **Cleaned Entry Point (`index.ts`)**: Removed the unused `cron` and `syncOCSC` imports from the API server startup script.
- **Cleaned Dependencies (`package.json`)**: Uninstalled unused dependencies (`cheerio`, `node-cron`, `winston`, `ws`) and their corresponding development type declarations (`@types/bcryptjs`, `@types/cheerio`, `@types/node-cron`) to optimize production builds and reduce surface vulnerabilities.

#### 🎨 Frontend Changes

- **Cleaned Dependencies (`package.json`)**: Uninstalled the unused `zod` and `@testing-library/react` (Dev) dependencies.
- **Verification Scripts (`start-circular.ps1`)**: Updated startup log output helper paths to correctly map the configured base route prefix (`/circular/`).

#### ✅ Verification

- Frontend Knip scan: **Passed with 0 unused files or dependencies**
- Backend Knip scan: **Passed with 0 unused files or dependencies (retaining only intentional future workflow role exports)**
- PM2 dev services: **Stable and running cleanly**

## [1.1.54] - 2026-05-26

### Bug Fix: Public Base URL Redirect for Officer Login

#### 🎨 Frontend Changes

- **Redirect Path (`apiService.ts`)**: Updated the global Axios response 401 interceptor redirect from `/admin/login` to `/circular/admin/login` to match the configured Vite public base path (`/circular/`). This prevents the Vite dev server from showing the base URL error page ("The server is configured with a public base URL...") when unauthorized API responses trigger a hard reload.

#### ⚙️ Backend Changes

- **API Status Dashboard (`index.ts`)**: Updated the HTML template links for "Public Portal" and "Admin Login" on the server's root status dashboard to use `/circular` and `/circular/admin/login` respectively.

### RBAC: Coordinator Permissions for Starting Workflows

- **Circular Play Button (`CircularSection.tsx`)**: Updated the conditional check for showing the workflow play button ("เริ่มเวียนหนังสือ") to include `admin?.permiss === 'admin'` in addition to `admin?.permiss === 'superadmin'` and `admin?.role === 'COORDINATOR'`. This ensures that Coordinator role users across all legacy permission levels (such as 'admin' and 'user') can fully see and interact with this button to start the document workflow.

### Database Maintenance

- **Workflow State Reset**: Reset `in_workflow_status`, `in_current_owner_id`, and `in_creator_id` to `NULL` (and cleared associated workflow history) for circular document **"นร 1008/ว 5"** dated **21 พฤษภาคม 2569** (ID 509). This restores the document to its original unprocessed state, allowing the newly updated coordinator play button ("เริ่มเวียนหนังสือ") to appear for active testing.
- **Workflow History Schema Fix**: Dropped and recreated the `c_workflow_history` table in the PostgreSQL database to align with the current schema design requirements defined in the codebase (`action` and `comments` columns), resolving the "column 'action' does not exist" error when initiating a workflow.

### Bug Fix: Workflow Inbox Missing Tasks

- **Auth State Management**: Fixed a critical issue where tasks were missing from the user's Inbox (`WorkflowInboxSection.tsx`) after initiating a workflow. The backend API (`/auth/login` and `/auth/verify-otp`) now explicitly returns the user's `id` (`admin.a_id`) in the JSON payload.
- **Frontend Context**: Updated the frontend `AuthContext` and `LoginPage` to properly extract, store (`localStorage`), and manage the `id` within the React state. This ensures that `admin.id` correctly matches `in_current_owner_id` during the Inbox rendering check.

### Bug Fix: Profile Modal Permission Display

- **Role Display Mapping**: Fixed a hardcoded ternary operator in `ProfileModal.tsx` that assumed any user who isn't a `superadmin` must be an `Admin`. It now correctly maps all three system permission levels (`superadmin` -> ผู้ดูแลระบบสูงสุด, `admin` -> ผู้ดูแลระบบ, `user` -> เจ้าหน้าที่ทั่วไป) to ensure the user's self-viewed profile matches the system's underlying reality shown in the User Management page.

## [1.1.55] - 2026-05-26

### Feature: Embedded User Snapshot in Workflow History (Audit-Proof)

#### 🎯 Design Rationale

Previously, the `c_workflow_history` table stored only `from_user_id` and `to_user_id`. When displaying history, the system performed a `JOIN` on the `admin` table to fetch names and positions. This meant that if a user changed their name, received a promotion, transferred departments, or was deleted from the system, the historical record of their past actions would retroactively reflect their new information — violating auditing integrity.

#### 🏗️ Database Changes (`fix_schema.ts`)

- Dropped and recreated the `c_workflow_history` table with 4 new snapshot text columns:
  - `from_user_name VARCHAR(255)`: The name of the actor at the time of action
  - `from_user_position VARCHAR(255)`: The official position/role of the actor at the time
  - `to_user_name VARCHAR(255)`: The name of the recipient at the time of action
  - `to_user_position VARCHAR(255)`: The official position/role of the recipient at the time

#### ⚙️ Backend Changes (`workflowService.ts`)

- Refactored all 6 workflow action methods (`startWorkflow`, `submitToHR`, `delegate`, `submitReview`, `approve`, `reject`) to use a new private `addHistory()` helper.
- `addHistory()` fetches the `a_name` and `a_position` (falling back to `a_role`) for both actors at the exact moment of the action, then embeds them as static text into the history record.
- Updated `getHistory()` to remove the `LEFT JOIN` on the `admin` table, as all required data is now embedded in the history row itself.

#### 🎨 Frontend Changes (`WorkflowHistoryModal.tsx`)

- Updated the history display to read `h.from_user_name`, `h.from_user_position`, `h.to_user_name`, `h.to_user_position` (the embedded static fields) instead of the previously joined `h.from_position`, `h.from_role` fields.
- Added handling for the `STARTED` action type label ("เริ่มกระบวนการ").
- Fixed a pre-existing bug where `h.comments` was wrapped in literal quote characters `"..."` instead of being rendered as a JSX variable.

## [1.1.56] - 2026-05-27

### UI/UX: Parallel Workflow Text & Label Enhancements

#### 🎨 Frontend Changes

- **WorkflowInboxSection.tsx**:
  - Changed the parallel flow activation button text from `"ส่ง Parallel"` to `"ส่งไปพิจารณา"`.
- **ParallelAssignModal.tsx**:
  - Removed technical and repetitive Thai subtitles and headers (e.g., deleted `"(หลายส่วนราชการ)"` and the `"กำหนดส่วนราชการปลายทางแต่ละ Track พร้อมกัน"` sub-heading).
  - Renamed the section header from `"ส่วนราชการที่รับมอบ (Parallel Tracks)"` to `"ส่วนราชการที่รับมอบ"`.
  - Replaced technical jargon like `"Track"` with `"ส่วนราชการ"` (e.g., changed `"เพิ่ม Track"` to `"เพิ่มส่วนราชการ"`, `"Track 1"` to `"ส่วนราชการที่ 1"`, and updated the progress indicators accordingly).
  - Changed the field label `"หมายเหตุ"` to `"เนื้อความ"`.

#### ✅ Verification

- Production build: **Passed with 0 errors**

## [1.1.57] - 2026-05-27

### Bug Fix & Compliance: Parallel Workflow Department Validation & Cross-Department Role Restricting

#### ⚙️ Backend Changes

- **admin.ts**:
  - Included `a_agency_id` in the SELECT columns list for `/users/by-role` and `GET /profile` endpoints, enabling department-based logic and user-filtering on the client interface.

#### 🎨 Frontend Changes

- **ParallelAssignModal.tsx**:
  - **Required Department Selection**: Added `required` to the agency select input, and styled it with a red asterisk (`*`). Form submission now strictly requires a department to be specified.
  - **Bug Fix**: Resolved user loading empty list bug when selecting departments by successfully receiving and filtering users on `a_agency_id`.
  - **Cross-Department Restriction Rule**: Implemented logic to dynamically fetch the coordinator's profile on mount. If the target department is different from the coordinator's department, the user select dropdown is strictly restricted to display only `DIV_DIRECTOR` (Director) and `HR_DIRECTOR` (HR Director) roles, since HR Directors share equivalent functional seniority to Division Directors.
  - **Root-Level Organizational Selection**: Fixed the agency selector to filter the API's flat list and keep only the root level of the organizational tree (where `parent_ag_id` is `null`), and sorted them by `agency_ordering` ascending to match the organization tree management screen layout.

#### ✅ Verification

- Production build: **Passed with 0 errors**

## [1.1.58] - 2026-06-03

### Build & Deploy: Production Compile and PM2 Local Deployment

#### ⚙️ Build Process

- Compiled backend Express/TypeScript API in `server` (`npm run build` -> `server/dist`).
- Built the React frontend applications:
  - Main unified frontend in `client` (`npm run build` -> `client/dist`).
  - Split admin frontend in `client-admin` (`npm run build` -> `client-admin/dist`).
  - Split public frontend in `client-public` (`npm run build` -> `client-public/dist`).

#### 🚀 Deployment

- Started all local dev services using PM2 via `powershell -ExecutionPolicy Bypass -File .\start-circular.ps1`.
- Verified API service is healthy and online at `http://localhost:3000/health`.
- Verified Frontend service is online and serving at `http://127.0.0.1:5173/circular/` (mapped to port 80 proxy).

## [1.1.59] - 2026-06-03

### Feature & Sync: Unified Client Delegation (Acting/Interim) Feature Integration

#### 🎨 Frontend Changes

- **apiService.ts**: Added `delegationApi` helper endpoints and updated `workflowApi.approve` signature.
- **DelegationModal.tsx** [NEW]: Copied the acting appointment modal component from `client-admin` to `client`.
- **UserSection.tsx**: Added the purple shield button (`bx-shield-plus`) to allow Superadmins to appoint an acting officer.
- **WorkflowActionModal.tsx**: Added signature context selection (`SELF` or `ACTING`) when signing documents.
- **WorkflowInboxSection.tsx**: Added the "กล่องงานรักษาการ (Acting Inbox)" container to display acting tasks and enable approval in acting capacity.

#### ✅ Verification

- Checked that `client` compiles and builds successfully via Vite with 0 errors.
- Restarted PM2 services.

## [1.1.60] - 2026-06-11

### DevOps: Docker Deployment Setup & Port Conflict Resolution

#### ⚙️ Docker & Infrastructure Changes

- **docker-compose.yml**:
  - Remapped the Nginx gateway external port mapping from `80:80` to `8080:80` to resolve a conflict with a local Windows Netsh port proxy listening on port 80.
- **.env.docker**:
  - Updated `FRONTEND_URL` to `http://localhost:8080` to match the new gateway port configuration for CORS mapping.
- **server/Dockerfile**:
  - Optimized the builder stage by skipping Puppeteer Chromium downloads (`ENV PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true`), which speeds up Docker builds significantly.
  - Copied the `patches/` folder before running `npm install` in both builder and production stages to ensure `patch-package` successfully applies the `@adminjs/express` patches.
  - Added `RUN chown -R node:node /app` before switching to `USER node` to fix `EACCES: permission denied` errors when AdminJS tries to bundle assets and create the `.adminjs` directory.
- **server/package.json**:
  - Moved `patch-package` to `dependencies` to ensure it is installed and runs in the production Docker stage.
- **client-public/.env.production & client-admin/.env.production**:
  - Changed `VITE_API_BASE_URL` to `"/circular"` so the React clients resolve API requests relative to the gateway's `/circular/api` path, avoiding 404 errors.

#### ✅ Verification

- **Docker Containers**: All 5 services (db, server, client-public, client-admin, gateway) are running and healthy.
- **Database Import**: Successfully cleared schema and imported `docs/circular_docker_export.sql` database dump with zero errors.
- **Endpoint Tests**: Verified API filters, public search route, and admin login page are accessible at `http://localhost:8080/circular/` and `http://localhost:8080/circular/admin/`.
