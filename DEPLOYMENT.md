# Deployment Guide

This guide covers deploying ServiceDesk Pro using a free-tier compatible stack:
- **Database:** MongoDB Atlas (Free Tier)
- **API Server (Node.js):** Render (Free or Starter tier)
- **Frontend (React/Vite):** Vercel or Render (Free tier)

---

## 1. Database: MongoDB Atlas

1. Create a free account at [MongoDB Atlas](https://www.mongodb.com/cloud/atlas/register).
2. Create a new **Free (M0)** cluster.
3. In **Database Access**, create a new database user (e.g., `sdpro_user`) and generate a secure password. Save this password.
4. In **Network Access**, add the IP address `0.0.0.0/0` (Allow access from anywhere) so Render can connect to it.
5. In **Clusters**, click **Connect** → **Drivers** (Node.js).
6. Copy the connection string. It will look something like this:
   `mongodb+srv://sdpro_user:<password>@cluster0.xxxxx.mongodb.net/?retryWrites=true&w=majority`
7. Replace `<password>` with the password you generated, and insert a database name (e.g., `servicedesk_pro`) before the `?`.
   **Final URI Example:**
   `mongodb+srv://sdpro_user:MySecurePassword@cluster0.xxxxx.mongodb.net/servicedesk_pro?retryWrites=true&w=majority`

---

## 2. API Server: Render

1. Create a free account at [Render](https://render.com).
2. Connect your GitHub account and click **New** → **Web Service**.
3. Select your repository.
4. Configure the Web Service:
   - **Name:** `servicedesk-pro-api`
   - **Root Directory:** `server` (Important: this tells Render to only build the backend)
   - **Environment:** `Node`
   - **Build Command:** `npm install`
   - **Start Command:** `npm start`
5. Scroll down to **Environment Variables** and add the following:

   | Key | Value | Notes |
   |---|---|---|
   | `MONGO_URI` | *(Your Atlas connection string)* | From Step 1 |
   | `JWT_SECRET` | *(A long random string)* | E.g., generate using `openssl rand -base64 32` |
   | `JWT_EXPIRES` | `8h` | Or `1d` |
   | `CLIENT_URL` | `https://your-frontend-url.vercel.app` | **CRITICAL for CORS**. Update this after deploying the frontend. |
   | `NODE_ENV` | `production` | Enables Express production mode |
   | `GROQ_API_KEY` | *(Your Groq API key)* | Optional: For AI features |
   | `GROQ_MODEL` | `llama-3.3-70b-versatile` | Optional |

6. Click **Create Web Service**.
7. Once deployed, note the Render URL (e.g., `https://servicedesk-pro-api.onrender.com`). You will need this for the frontend.

---

## 3. Frontend: Vercel (Recommended)

Vercel is ideal for Vite/React applications.

1. Create a free account at [Vercel](https://vercel.com).
2. Click **Add New** → **Project**.
3. Import your GitHub repository.
4. Configure the Project:
   - **Project Name:** `servicedesk-pro`
   - **Framework Preset:** `Vite`
   - **Root Directory:** `client` (Important: click Edit and select the `client` folder)
5. Open **Environment Variables** and add:
   - **Name:** `VITE_API_URL`
   - **Value:** `https://servicedesk-pro-api.onrender.com/api` (Replace with your actual Render URL, making sure to append `/api`)
6. Click **Deploy**.
7. Once deployed, copy your Vercel domain (e.g., `https://servicedesk-pro.vercel.app`).
8. **Crucial Final Step:** Go back to your Render API dashboard, edit the `CLIENT_URL` environment variable to exactly match your Vercel domain (no trailing slash), and trigger a manual deploy on Render so it updates the CORS rules.

---

## Alternative 3: Frontend on Render (Static Site)

If you prefer to keep everything on Render:

1. In Render, click **New** → **Static Site**.
2. Select your repository.
3. Configure the Static Site:
   - **Name:** `servicedesk-pro-web`
   - **Root Directory:** `client`
   - **Build Command:** `npm install && npm run build`
   - **Publish Directory:** `client/dist` (Vite outputs to `dist`)
4. Add Environment Variable:
   - `VITE_API_URL` = `https://servicedesk-pro-api.onrender.com/api`
5. Click **Create Static Site**.
6. **Rewrite Rules (Important for SPA routing):**
   - Go to the **Redirects/Rewrites** tab for your Static Site.
   - Add a rule:
     - **Source:** `/*`
     - **Destination:** `/index.html`
     - **Action:** `Rewrite`
7. Update the `CLIENT_URL` on your API Web Service to match your new frontend Render URL.

---

## 4. Seeding Initial Data (Optional)

If you want to load the demo accounts and initial configuration into your production database:

1. Ensure your Render API is deployed and connected to Atlas.
2. In the Render dashboard for your API Web Service, go to the **Shell** tab.
3. Run the following command:
   ```bash
   npm run seed
   ```
   *Warning: This will drop existing collections and insert the demo data.*

---

## 5. File Uploads in Production

By default, the application saves uploaded files (ticket attachments) to the local disk in `server/uploads`.

**On ephemeral filesystems like Render's free tier, these files will be lost every time the server restarts.**

For a true production deployment, you should update `server/src/middleware/upload.js` and the corresponding controllers to upload files to an object storage service like **AWS S3**, **Cloudinary**, or **Google Cloud Storage** instead of the local filesystem.
