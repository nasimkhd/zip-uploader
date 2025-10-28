# zip-uploader
Minimal React uploader and Node server to accept .zip files and place them into a pipeline inbox directory.

## Quick start

Prerequisites: Node 18+

1. Install deps

```bash
cd server && npm install
cd ../client && npm install
```

2. Run the server (port 4000)

```bash
cd server
npm start
```

3. Run the client (port 5173)

```bash
cd ../client
VITE_API_URL=http://localhost:4000 npm run dev
```

Open http://localhost:5173 and upload a .zip. Files are saved under `pipeline/inbox/`.

## Deployment

### Cloudflare Pages (Frontend)

Deploy the React frontend to Cloudflare Pages:

```bash
# Quick deployment script
./deploy.sh
```

Or follow the detailed guide in [DEPLOYMENT.md](./DEPLOYMENT.md).

### Backend Deployment

For production, deploy your Node.js server to:
- Railway
- Render
- Heroku
- DigitalOcean App Platform
- AWS/GCP/Azure

Update `VITE_API_URL` environment variable to point to your deployed backend.

## Notes

- Configure API base URL via `VITE_API_URL` env.
- Inbox path: `pipeline/inbox` (created automatically).
- Frontend optimized for Cloudflare Pages deployment.
