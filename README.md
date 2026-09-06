# LinkedIn Opportunity Hub

LinkedIn Opportunity Hub is a **private, review-first job-search dashboard**. It lets an authorised owner capture a vacancy that they have manually opened on any public job site, compare it with verified CV evidence, manage it in a controlled pipeline and prepare factual application materials for review.

> The application **does not access, control, navigate, complete forms in, or submit through any job-site account**. The user remains responsible for every final external action.

## Operating model

| Stage | Purpose | Controlled transition |
| --- | --- | --- |
| Captured | A user supplies a safe public job-site URL and pasted job description. | Move to Review or Archived. |
| Review | The vacancy is assessed against verified evidence only. | Move to Approved, return to Captured or Archive. |
| Approved | The user authorises factual CV-tailoring and supporting-material drafts. | Confirm an external manual handoff or Archive. |
| Applied | The role is recorded only after the user submits manually on the original job site and enters the exact confirmation phrase. | Move to Archived. |
| Archived | The role is closed, paused or no longer relevant. | Return to Review if needed. |

The dashboard blocks direct progression to **Applied**. It also requires an explicit, recorded confirmation before providing the outbound original-job-site handoff for an Approved role.

## External job-site capture

You can capture vacancies from employer career sites, applicant-tracking systems and job boards, including sites where you are already signed in. Copy the address of the open role and paste the complete job description into the dashboard; the application extracts the role detail from that user-supplied text.

The dashboard deliberately does **not** read your browser session, credentials or authenticated page content. This preserves your control of each account and prevents the application from acting on your behalf. It accepts safe public `http` or `https` URLs, rejects embedded credentials and local or private-network addresses, and removes recognised tracking parameters for duplicate detection while retaining meaningful vacancy identifiers.

## Evidence boundary

All vacancy scoring and prepared materials draw from the verified career evidence seeded for the workspace owner. The analysis displays both matched requirements and unsupported gaps. Gaps are deliberately excluded from the CV-tailoring brief and supporting-material draft.

This project is designed around the verified profile of **Gilles Bonelli FCCA**. Before adapting it for another person, replace the evidence source with a reviewed, authorised profile and keep the same no-fabrication control.

## Features

| Area | Included behaviour |
| --- | --- |
| Manual job-site handoff | Stores a URL and pasted job description only; no account automation or browser-session access. |
| Criteria | Editable target titles, location, remote preferences, employment type, compensation threshold, sectors and exclusions. |
| Vacancy review | Normalised URL based duplicate detection, role-detail extraction, deadline and private notes. |
| Evidence scoring | Rule-based fit score, rationale, verified requirement matches and visible unsupported gaps. |
| Application preparation | ATS-aware CV-tailoring brief and supporting-material draft for Approved roles, held for review. |
| Safeguards | Owner-restricted procedures, fixed pipeline stages, confirmation-gated manual handoff and confirmation-gated Applied status. |

## Technology

The project uses React, TypeScript, Tailwind CSS, Express, tRPC, Drizzle ORM and a MySQL-compatible database. It is based on the Manus full-stack application template and uses the template’s OAuth and server-side environment integration.

## Local development

This source code expects platform-provided environment variables for OAuth, database access and service configuration. Do **not** commit real credentials or a `.env` file.

```bash
pnpm install
pnpm drizzle-kit generate
pnpm test
pnpm check
pnpm dev
```

When connected to a compatible database, review each generated SQL migration under `drizzle/` before applying it. The existing migrations create the criteria, verified-evidence and vacancy tables, then add the recorded external-handoff confirmation fields.

## Validation

The test suite covers the core safety and processing rules, including:

- Generic job-site URL normalisation and source duplicate checks.
- Unsafe, malformed, local and credential-bearing URL rejection at the protected capture procedure.
- Duplicate capture reporting without a second vacancy record.
- Evidence matching and isolation of unsupported requirements.
- Exclusion of unsupported requirements from supporting-material drafts.
- Prevention of direct movement to Applied.

Run the complete suite with `pnpm test && pnpm check`.

## Security and privacy

The app has been built as a personal workspace. Protected procedures restrict access to the configured owner, while the browser interface requires authentication. Vacancy content, notes, career evidence and generated drafts should be treated as sensitive personal and professional information.

Before public deployment, verify the owner identity configuration, use an appropriate database security configuration, and ensure that access is limited to the intended user.
