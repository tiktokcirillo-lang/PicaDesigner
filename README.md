<div align="center">
<img width="1200" height="475" alt="GHBanner" src="https://github.com/user-attachments/assets/0aa67016-6eaf-458a-adb2-6e31a0763ed6" />
</div>

# Run and deploy PicaDesigner

This contains everything you need to run your app locally.

## Run Locally

**Prerequisites:**  Node.js


1. Install dependencies:
   `npm install`
2. Copy `.env.example` to `.env` and set the server-only `OPENAI_API_KEY`.
3. Start the internal API: `npm run server`
4. Start the frontend in another terminal: `npm run dev`

The browser never receives the OpenAI key. During development, Vite proxies `/api` to the internal server on port 3001.
