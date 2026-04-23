# SalesPilot — API Specification

Base URL: `/api/v1`

All endpoints return JSON. Errors follow the format: `{"detail": "Error message"}`.

## Authentication

| Method | Path                | Auth | Role | Description          |
|--------|---------------------|------|------|----------------------|
| POST   | /auth/register      | No   | —    | Register new user    |
| POST   | /auth/login         | No   | —    | Login, returns JWT   |
| GET    | /auth/me            | Yes  | Any  | Get current user     |

### POST /auth/login
Request: `{"email": "user@example.com", "password": "secret123"}`
Response: `{"access_token": "eyJ...", "token_type": "bearer", "expires_in": 3600}`

## Users

| Method | Path                | Auth | Role  | Description         |
|--------|---------------------|------|-------|---------------------|
| GET    | /users              | Yes  | admin | List users (paginated) |
| GET    | /users/{id}         | Yes  | Any   | Get user by ID      |
| PATCH  | /users/{id}         | Yes  | admin | Update user         |

## Teams

| Method | Path                         | Auth | Role          | Description       |
|--------|------------------------------|------|---------------|-------------------|
| GET    | /teams                       | Yes  | Any           | List teams        |
| POST   | /teams                       | Yes  | admin/manager | Create team       |
| GET    | /teams/{id}                  | Yes  | Any           | Get team detail   |
| PATCH  | /teams/{id}                  | Yes  | admin/manager | Update team       |
| DELETE | /teams/{id}                  | Yes  | admin         | Soft delete team  |
| GET    | /teams/{id}/members          | Yes  | Any           | List members      |
| POST   | /teams/{id}/members          | Yes  | admin/manager | Add member        |
| DELETE | /teams/{id}/members/{uid}    | Yes  | admin/manager | Remove member     |

### POST /teams
Request: `{"name": "Sales Team", "description": "Primary sales team"}`
Response: `{"id": "uuid", "name": "Sales Team", "description": "...", "created_by": "uuid", "member_count": 0, ...}`

### POST /teams/{id}/members
Request: `{"user_id": "uuid"}`

## Strategies (ICP)

| Method | Path                              | Auth | Role          | Description              |
|--------|-----------------------------------|------|---------------|--------------------------|
| GET    | /strategies                       | Yes  | Any           | List strategies          |
| POST   | /strategies                       | Yes  | Any           | Create strategy          |
| GET    | /strategies/{id}                  | Yes  | Any           | Get strategy detail      |
| PATCH  | /strategies/{id}                  | Yes  | Any           | Update strategy          |
| DELETE | /strategies/{id}                  | Yes  | Any           | Soft delete              |
| GET    | /strategies/{id}/companies        | Yes  | Any           | List matched companies   |
| POST   | /strategies/{id}/companies        | Yes  | Any           | Add companies            |
| DELETE | /strategies/{id}/companies/{cid}  | Yes  | Any           | Remove company           |
| POST   | /strategies/{id}/discover         | Yes  | Any           | Trigger AI discovery     |

## Companies

| Method | Path                              | Auth | Role  | Description              |
|--------|-----------------------------------|------|-------|--------------------------|
| GET    | /companies                        | Yes  | Any   | List companies           |
| POST   | /companies                        | Yes  | Any   | Create company           |
| GET    | /companies/{id}                   | Yes  | Any   | Get company detail       |
| PATCH  | /companies/{id}                   | Yes  | Any   | Update company           |
| DELETE | /companies/{id}                   | Yes  | Any   | Soft delete              |

## Contacts

| Method | Path                              | Auth | Role  | Description              |
|--------|-----------------------------------|------|-------|--------------------------|
| GET    | /contacts                         | Yes  | Any   | List contacts            |
| POST   | /contacts                         | Yes  | Any   | Create contact           |
| GET    | /contacts/{id}                    | Yes  | Any   | Get contact detail       |
| PATCH  | /contacts/{id}                    | Yes  | Any   | Update contact           |
| DELETE | /contacts/{id}                    | Yes  | Any   | Soft delete              |
| POST   | /contacts/{id}/enrich             | Yes  | Any   | Trigger enrichment       |

