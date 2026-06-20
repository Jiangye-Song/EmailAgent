# Alibaba Cloud Deployment Proof

This document demonstrates that the Email Digest Agent backend is running on Alibaba Cloud.

## Services Used

| Service | Purpose | Region |
|---|---|---|
| **Function Compute 3.0** | Hosts the Next.js API routes (standalone container) | ap-southeast-1 (Singapore) |
| **PolarDB for PostgreSQL** | Application database — `email_records`, `user_rules` | ap-southeast-1 |
| **OSS (Object Storage)** | Stores digest exports and email attachments | oss-ap-southeast-1 |
| **ACR (Container Registry)** | Stores the Docker image for Function Compute | ap-southeast-1 |

## Function Compute Endpoint

> **TODO:** Replace with actual deployed URL after deployment.

```
https://<account-id>.<region>.fc.aliyuncs.com/2016-08-15/proxy/<service>/<function>/
```

## Live API Call Proof

Below is an example `curl` call to the deployed Function Compute endpoint proving the backend is live on Alibaba Cloud:

```bash
# Replace <FC_URL> with the actual Function Compute HTTP trigger URL
curl -X POST https://<FC_URL>/api/process-emails \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <token>" \
  -d '{"limit": 5}'
```

## OSS Bucket

- **Bucket name:** `email-agent-assets`
- **Region:** `oss-ap-southeast-1`
- **Usage:** Daily digest JSON exports are written here by `src/lib/oss.ts`

## Code References

- `src/lib/oss.ts` — Alibaba Cloud OSS upload/download using `ali-oss` SDK
- `src/lib/db.ts` — PolarDB PostgreSQL connection via `pg` driver
- `Dockerfile` — Container image deployed to Alibaba Cloud Function Compute
- `.github/workflows/deploy.yml` *(planned)* — CI/CD push to ACR + FC deploy

## Proof Recording

> **TODO:** Add link to screen recording showing:
> 1. Alibaba Cloud Function Compute console with running function
> 2. Live HTTP request hitting the FC endpoint
> 3. PolarDB console showing data written by the function
