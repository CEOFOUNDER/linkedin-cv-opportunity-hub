# Opportunity Control Room

Opportunity Control Room is a **browser-accessible CV-to-vacancy evidence reviewer**. It accepts a CV and a job description as pasted text or an uploaded document, then compares them against one another while preventing unsupported requirements from being converted into claims.

> **No sign-in is required.** The app does not access job-site accounts, browser sessions or credentials. It neither completes nor submits applications. The user remains in control of every external action.

## How it works

| Step | What you provide | What the app does | What it does not do |
| --- | --- | --- | --- |
| 1. CV evidence | A previous CV as PDF, DOCX, TXT, Markdown, RTF or pasted text. | Reads document text in the browser and makes it editable. | It does not save the uploaded file. |
| 2. Role specification | An optional original job URL, plus a pasted or uploaded job description. | Treats the URL as a reference and compares the supplied specification against the CV. | It does not visit the URL, read a logged-in page or reuse browser-session data. |
| 3. Evidence review | Your decision to run a comparison. | Sends the entered text to the server-side comparison service and returns structured evidence matches, gaps and review directions. | It does not store the CV, job description or result in the application database or file storage. |
| 4. Application | Your own review and use of the findings. | Presents direct CV quotations that support a requirement, alongside gaps. | It does not produce unsupported claims, operate a job-site account or submit an application. |

## Evidence boundary

The reviewer is deliberately constrained. A requirement is shown as **supported** only where the analysis identifies a short, exact quotation from the CV. Missing, weak or unclear requirements remain in **Unsupported or unclear gaps**. The output is a document-alignment aid—not a hiring prediction—and all final wording remains subject to your own review.

## Supported uploads and limits

| Document | Supported formats | Maximum size | Important note |
| --- | --- | ---: | --- |
| CV | PDF, DOCX, TXT, Markdown, RTF | 5 MB | PDFs must contain selectable text; use pasted text for scanned/image-only PDFs. |
| Job description | PDF, DOCX, TXT, Markdown, RTF | 5 MB | The role text can also be pasted directly from the page you have open. |
| Job URL | Public `http` or `https` URL | 2,048 characters | The URL is never fetched. Local addresses, private-network URLs and embedded credentials are rejected. |

The editable text area is capped at 60,000 characters per document. Uploaded files are handled locally in the browser; the extracted text is sent for analysis only when the user starts a factual comparison. The app does not persist uploads or comparison text.

## Safety controls

| Control | Behaviour |
| --- | --- |
| No external account access | The app does not log in to any job platform, read logged-in pages or use account credentials. |
| Manual applications | All form completion, outreach and submission stay manual and user-approved. |
| Direct-evidence matching | Each displayed match must include an exact CV quotation. |
| Visible gaps | Missing or unclear requirements are called out instead of implied or invented. |
| Input limits | File size, document length, URL format and short per-browser request limits reduce abuse exposure. |

## Local development

The app is built with React, TypeScript, Tailwind CSS, Express, tRPC, Drizzle ORM and the Manus server-side language-model integration.

```bash
pnpm install
pnpm test
pnpm check
pnpm dev
```

The public comparison endpoint uses platform-provided server credentials. Do **not** commit real credentials or a `.env` file. Run the full validation suite with `pnpm test && pnpm check`.
