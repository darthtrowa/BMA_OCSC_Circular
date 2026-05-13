# Strategy for OCSC Circular Content Analysis & BMA Adoption

This document outlines the strategy for ingesting, analyzing, and processing OCSC (Office of the Civil Service Commission) circulars for consideration by the Bangkok Metropolitan Administration (BMA).

## 1. Data Ingestion Strategy

To handle large documents and numerous attachments efficiently, the system will use a multi-tiered approach:

*   **Tier 1: Metadata Extraction (Bot Level)**
    *   Capture basic info: Circular Number, Date, Title, and Source URL.
    *   Store in `c_bot_findings` for initial review.
*   **Tier 2: Structured Content (AI Level)**
    *   Automatically generate summaries using AI (Disabled).
    *   Focus on:
        *   **Core Objective**: Why was this circular issued?
        *   **Target Group**: Who does it affect?
        *   **Key Changes**: What are the new rules/regulations?
        *   **BMA Implications**: Preliminary analysis of how this affects existing BMA rules.
*   **Tier 3: Full-Text & Attachments**
    *   Store original PDF files in `uploads/`.
    *   Use PDF Text Extraction (OCR if needed) to index content for deep search.
    *   Categorize attachments (e.g., Application Forms, Guidelines, Salary Scales).

## 2. AI-Powered Analysis Workflow

Leveraging the existing AI integration, the analysis process follows these steps:

1.  **Extraction**: The system downloads the PDF and extracts text using libraries like `pdf-parse` or cloud OCR.
2.  **Segmentation (Chunking)**: Large documents are broken into manageable segments (Circular letter vs. Annexes).
3.  **Prompting**: The AI is prompted to compare the OCSC circular with known BMA structures.
    *   *Example Prompt*: "Summarize the key points of this circular and identify specific sections that may require BMA to update its local regulations."
4.  **Drafting**: AI populates the `in_detail_ag` field (BMA Consideration) with a draft analysis for the Coordinator to review.

## 3. User Interface Enhancements

*   **Side-by-Side Review**: A UI layout showing the OCSC PDF on one side and the BMA draft consideration on the other.
*   **AI Insight Button**: An interactive button in the Admin Dashboard to trigger/re-run AI analysis on a specific document.
*   **Annex Navigator**: A structured list of attachments allowing users to jump directly to specific annexes without scrolling through a massive PDF.

## 4. Implementation Roadmap

1.  **Refine Bot**: Update the bot to download files and trigger the extraction service.
2.  **AI Integration**: Implement a background job that sends extracted text to the AI service upon discovery.
3.  **UI Updates**: Modify the `CircularSection` and `AdminDashboard` to display AI-generated insights and provide PDF interaction tools.
