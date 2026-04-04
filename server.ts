import express from "express";
import { createServer as createViteServer } from "vite";
import { google } from "googleapis";
import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";
import admin from "firebase-admin";

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Initialize Firebase Admin
if (!admin.apps.length) {
  admin.initializeApp({
    projectId: process.env.VITE_FIREBASE_PROJECT_ID || JSON.parse(process.env.FIREBASE_CONFIG || "{}").projectId
  });
}

const db = admin.firestore();
const app = express();
const PORT = 3000;

app.use(express.json());

// Middleware to verify Firebase ID Token
const authenticate = async (req: any, res: any, next: any) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return res.status(401).json({ error: "Unauthorized" });
  }
  const idToken = authHeader.split("Bearer ")[1];
  try {
    const decodedToken = await admin.auth().verifyIdToken(idToken);
    req.user = decodedToken;
    next();
  } catch (error) {
    res.status(401).json({ error: "Invalid token" });
  }
};

const getRedirectUri = (req: any) => {
  const appUrl = process.env.APP_URL?.replace(/\/$/, "");
  if (appUrl) return `${appUrl}/auth/callback`;
  const protocol = req.headers['x-forwarded-proto'] === 'https' ? 'https' : 'http';
  return `${protocol}://${req.get('host')}/auth/callback`;
};

// Auth URL endpoint
app.get("/api/auth/url", authenticate, (req: any, res) => {
  const oauth2Client = new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    getRedirectUri(req)
  );

  const url = oauth2Client.generateAuthUrl({
    access_type: "offline",
    scope: [
      "https://www.googleapis.com/auth/webmasters.readonly",
      "https://www.googleapis.com/auth/analytics.readonly",
      "https://www.googleapis.com/auth/userinfo.profile",
    ],
    prompt: "consent",
    state: req.user.uid // Pass UID to callback
  });

  res.json({ url });
});

// OAuth Callback
app.get("/auth/callback", async (req, res) => {
  const { code, state: uid } = req.query;
  try {
    const oauth2Client = new google.auth.OAuth2(
      process.env.GOOGLE_CLIENT_ID,
      process.env.GOOGLE_CLIENT_SECRET,
      getRedirectUri(req)
    );

    const { tokens } = await oauth2Client.getToken(code as string);
    
    // Save tokens to Firestore for this specific user
    await db.collection("user_tokens").doc(uid as string).set(tokens);
    
    res.send(`
      <html>
        <body>
          <script>
            if (window.opener) {
              window.opener.postMessage({ type: 'OAUTH_AUTH_SUCCESS' }, '*');
              window.close();
            } else { window.location.href = '/'; }
          </script>
          <p>Authentication successful. Closing window...</p>
        </body>
      </html>
    `);
  } catch (error) {
    res.status(500).send("Authentication failed");
  }
});

// Helper to get user's OAuth client
async function getClientForUser(uid: string, req: any) {
  const doc = await db.collection("user_tokens").doc(uid).get();
  if (!doc.exists) return null;
  
  const tokens = doc.data();
  const oauth2Client = new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    getRedirectUri(req)
  );
  oauth2Client.setCredentials(tokens!);
  return oauth2Client;
}

app.get("/api/auth/status", authenticate, async (req: any, res) => {
  const doc = await db.collection("user_tokens").doc(req.user.uid).get();
  res.json({ 
    connected: doc.exists,
    configured: !!(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET)
  });
});

app.get("/api/gsc/sites", authenticate, async (req: any, res) => {
  try {
    const client = await getClientForUser(req.user.uid, req);
    if (!client) return res.status(401).json({ error: "Not connected" });
    const searchconsole = google.searchconsole({ version: "v1", auth: client });
    const response = await searchconsole.sites.list();
    res.json(response.data.siteEntry || []);
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch sites" });
  }
});

