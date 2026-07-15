# Alibaba Cloud Deployment Proof

This document demonstrates that EmailAgent application is deployed on Alibaba Cloud ECS with a reverse proxy.

## Services Actually Used

| Service | Purpose | Region |
|---|---|---|
| **Alibaba Cloud ECS** | Hosts the Next.js production server | China (Hong Kong) |
| **Alibaba Cloud PolarDB for PostgreSQL** | Application database for users, sessions, email records, rules | China (Hong Kong) |

## Compute Proof (ECS)

- **Instance name:** launch-advisor-20260706
- **Instance ID:** i-j6c8cye7henjr2rgx825
- **Public IP:** 47.86.108.18
- **Status:** Running

Screenshot evidence is included in the hackathon submission showing this ECS instance in the Alibaba Cloud console.

Deployment note: the app is exposed through reverse proxy on standard web ports (80/443). Port 3000 is not publicly exposed.

## Live Application Endpoint

Public entry points:

```
https://emailagent.top/
```

or

```
http://47.86.108.18
```

## Live API Call Proof

Use an existing route from this project to prove backend is live. Example:

```bash
curl -i https://emailagent.top/api/auth/session
```

Fallback test URL (HTTP):

```bash
curl -i http://47.86.108.18/api/auth/session
```

Expected result: HTTP response from the deployed app route (status + JSON body).

## Code References

- `src/lib/db.ts` - PostgreSQL connection used for PolarDB connectivity
- `src/auth.ts` - NextAuth server configuration running on the deployed backend
- `src/app/api/auth/[...nextauth]/route.ts` - Auth API route exposed by the running backend
- `ecosystem.config.json` - Production process configuration for the Node.js app

