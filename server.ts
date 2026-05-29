import express from "express";
import path from "path";
import fs from "fs";
import multer from "multer";
import { createServer as createViteServer } from "vite";
import { Retriever, processTicket, getProductArea, parseCSV } from "./src/engine.js";

const upload = multer({ limits: { fileSize: 10 * 1024 * 1024 } }); // 10MB limit

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json());

  // Define database & output CSV paths matching the python repository structure
  const CORPUS_PATH = path.resolve("data");
  const OUTPUT_CSV = path.resolve("support_tickets", "output.csv");
  const TICKETS_CSV = path.resolve("support_tickets", "support_tickets.csv");

  let retriever: Retriever | null = null;
  let docCount = 0;

  // Optimized recursive directory walking
  function walkDir(dir: string, callback: (filePath: string) => void) {
    if (!fs.existsSync(dir)) return;
    const list = fs.readdirSync(dir);
    list.forEach(file => {
      const filePath = path.join(dir, file);
      const stat = fs.statSync(filePath);
      if (stat && stat.isDirectory()) {
         walkDir(filePath, callback);
      } else {
        if (filePath.endsWith(".md") || filePath.endsWith(".txt")) {
          callback(filePath);
        }
      }
    });
  }

  // Load support corpus documents
  function loadCorpus() {
    console.log("Loading support corpus...");
    const docs: [string, string][] = [];
    walkDir(CORPUS_PATH, (filePath) => {
      try {
        const text = fs.readFileSync(filePath, "utf-8").trim();
        if (text.length > 50) {
          docs.push([text, filePath]);
        }
      } catch (err) {
        // ignore read errors
      }
    });
    
    docCount = docs.length;
    retriever = new Retriever(docs);
    console.log(`Corpus loaded successfully: ${docCount} documents indexed.`);
  }

  loadCorpus();

  // Helper: CSV output writer
  function writeCSV(filePath: string, results: any[]) {
    const headers = [
      "issue",
      "subject",
      "company",
      "response",
      "product_area",
      "status",
      "request_type",
      "justification"
    ];
    let content = headers.map(h => `"${h.replace(/"/g, '""')}"`).join(",") + "\n";
    results.forEach(item => {
      const row = [
        item.issue || "",
        item.subject || "",
        item.company || "",
        item.response || "",
        item.productArea || item.product_area || "",
        item.status || "",
        item.requestType || item.request_type || "",
        item.justification || ""
      ];
      content += row.map(v => `"${(v + "").replace(/"/g, '""')}"`).join(",") + "\n";
    });
    fs.mkdirSync(path.dirname(filePath), { recursive: true });
    fs.writeFileSync(filePath, content, "utf-8");
  }

  // 1. Health API
  app.get("/api/health", (req, res) => {
    res.json({ status: "ok", doc_count: docCount });
  });

  // 2. Results list from output.csv
  app.get("/api/results", (req, res) => {
    try {
      if (!fs.existsSync(OUTPUT_CSV)) {
        return res.json([]);
      }
      const raw = fs.readFileSync(OUTPUT_CSV, "utf-8");
      const parsed = parseCSV(raw);
      
      // format to match FE expectations
      const results = parsed.map(r => ({
        issue: r.issue || r.Issue || "",
        subject: r.subject || r.Subject || "",
        company: r.company || r.Company || "",
        response: r.response || "",
        product_area: r.product_area || r.productArea || "",
        status: r.status || "",
        request_type: r.request_type || r.requestType || "",
        justification: r.justification || ""
      }));
      
      res.json(results);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // 3. Stats from output.csv
  app.get("/api/stats", (req, res) => {
    try {
      let results: any[] = [];
      if (fs.existsSync(OUTPUT_CSV)) {
        const raw = fs.readFileSync(OUTPUT_CSV, "utf-8");
        results = parseCSV(raw).map(r => ({
          issue: r.issue || r.Issue || "",
          subject: r.subject || r.Subject || "",
          company: r.company || r.Company || "",
          response: r.response || "",
          product_area: r.product_area || r.productArea || "",
          status: r.status || "",
          request_type: r.request_type || r.requestType || "",
          justification: r.justification || ""
        }));
      }

      const total = results.length;
      const byCompany: Record<string, number> = {};
      const byStatus: Record<string, number> = { replied: 0, escalated: 0 };
      const byRequestType: Record<string, number> = {};

      results.forEach(r => {
        const comp = r.company || "Unknown";
        byCompany[comp] = (byCompany[comp] || 0) + 1;

        const stat = (r.status || "").toLowerCase();
        if (stat === "replied" || stat === "escalated") {
          byStatus[stat] = (byStatus[stat] || 0) + 1;
        } else if (stat) {
          byStatus[stat] = (byStatus[stat] || 0) + 1;
        }

        const rt = r.request_type || "unknown";
        byRequestType[rt] = (byRequestType[rt] || 0) + 1;
      });

      const escalationRate = total ? Math.round((byStatus.escalated / total) * 100 * 10) / 10 : 0;

      res.json({
        total,
        by_company: byCompany,
        by_status: byStatus,
        by_request_type: byRequestType,
        escalation_rate: escalationRate,
        doc_count: docCount
      });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // 3b. Support Knowledge Base list
  app.get("/api/kb", (req, res) => {
    try {
      const articles: any[] = [];
      walkDir(CORPUS_PATH, (filePath) => {
        try {
          const text = fs.readFileSync(filePath, "utf-8").trim();
          const relPath = path.relative(CORPUS_PATH, filePath).replace(/\\/g, "/");
          const company = relPath.split("/")[0];
          
          let title = path.basename(filePath, path.extname(filePath)).replace(/[-_]/g, " ");
          title = title.replace(/\b\w/g, c => c.toUpperCase());
          
          // Try to extract first # title
          const match = text.match(/^#\s+(.+)$/m);
          if (match && match[1]) {
            title = match[1].trim();
          }
          
          const productArea = getProductArea(filePath, CORPUS_PATH);

          articles.push({
            path: relPath,
            company: company.replace(/\b\w/g, c => c.toUpperCase()),
            productArea,
            title,
            length: text.length,
            preview: text.substring(0, 180).trim() + (text.length > 180 ? "..." : ""),
            content: text
          });
        } catch (err) {
          // ignore parsing error for individual file
        }
      });
      res.json(articles);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // 4. Single ticket processor
  app.post("/api/process/ticket", (req, res) => {
    if (!retriever) {
      return res.status(500).json({ error: "System starting up or indexing failed." });
    }
    const { issue, subject, company } = req.body;
    if (!issue && !subject) {
      return res.status(400).json({ error: "Provide at least 'issue' or 'subject'" });
    }

    const payload = {
      Issue: issue || "",
      Subject: subject || "",
      Company: company || ""
    };

    const outcome = processTicket(payload, retriever, CORPUS_PATH);
    if (!outcome) {
      return res.status(422).json({ error: "Could not process ticket" });
    }

    res.json(outcome);
  });

  // 5. CSV Processor via upload
  app.post("/api/process/csv", upload.single("file"), (req, res) => {
    if (!retriever) {
      return res.status(500).json({ error: "System starting up or indexing failed." });
    }
    if (!req.file) {
      return res.status(400).json({ error: "No file uploaded. Use form key 'file'" });
    }

    const content = req.file.buffer.toString("utf-8");
    const tickets = parseCSV(content);
    const results: any[] = [];

    tickets.forEach(ticket => {
      const outcome = processTicket(ticket, retriever!, CORPUS_PATH);
      if (outcome) {
        results.push(outcome);
      }
    });

    writeCSV(OUTPUT_CSV, results);
    res.json({ processed: results.length, results });
  });

  // 6. Reprocess standard support_tickets.csv
  app.post("/api/reprocess", (req, res) => {
    if (!retriever) {
      return res.status(500).json({ error: "System starting up or indexing failed." });
    }
    if (!fs.existsSync(TICKETS_CSV)) {
      return res.status(404).json({ error: "support_tickets.csv not found at " + TICKETS_CSV });
    }

    try {
      const content = fs.readFileSync(TICKETS_CSV, "utf-8");
      const tickets = parseCSV(content);
      const results: any[] = [];

      tickets.forEach(ticket => {
        const outcome = processTicket(ticket, retriever!, CORPUS_PATH);
        if (outcome) {
          results.push(outcome);
        }
      });

      writeCSV(OUTPUT_CSV, results);
      res.json({ processed: results.length, results });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // Vite development integration or static files rendering
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.resolve("dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server listening on http://localhost:${PORT}`);
  });
}

startServer();
