# Review Image Edge Function

## Overview
This Edge Function provides secure image access for friend verification using review tokens. It generates signed URLs for proof images without exposing storage paths or requiring authentication for anonymous reviewers.

## Route
`GET /functions/v1/review-image/{token}`

## Logic Flow
1. Extract token from URL path parameter
2. Query `review_tokens` table joined with `verifications`
3. Validate token exists and hasn't expired
4. Check verification status allows image access (`trial`, `approved`, `rejected`)
5. Generate signed URL using service role admin client
6. Return 302 redirect to signed URL

## Error Responses
- `400` - Missing token parameter
- `403` - Verification not accessible (invalid status)
- `404` - Invalid token or no image available
- `410` - Token expired
- `500` - Internal server error

## Environment Variables
- `SUPABASE_URL` - Supabase project URL
- `SUPABASE_SERVICE_ROLE_KEY` - Service role key for admin operations

## Deployment
```bash
supabase functions deploy review-image
```

## Usage
Frontend components use this endpoint directly:
```typescript
<img src={`${supabaseUrl}/functions/v1/review-image/${token}`} />
```

## Security
- Uses service role for admin operations
- Validates token expiry and verification status
- Generates short-lived signed URLs (1 hour TTL)
- No authentication required for anonymous reviewers
- CORS headers for cross-origin requests