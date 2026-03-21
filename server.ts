import express from "express";
import { createServer as createViteServer } from "vite";
import { google } from "googleapis";
import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = 3000;

// In-memory store for demo purposes. In a real app, use a database.
// We'll store tokens in a simple session-like object for the current user.
let userTokens: any = null;

const appUrl = process.env.APP_URL?.replace(/\/$/, "");

app.use(express.json());

const getRedirectUri = (req: any) => {
  const appUrl = process.env.APP_URL?.replace(/\/$/, "");
  if (appUrl) return `${appUrl}/auth/callback`;
  
  // Fallback to current host if APP_URL is missing
  const protocol = req.protocol === 'https' || req.headers['x-forwarded-proto'] === 'https' ? 'https' : 'http';
  return `${protocol}://${req.get('host')}/auth/callback`;
};

// Auth URL endpoint
app.get("/api/auth/url", (req, res) => {
  if (!process.env.GOOGLE_CLIENT_ID || !process.env.GOOGLE_CLIENT_SECRET) {
    return res.status(500).json({ error: "Google Client ID or Secret missing" });
  }

  const oauth2Client = new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    getRedirectUri(req)
  );

  const scopes = [
    "https://www.googleapis.com/auth/webmasters.readonly",
    "https://www.googleapis.com/auth/analytics.readonly",
    "https://www.googleapis.com/auth/userinfo.profile",
  ];

  const url = oauth2Client.generateAuthUrl({
    access_type: "offline",
    scope: scopes,
    prompt: "consent",
  });

  res.json({ url });
});

// OAuth Callback
app.get("/auth/callback", async (req, res) => {
  const { code } = req.query;
  try {
    const oauth2Client = new google.auth.OAuth2(
      process.env.GOOGLE_CLIENT_ID,
      process.env.GOOGLE_CLIENT_SECRET,
      getRedirectUri(req)
    );

    const { tokens } = await oauth2Client.getToken(code as string);
    userTokens = tokens;
    
    res.send(`
      <html>
        <body>
          <script>
            if (window.opener) {
              window.opener.postMessage({ type: 'OAUTH_AUTH_SUCCESS' }, '*');
              window.close();
            } else {
              window.location.href = '/';
            }
          </script>
          <p>Authentication successful. This window should close automatically.</p>
        </body>
      </html>
    `);
  } catch (error) {
    console.error("Error exchanging code for tokens:", error);
    res.status(500).send("Authentication failed");
  }
});

app.get("/api/auth/status", (req, res) => {
  const isConfigured = !!(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET && process.env.APP_URL);
  res.json({ 
    connected: !!userTokens,
    configured: isConfigured
  });
});

app.post("/api/auth/logout", (req, res) => {
  userTokens = null;
  res.json({ success: true });
});

// GSC Data Endpoints
app.get("/api/gsc/sites", async (req, res) => {
  if (!userTokens) return res.status(401).json({ error: "Not connected" });
  
  try {
    const oauth2Client = new google.auth.OAuth2(
      process.env.GOOGLE_CLIENT_ID,
      process.env.GOOGLE_CLIENT_SECRET,
      getRedirectUri(req)
    );
    oauth2Client.setCredentials(userTokens);
    const searchconsole = google.searchconsole({ version: "v1", auth: oauth2Client });
    const response = await searchconsole.sites.list();
    res.json(response.data.siteEntry || []);
  } catch (error) {
    console.error("Error fetching sites:", error);
    res.status(500).json({ error: "Failed to fetch sites" });
  }
});

app.get("/api/gsc/data", async (req, res) => {
  if (!userTokens) return res.status(401).json({ error: "Not connected" });
  
  const { siteUrl, startDate, endDate } = req.query;
  if (!siteUrl) return res.status(400).json({ error: "siteUrl is required" });

  try {
    const oauth2Client = new google.auth.OAuth2(
      process.env.GOOGLE_CLIENT_ID,
      process.env.GOOGLE_CLIENT_SECRET,
      getRedirectUri(req)
    );
    oauth2Client.setCredentials(userTokens);
    const searchconsole = google.searchconsole({ version: "v1", auth: oauth2Client });
    
    // 1. Fetch site-level summary (no dimensions) to get TRUE totals
    const summaryResponse = await searchconsole.searchanalytics.query({
      siteUrl: siteUrl as string,
      requestBody: {
        startDate: (startDate as string),
        endDate: (endDate as string),
      },
    });

    // 2. Fetch daily time series for the chart
    const timeSeriesResponse = await searchconsole.searchanalytics.query({
      siteUrl: siteUrl as string,
      requestBody: {
        startDate: (startDate as string),
        endDate: (endDate as string),
        dimensions: ["date"],
      },
    });

    // 3. Fetch detailed rows (query/page) for the table
    const detailsResponse = await searchconsole.searchanalytics.query({
      siteUrl: siteUrl as string,
      requestBody: {
        startDate: (startDate as string),
        endDate: (endDate as string),
        dimensions: ["query", "page", "device", "country"],
        rowLimit: 1000,
      },
    });

    res.json({
      summary: summaryResponse.data.rows?.[0] || { clicks: 0, impressions: 0, ctr: 0, position: 0 },
      timeSeries: timeSeriesResponse.data.rows || [],
      rows: detailsResponse.data.rows || [],
    });
  } catch (error: any) {
    console.error("Error fetching GSC data:", error);
    const message = error.response?.data?.error?.message || error.message || "Failed to fetch GSC data";
    res.status(500).json({ error: message });
  }
});

// GA4 Data Endpoints
app.get("/api/ga4/properties", async (req, res) => {
  if (!userTokens) return res.status(401).json({ error: "Not connected" });
  
  try {
    const oauth2Client = new google.auth.OAuth2(
      process.env.GOOGLE_CLIENT_ID,
      process.env.GOOGLE_CLIENT_SECRET,
      getRedirectUri(req)
    );
    oauth2Client.setCredentials(userTokens);
    
    const analyticsadmin = google.analyticsadmin({ version: "v1beta", auth: oauth2Client });
    
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

app.get("/api/ga4/data", async (req, res) => {
  if (!userTokens) return res.status(401).json({ error: "Not connected" });
  
  const { propertyId, startDate, endDate } = req.query;
  if (!propertyId) return res.status(400).json({ error: "propertyId is required" });

  try {
    const oauth2Client = new google.auth.OAuth2(
      process.env.GOOGLE_CLIENT_ID,
      process.env.GOOGLE_CLIENT_SECRET,
      getRedirectUri(req)
    );
    oauth2Client.setCredentials(userTokens);
    
    const analyticsdata = google.analyticsdata({ version: "v1beta", auth: oauth2Client });
    
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
