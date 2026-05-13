# Executive Dashboard Design for CSC Circular System

This document outlines the visual components and data requirements for a single-page dashboard to monitor the OCSC circular consideration workflow.

## 1. Summary Metrics (KPI Cards)
At the top of the dashboard, four primary counters provide an instant overview:
- **Total Bot Findings**: Count from `c_bot_findings` (All time).
- **Active Workflows**: Number of circulars where `in_workflow_status` is not 'DONE' or 'IGNORED'.
- **Adoption Count**: Number of circulars successfully integrated into BMA regulations.
- **Pending Initial Review**: New findings from the Bot that haven't entered the workflow yet.

## 2. Workflow Visualization
### 2.1 Workflow Stage Distribution (Bar Chart)
Visualizes how many circulars are at each role level:
- Coordinator Review
- HR Director Distribution
- Division/Section Assignment
- Staff Data Entry
- Approval Loop

### 2.2 Bottleneck Heatmap (Table/List)
Identifies where circulars are stalling by listing the Top 5 Users/Agencies with the most "Pending" tasks, sorted by the oldest `created_at` in `c_workflow_history`.

## 3. Analytical Insights
### 3.1 Circular Categories (Pie Chart)
Distribution based on `c_categories` (e.g., Salary, Discipline, Recruitment). Helps understand the focus areas of current OCSC policies.

### 3.2 Monthly Ingestion Trend (Line Chart)
Shows the volume of new circulars detected over the last 12 months.

## 4. Operational Lists
### 4.1 Urgent/Overdue Tasks
A high-priority list of circulars that have remained in the same workflow state for more than 5 working days.

### 4.2 Recent Bot Discoveries
A quick-glance list of the 5 most recent entries in `c_bot_findings` with links to the source PDF.

## 5. Technical Requirements (API Endpoints)
To power this dashboard, the following backend enhancements are needed:
- `GET /admin/stats/overview`: Returns KPI counts.
- `GET /admin/stats/workflow-stages`: Returns counts grouped by current owner role.
- `GET /admin/stats/bottlenecks`: Returns agencies with highest pending task counts.
- `GET /admin/stats/categories`: Returns distribution data for charts.