app.get("/api/gsc/data", authenticate, async (req: any, res) => {
  const { siteUrl, startDate, endDate } = req.query;
  try {
    const client = await getClientForUser(req.user.uid, req);
    if (!client) return res.status(401).json({ error: "Not connected" });
    const searchconsole = google.searchconsole({ version: "v1", auth: client });
    
    const [summary, timeSeries, details] = await Promise.all([
      searchconsole.searchanalytics.query({ siteUrl: siteUrl as string, requestBody: { startDate: startDate as string, endDate: endDate as string } }),
      searchconsole.searchanalytics.query({ siteUrl: siteUrl as string, requestBody: { startDate: startDate as string, endDate: endDate as string, dimensions: ["date"] } }),
      searchconsole.searchanalytics.query({ siteUrl: siteUrl as string, requestBody: { startDate: startDate as string, endDate: endDate as string, dimensions: ["query", "page", "device", "country"], rowLimit: 1000 } })
    ]);

    res.json({
      summary: summary.data.rows?.[0] || { clicks: 0, impressions: 0, ctr: 0, position: 0 },
      timeSeries: timeSeries.data.rows || [],
      rows: details.data.rows || [],
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// GA4 Data Endpoints
app.get("/api/ga4/properties", authenticate, async (req: any, res) => {
  try {
    const client = await getClientForUser(req.user.uid, req);
    if (!client) return res.status(401).json({ error: "Not connected" });
    
    const analyticsadmin = google.analyticsadmin({ version: "v1beta", auth: client });
    
    // 1. List accounts
    const accountsResponse = await analyticsadmin.accounts.list();
    const accounts = accountsResponse.data.accounts || [];
    
    // 2. List properties for each account
    let allProperties: any[] = [];
    for (const account of accounts) {
      const propertiesResponse = await analyticsadmin.properties.list({
        filter: `parent:${account.name}`
      });
      if (propertiesResponse.data.properties) {
        allProperties = [...allProperties, ...propertiesResponse.data.properties];
      }
    }
    
    res.json(allProperties);
  } catch (error: any) {
    console.error("Error fetching GA4 properties:", error);
    let message = error.message || "Failed to fetch GA4 properties";
    if (message.includes("analyticsadmin.googleapis.com")) {
      message = "Google Analytics Admin API is not enabled. Please enable it in your Google Cloud Console: https://console.developers.google.com/apis/api/analyticsadmin.googleapis.com/overview";
    }
    res.status(500).json({ error: message });
  }
});

app.get("/api/ga4/data", authenticate, async (req: any, res) => {
  const { propertyId, startDate, endDate } = req.query;
  if (!propertyId) return res.status(400).json({ error: "propertyId is required" });

  try {
    const client = await getClientForUser(req.user.uid, req);
    if (!client) return res.status(401).json({ error: "Not connected" });
    
    const analyticsdata = google.analyticsdata({ version: "v1beta", auth: client });
    
    const response = await analyticsdata.properties.runReport({
      property: `properties/${propertyId}`,
      requestBody: {
        dateRanges: [{ startDate: (startDate as string), endDate: (endDate as string) }],
        dimensions: [{ name: "pagePath" }, { name: "eventName" }],
        metrics: [{ name: "eventCount" }, { name: "sessions" }, { name: "engagementRate" }],
        dimensionFilter: {
          filter: {
            fieldName: "eventName",
            inListFilter: {
              values: [
                "click_cta_article",
                "click_cta_ke_produk",
                "purchase",
                "purchase_marketplace",
                "purchase_tiktok",
                "purchase_whatsapp",
                "scroll_25",
                "scroll_50",
                "scroll_75",
                "session_start",
                "page_view"
              ]
            }
          }
        }
      }
    });

    res.json(response.data.rows || []);
  } catch (error: any) {
    console.error("Error fetching GA4 data:", error);
    let message = error.message || "Failed to fetch GA4 data";
    if (message.includes("analyticsdata.googleapis.com")) {
      message = "Google Analytics Data API is not enabled. Please enable it in your Google Cloud Console: https://console.developers.google.com/apis/api/analyticsdata.googleapis.com/overview";
    }
    res.status(500).json({ error: message });
  }
});

app.post("/api/auth/logout", authenticate, async (req: any, res) => {
  try {
    await db.collection("user_tokens").doc(req.user.uid).delete();
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: "Failed to logout" });
  }
});

async function startServer() {
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    app.use(express.static(path.join(__dirname, "dist")));
    app.get("*", (req, res) => {
      res.sendFile(path.join(__dirname, "dist", "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
