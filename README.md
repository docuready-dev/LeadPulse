<div align="center">

<img src="https://raw.githubusercontent.com/docuready-dev/Strovr/main/assets/Strovr%20Logo.png" alt="Strovr Logo" width="350" height="350">

# Strovr | Autonomous B2B Lead Harvester & Outreach Infrastructure

[![TypeScript](https://img.shields.io/badge/TypeScript-5.0+-3178C6?style=flat&logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![React](https://img.shields.io/badge/React-18+-61DAFB?style=flat&logo=react&logoColor=black)](https://reactjs.org/)
[![Vite](https://img.shields.io/badge/Vite-5+-646CFF?style=flat&logo=vite&logoColor=white)](https://vitejs.dev/)
[![Node.js](https://img.shields.io/badge/Node.js-18+-339933?style=flat&logo=node.js&logoColor=white)](https://nodejs.org/)
[![Express](https://img.shields.io/badge/Express-5+-000000?style=flat&logo=express&logoColor=white)](https://expressjs.com/)
[![Firebase](https://img.shields.io/badge/Firebase-Firestore-FFCA28?style=flat&logo=firebase&logoColor=black)](https://firebase.google.com/)
[![SendGrid](https://img.shields.io/badge/SendGrid-API_443-00B2E2?style=flat&logo=twilio&logoColor=white)](https://sendgrid.com/)
[![License](https://img.shields.io/badge/License-Proprietary-red.svg)](LICENSE)

</div>

**Strovr** is a full-stack, enterprise-grade B2B customer acquisition platform that unifies real-time geo-targeted lead discovery, an intelligent audience CRM, executive AI copywriting, and high-deliverability multi-channel outreach (Email, WhatsApp, and Webhooks) into a single high-performance workspace.

---

## Table of Contents

- [Core Features](#core-features)
- [Interactive Email Frameworks](#interactive-email-frameworks)
- [Universal Email Attachments Engine](#universal-email-attachments-engine)
- [Executive AI Co-Pilot](#executive-ai-co-pilot)
- [Multi-Channel Outbox Architecture](#multi-channel-outbox-architecture)
- [System Architecture & Data Flow](#system-architecture--data-flow)
- [Tech Stack](#tech-stack)
- [Project Directory Structure](#project-directory-structure)
- [Environment Variables](#environment-variables)
- [Getting Started](#getting-started)
- [CAN-SPAM & Deliverability Compliance](#can-spam--deliverability-compliance)
- [License](#license)

---

## Core Features

### 1. High-Velocity Lead Discovery & SerpApi Harvesting
- **Geo-Targeted Extraction**: Harvest hyper-localized commercial leads using Google Maps, Google Local, and custom SerpApi queries without IP blocks or captcha halts.
- **Deep Data Enrichment**: Captures business names, verified telephone numbers, direct emails, website domains, Google star ratings, categories, and full physical addresses.
- **Credit-Pool Safety Engine**: Smart tier management and automatic quota caps prevent API overages.

### 2. Centralized Audience CRM & Cross-Device Database
- **Unified Lead Reservoir**: Every harvested prospect and manual contact aggregates into an active database accessible across mobile and desktop sessions.
- **Multi-Dimensional Sorting & Filtering**: Sort audiences instantly by harvest date, city, niche, engagement status, or rating.
- **Lifecycle Pipeline Tracking**: Automatically updates prospect status from `New` to `Contacted`, `Replied`, or `Closed` upon live dispatch.
- **Export & Import**: Instant CSV and Excel exports formatted for seamless import into external CRMs.

### 3. Multi-Channel Outreach Engine (Email + WhatsApp)
- **Direct-to-Inbox Emailing**: Dispatches compiled HTML templates with live merge tags directly into recipient inboxes.
- **1-Click WhatsApp Web Bridge**: Generates pre-formatted WhatsApp chat deep-links (`wa.me`) injected with recipient-specific variables and collateral links.
- **50/50 A/B Split Testing**: Run concurrent variant testing across subjects, copy angles, and CTA configurations to optimize open and click-through rates.

---

## Interactive Email Frameworks

Strovr includes 10 production-tested, responsive email blueprints designed for cross-client inbox rendering:

1. **Text Only**: Raw, high-deliverability plain-text style tailored for executive 1-to-1 cold outreach.
2. **One Column**: Clean, focused direct proposition featuring hero typography and brand accents.
3. **Interactive Calendar**: Embeds interactive 15-minute slot selectors that route straight to Google Calendar or Calendly.
4. **Hybrid Grid**: Blends top-level editorial copy with split columns for market insights and service comparisons.
5. **Inverted Pyramid**: Attention-grabbing visual funnel designed to drive maximum click-through rates.
6. **Interactive ROI Matrix**: Compares manual overhead against automated acquisition metrics with live ROI badges.
7. **F-Pattern Editorial**: Built to match natural eye-scanning paths with high-impact scannable bullet points.
8. **Dynamic Product & Service Feed**: E-commerce and agency service card catalog with custom pricing and order triggers.
9. **Two Column**: Side-by-side solution comparison (e.g., Managed Service vs. Self-Serve Software).
10. **Zig-Zag Step Journey**: Alternating visual walkthrough showcasing onboarding milestones or case-study proof.

---

## Universal Email Attachments Engine

Available universally across **all 10 email layouts**:
- **Collateral Presets**: 1-click addition of verified assets including `Executive Pitch Deck (PDF)`, `Strategic Growth Audit (PDF)`, `Client Case Study (PDF)`, and `Commercial Pricing Sheet (XLS/PDF)`.
- **Custom Local File Uploads**: Drag and drop real PDF, DOC, Sheet, or Image files directly from your computer; files are converted to high-integrity base64 payloads for delivery.
- **Merge-Tag Enabled Filenames**: Attachment filenames dynamically substitute recipient properties (e.g., `{{business_name}}_Growth_Blueprint.pdf` renders as `AcmeCorp_Growth_Blueprint.pdf`).
- **Dual-Layer Delivery**:
  - Embedded HTML attachment summary box with file-type badges, file sizes, and secure download actions.
  - Native MIME multi-part attachment headers forwarded directly to SendGrid Web API and Nodemailer transports.

---

## Executive AI Co-Pilot

Strovr replaces generic boilerplate strings with an intent-driven, high-converting B2B copywriting matrix:
- **Zero Prompt Echoing**: Never repeats user instructions verbatim inside the letter body.
- **Intent Recognition Matrix**:
  - *Growth Call & Meeting Intents*: Crafts pipeline-scaling hook questions, 1-to-2 sentence value propositions, and 15-minute introductory invitations paired with `{{booking_link}}`.
  - *Audit & Benchmark Intents*: Frames local competitor footprint teardowns and data-backed findings.
  - *Preferred Partner & Pilot Intents*: Generates exclusive commercial terms and onboarding invitations.
  - *Demo & Showcase Intents*: Focuses on operational automation and eliminating manual prospecting friction.
- **Hybrid AI Engine**: Integrates natively with the Google Gemini API (`gemini-1.5-flash`) when configured, with an instant, deterministic zero-latency client/server fallback synthesizer.

---

## Multi-Channel Outbox Architecture

```
                +-----------------------------+
                |        Strovr Web App       |
                |   (Outreach Center Studio)  |
                +--------------+--------------+
                               |
           +-------------------+-------------------+
           |                                       |
           v                                       v
+----------------------+                +----------------------+
|  SendGrid REST API   |                |  Direct SMTP Socket  |
|  (HTTPS Port 443)    |                |  (TLS 587 / SSL 465) |
+----------+-----------+                +----------+-----------+
           |                                       |
           +-------------------+-------------------+
                               |
                               v
                    +---------------------------+
                    |    Recipient Mailbox      |
                    |  (Google, Outlook, etc.)  |
                    +---------------------------+

```

```

- **Render-Proof Cloud Deliverability**: Standard outbound ports (25, 465, 587) are frequently blocked on cloud container platforms. Strovr uses Twilio SendGrid's v3 Web API over standard HTTPS (Port 443) for 100% reliable cloud dispatch.
- **Direct SMTP Fallback**: Supports custom host, port, user, and password configurations for local development and private mail servers.
- **Encrypted Credential Storage**: Mailbox credentials and SendGrid API keys persist securely per workspace in Google Cloud Firestore.

---

## System Architecture & Data Flow


``

+-----------------------------------------------------------------------------------+
|                                    CLIENT LAYER                                   |
|  React 19 | TypeScript | Vite | Tailwind CSS | Zustand State | Lucide Icons       |
+----------------------------------------+------------------------------------------+
| REST / JSON (Axios)
v
+-----------------------------------------------------------------------------------+
|                                    SERVER LAYER                                   |
|  Node.js | Express 5 | TypeScript | Scraper Queue Worker | Template Compiler      |
+-------------------+--------------------+--------------------+---------------------+
|                    |                    |
v                    v                    v
+------------------+ +------------------+ +------------------+
| Google Firestore | |   SerpApi & GMap | |   Google Gemini  |
|  Cloud Database  | |   Search Engine  | |   AI Copy Engine |
+------------------+ +------------------+ +------------------+

```

---

## Tech Stack

### Frontend Application
- **Core Library**: React 19 with TypeScript
- **Build Tooling**: Vite 5 for fast Hot Module Replacement (HMR) and optimized rollup production bundles
- **Styling**: Tailwind CSS with custom delightful design system palettes
- **State Management**: Zustand with persistent client hydration
- **Routing**: React Router DOM v6
- **Icons**: Lucide React
- **HTTP Client**: Axios with authenticated request interceptors

### Backend Services
- **Runtime Environment**: Node.js 18+ LTS
- **Framework**: Express 5 (TypeScript)
- **Cloud Database**: Google Cloud Firestore via `firebase-admin`
- **Security & Auth**: JSON Web Tokens (JWT), bcrypt password hashing, 2FA support
- **Mail Transports**: SendGrid Web API (`@sendgrid/mail` / HTTPS fetch) and Nodemailer
- **Web Scraping & Extraction**: Puppeteer Headless Chromium and SerpApi client

---


## CAN-SPAM & Deliverability Compliance

Every communication generated by Strovr enforces global email deliverability standards:

* **Mandatory Physical Address**: Automatically injects physical commercial headquarters into the footer.
* **One-Click Unsubscribe Registry**: Embeds tamper-proof `unsubscribe` endpoints that record recipient opt-outs inside the Firestore `unsubscribes` collection.
* **Automated Suppression**: Blocked and unsubscribed addresses are automatically filtered before dispatch batches execute.
* **Domain Reputation Protection**: Includes strict daily sending limits and pause triggers on bounce-rate spikes to safeguard sender IP reputation.

---

## License

Copyright (c) 2026 Strovr. All rights reserved. Commercial distribution and licensing managed by DocuReady.