## Research

| Method | Path                              | Auth | Role  | Description              |
|--------|-----------------------------------|------|-------|--------------------------|
| GET    | /research/briefs                  | Yes  | Any   | List research briefs     |
| POST   | /research/generate                | Yes  | Any   | Generate research brief  |
| GET    | /research/briefs/{id}             | Yes  | Any   | Get brief detail         |

## Campaigns

| Method | Path                              | Auth | Role          | Description              |
|--------|-----------------------------------|------|---------------|--------------------------|
| GET    | /campaigns                        | Yes  | Any           | List campaigns           |
| POST   | /campaigns                        | Yes  | Any           | Create campaign          |
| GET    | /campaigns/{id}                   | Yes  | Any           | Get campaign detail      |
| PATCH  | /campaigns/{id}                   | Yes  | Any           | Update campaign          |
| DELETE | /campaigns/{id}                   | Yes  | Any           | Soft delete              |
| POST   | /campaigns/{id}/approve           | Yes  | admin/manager | Approve campaign         |
| POST   | /campaigns/{id}/launch            | Yes  | admin/manager | Launch campaign          |
| GET    | /campaigns/{id}/contacts          | Yes  | Any           | List campaign contacts   |
| POST   | /campaigns/{id}/contacts          | Yes  | Any           | Add contacts             |
| GET    | /campaigns/{id}/steps             | Yes  | Any           | List sequence steps      |
| POST   | /campaigns/{id}/steps             | Yes  | Any           | Add sequence step        |

## Messages

| Method | Path                              | Auth | Role          | Description              |
|--------|-----------------------------------|------|---------------|--------------------------|
| GET    | /messages                         | Yes  | Any           | List message drafts      |
| POST   | /messages/generate                | Yes  | Any           | Generate message via AI  |
| GET    | /messages/{id}                    | Yes  | Any           | Get message detail       |
| PATCH  | /messages/{id}                    | Yes  | Any           | Edit message draft       |
| POST   | /messages/{id}/approve            | Yes  | admin/manager | Approve message          |
| POST   | /messages/{id}/send               | Yes  | admin/manager | Send message             |

## Analytics

| Method | Path                              | Auth | Role  | Description              |
|--------|-----------------------------------|------|-------|--------------------------|
| GET    | /analytics/dashboard              | Yes  | Any   | Dashboard metrics        |
| GET    | /analytics/pipeline               | Yes  | Any   | Pipeline funnel data     |
| GET    | /analytics/campaigns/{id}         | Yes  | Any   | Campaign analytics       |

## Exports

| Method | Path                              | Auth | Role  | Description              |
|--------|-----------------------------------|------|-------|--------------------------|
| POST   | /exports                          | Yes  | Any   | Create export job        |
| GET    | /exports                          | Yes  | Any   | List export jobs         |
| GET    | /exports/{id}                     | Yes  | Any   | Get export status        |
| GET    | /exports/{id}/download            | Yes  | Any   | Download export file     |

## Settings

| Method | Path                              | Auth | Role  | Description              |
|--------|-----------------------------------|------|-------|--------------------------|
| GET    | /settings                         | Yes  | Any   | Get app configuration    |
| PATCH  | /settings                         | Yes  | admin | Update runtime settings  |

### GET /settings
Response: `{"smtp_configured": true, "gcs_configured": false, "llm_providers": ["claude", "openai"], "enrichment_sources": ["llm_enrichment"], "cors_origins": ["http://localhost:3000"]}`

## Pagination

Paginated endpoints accept `page` (default 1) and `per_page` (default 20, max 100) query parameters.

Response format:
```json
{
  "items": [...],
  "total": 42,
  "page": 1,
  "per_page": 20,
  "pages": 3
}
```

## Error Codes

| Code | Meaning                |
|------|------------------------|
| 400  | Bad Request            |
| 401  | Unauthorized           |
| 403  | Forbidden (wrong role) |
| 404  | Not Found              |
| 409  | Conflict (duplicate)   |
| 422  | Validation Error       |
| 500  | Internal Server Error  |
