# ResearchTrace

ResearchTrace is a local-first research provenance workspace. It helps analysts and research teams document not just a headline metric, but the method, data snapshot, code revision, runtime environment, random seed, artifact and caveats required for another person to understand the result.

## Product workflows

- Record research runs with explicit method and provenance fields.
- Fingerprint each saved metadata record with SHA-256 and export a portable Markdown report.
- Audit run completeness and highlight missing provenance fields before handoff.
- Record low / baseline / high sensitivity observations and calculate absolute and baseline-relative output spans.
- Compare entries grouped by study, metric and unit without misrepresenting comparisons as a statistical test.
- Export and import a versioned JSON archive, skipping duplicate record IDs.
- Keep records in browser local storage by default; there is no sign-in, server database or third-party research-data upload.

## Integrity and limitations

The SHA-256 fingerprint identifies the exact metadata record saved by the app and can show if that record later changes. It does not prove the experiment ran, validate that a data source is authentic, verify the author, guarantee independent reproduction or certify the result. It is not a signed timestamp or tamper-proof external ledger. Store source code, data snapshots, environment lockfiles and output artifacts in their authoritative repositories and record their immutable URLs or hashes here.

Sensitivity records are descriptive values entered by the user. ResearchTrace does not rerun the underlying code, infer causality, estimate confidence intervals or decide whether a result is scientifically sound. Browser local storage is not encrypted storage; use the application only on a device and browser profile appropriate for the sensitivity of your research data. Export a JSON archive for backup before clearing browser data.

## Local development

Requirements: Node.js 22 or newer.

```bash
npm ci
npm test
npm run lint
npm run build
npm run dev
```

## Deployment

The application is deployed at [researchtrace.vercel.app](https://researchtrace.vercel.app). The product is intentionally local-first and does not need Supabase credentials to store users' research records.
