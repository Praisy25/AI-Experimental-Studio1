# AI Experiment Studio — free local setup

The project defaults to **local Ollama inference**. In this mode it does not send prompts to paid AI APIs, and the API rejects external provider connections and inference calls. Running on your own computer avoids hosting and database service fees; it still uses your computer, electricity, and network connection.

## Requirements

- Node.js and npm
- Docker Desktop (for the local PostgreSQL database)
- Ollama installed and running on `http://localhost:11434`
- At least one model pulled in Ollama

## Start the app

1. Start PostgreSQL from the project root:

   ```powershell
   docker compose up -d postgres
   ```

2. Copy `apps/api/.env.example` to `apps/api/.env`. Keep `ALLOW_EXTERNAL_AI=false`. Set a private `AUTH_SECRET` for your local installation. The default database URL matches `docker-compose.yml`.

   Ollama URLs default to `http://localhost:11434`. If Ollama runs on another trusted machine, set `OLLAMA_BASE_URL` and add that server's hostname to `OLLAMA_ALLOWED_HOSTS` (comma-separated when there is more than one). Only localhost is allowed unless you list another hostname.

3. Pull a model using Ollama. Choose a model that fits your computer’s memory and the tasks you plan to run:

   ```powershell
   ollama pull <model-name>
   ```

4. Install dependencies and start the API:

   ```powershell
   cd apps/api
   npm install
   npx prisma migrate deploy --schema schema.prisma
   npm run dev
   ```

5. In a second terminal, start the web app:

   ```powershell
   cd apps/web
   npm install
   npm run dev
   ```

6. Open `http://localhost:3000`, create an account, then select **Local Ollama** and a model installed on your machine.

## Free mode behavior

- Chat, experiments, comparisons, debate judging, research analysis, quality analysis, and prompt refinement use Ollama.
- Provider API keys are not needed for local Ollama.
- The prompt recommender uses your configured model notes, Ollama model names, local response history, and entered prices. It does not call an external model or fetch live benchmark data.
- Document retrieval works with keyword ranking by default. For semantic ranking, pull a free Ollama embedding model such as `nomic-embed-text` and set `OLLAMA_EMBEDDING_MODEL=nomic-embed-text` in `apps/api/.env`. The API uses Ollama locally and falls back to keyword ranking if embeddings are unavailable.
- Scanned PDF pages can be transcribed locally by setting `OLLAMA_VISION_MODEL` to an installed Ollama vision model in `apps/api/.env`. Without it, PDFs with extracted text still work, while image-only pages need a vision model.
- Cost estimates use configured per-token prices. Local Ollama inference has no provider API charge, though running models requires local hardware.
- Password reset works without an email service during local development: the reset link appears on the password reset screen and expires after 30 minutes. In production, configure SMTP so links are delivered privately by email; production never returns the reset token in the API response.
- Local Ollama models count as $0 provider API cost in cost suggestions. Document retrieval and OCR require no paid service; semantic ranking and scanned-page transcription use the optional local Ollama models described above.

To deliberately enable external provider APIs, set `ALLOW_EXTERNAL_AI=true` in `apps/api/.env` and restart the API. External providers can incur charges, so the project keeps them disabled by default.
