// Unified browser-safe Support Engine (no node fs/path imports)

// Translating code/config.py
export const INTENT_KEYWORDS = {
  billing: ["payment", "charged", "refund", "invoice"],
  fraud: ["fraud", "unauthorized", "hacked", "stolen"],
  account_access: ["login", "password", "account", "signin"],
  technical_issue: ["error", "bug", "not working", "issue"],
  assessment: ["test", "assessment", "submission"]
};

export const HIGH_RISK_INTENTS = ["fraud", "billing", "account_access"];
export const TOP_K = 2;

// Translating code/classifier/intent.py
export function classifyIntent(query: string): string {
  const q = query.toLowerCase();

  if ([
    "fraud", "unauthorized", "identity theft", "identity has been stolen",
    "scam", "phishing", "account takeover"
  ].some(w => q.includes(w))) {
    return "fraud";
  }

  if ([
    "security vulnerability", "vulnerability", "bug bounty", "security flaw",
    "security issue", "exploit", "injection", "xss", "sql injection",
    "zero day", "cve", "responsible disclosure"
  ].some(w => q.includes(w))) {
    return "security";
  }

  if ([
    "payment", "charged", "refund", "invoice", "billing",
    "cheque", "dispute", "money", "cash", "transaction",
    "subscription", "plan", "pricing", "cost", "fee"
  ].some(w => q.includes(w))) {
    return "billing";
  }

  if ([
    "login", "password", "delete my account", "sign in",
    "access lost", "locked out", "forgot password", "reset password",
    "account deleted", "remove my account"
  ].some(w => q.includes(w))) {
    return "account_access";
  }

  if ([
    "hacked", "stolen", "compromised"
  ].some(w => q.includes(w))) {
    return "fraud";
  }

  if ([
    "site is down", "pages are accessible", "not accessible",
    "system down", "down completely", "is down",
    "stopped working", "completely", "none of the", "all requests"
  ].some(w => q.includes(w))) {
    return "outage";
  }

  if ([
    "card blocked", "bloquée", "bloqueada", "blocked",
    "been blocked"
  ].some(w => q.includes(w))) {
    return "card_blocked";
  }

  if ([
    "error", "not working", "not responding",
    "broken", "crash", "failed", "failing", "can't access",
    "cannot access", "unable to", "cannot", "blocker",
    "issue", "problem", "doesn't work", "won't work"
  ].some(w => q.includes(w))) {
    return "bug";
  }

  if ([
    "test", "assessment", "submission", "candidate", "invite",
    "reinvite", "recruiter", "score", "variant", "resume builder",
    "certificate", "mock interview", "resume"
  ].some(w => q.includes(w))) {
    return "assessment";
  }

  if ([
    "would like to", "can you add", "suggestion", "improvement",
    "please add", "feature request", "request a feature", "wish",
    "could you", "it would be nice"
  ].some(w => q.includes(w))) {
    return "feature_request";
  }

  if ([
    "crawl", "scrape", "data collection", "training data",
    "opt out", "data use", "privacy", "gdpr", "data retention"
  ].some(w => q.includes(w))) {
    return "privacy";
  }

  if ([
    "remove", "delete", "disable", "pause", "cancel",
    "add user", "remove user", "employee", "seat", "workspace",
    "account management", "admin"
  ].some(w => q.includes(w))) {
    return "account_management";
  }

  return "general";
}

export function getRequestType(intent: string, query: string, company: string = ""): string {
  const q = query.toLowerCase().trim();
  const knownProducts = ["hackerrank", "claude", "visa"];

  const productWords = [
    "visa", "card", "transaction", "payment", "cheque", "atm", "merchant",
    "dispute", "charge", "cash", "travel",
    "hackerrank", "assessment", "test", "submission", "candidate", "recruiter",
    "invite", "reinvite", "certificate", "mock interview", "resume", "screen",
    "claude", "api", "anthropic", "conversation", "chat", "workspace", "team plan",
    "account", "login", "password", "billing", "refund", "invoice", "fraud",
    "unauthorized", "hacked", "stolen", "error", "bug", "not working",
    "stopped working", "not responding", "is down", "site is down",
    "access", "delete", "report", "review", "mock", "interview",
    "extra time", "score", "variant", "role", "community", "private",
    "security", "vulnerability", "data", "crawl", "identity", "blocker",
    "compatible", "subscription", "employee", "user", "project",
    "inactivity", "lobby", "timeout", "session", "platform"
  ];

  if (knownProducts.includes(company.toLowerCase())) {
    if (intent === "outage") return "bug";
    if (intent === "bug") return "bug";
    if (intent === "feature_request") return "feature_request";
    return "product_issue";
  }

  if (!productWords.some(w => q.includes(w))) {
    return "invalid";
  }

  if (intent === "outage" || intent === "bug") {
    return "bug";
  }
  if (intent === "feature_request") {
    return "feature_request";
  }

  return "product_issue";
}

// Translating code/classifier/product.py
export function classifyProduct(query: string): string {
  const q = query.toLowerCase();

  if (["visa", "card", "transaction", "cheque", "atm", "merchant"].some(k => q.includes(k))) {
    return "Visa";
  }
  if (["hackerrank", "assessment", "test", "submission", "candidate", "recruiter", "invite", "reinvite", "mock interview", "screen"].some(k => q.includes(k))) {
    return "HackerRank";
  }
  if (["claude", "api", "anthropic", "conversation", "claude.ai", "workspace", "team plan", "enterprise"].some(k => q.includes(k))) {
    return "Claude";
  }

  return "None";
}

// Translating code/safety/escalation.py
const ALWAYS_ESCALATE_INTENTS = ["fraud", "security"];
const ESCALATE_NO_DOCS_INTENTS = ["outage", "billing", "account_access", "account_management"];
const FINANCIAL_ESCALATE_INTENTS = ["billing", "card_blocked"];
const FINANCIAL_PRODUCTS = ["visa"];

export function shouldEscalate(intent: string, retrievedDocs: any[], requestType: string, company: string = ""): boolean {
  if (requestType === "invalid") {
    return false;
  }

  if (ALWAYS_ESCALATE_INTENTS.includes(intent)) {
    return true;
  }

  if (FINANCIAL_ESCALATE_INTENTS.includes(intent) && FINANCIAL_PRODUCTS.includes(company.toLowerCase())) {
    return true;
  }

  if (intent === "outage") {
    return true;
  }

  if (ESCALATE_NO_DOCS_INTENTS.includes(intent) && retrievedDocs.length === 0) {
    return true;
  }

  if (intent === "privacy" && retrievedDocs.length === 0) {
    return true;
  }

  if (retrievedDocs.length === 0) {
    return true;
  }

  return false;
}

// Translating code/retrieval/retriever.py using Node.js TypeScript TF-IDF Vectorizer
export interface Document {
  text: string;
  path: string;
}

export class Retriever {
  private docs: Document[];
  private vocabulary: string[] = [];
  private vocabMap: Map<string, number> = new Map();
  private docVectors: number[][] = [];
  private idfs: number[] = [];

  constructor(documents: [string, string][]) {
    this.docs = documents.map(([text, path]) => ({ text, path }));
    this.buildTFIDF();
  }

  private tokenize(text: string): string[] {
    // splits into lowercase terms of length >= 2 containing word characters
    return (text.toLowerCase().match(/\b\w\w+\b/g) || []);
  }

  private buildTFIDF() {
    const N = this.docs.length;
    if (N === 0) return;

    // Build vocabulary and Document Frequencies
    const dfMap: Map<string, number> = new Map();
    const docTokensList = this.docs.map(doc => {
      const tokens = this.tokenize(doc.text);
      const uniqueTokens = new Set(tokens);
      uniqueTokens.forEach(t => {
        dfMap.set(t, (dfMap.get(t) || 0) + 1);
      });
      return tokens;
    });

    // Setup vocab maps
    const vocabSet = new Set(dfMap.keys());
    this.vocabulary = Array.from(vocabSet);
    this.vocabulary.forEach((word, index) => {
      this.vocabMap.set(word, index);
    });

    // Calculate Smooth IDFs (same structure as scikit-learn smooth_idf=True)
    // idf(t) = log((1 + N) / (1 + df(t))) + 1
    const M = this.vocabulary.length;
    this.idfs = new Array(M);
    for (let i = 0; i < M; i++) {
      const word = this.vocabulary[i];
      const df = dfMap.get(word) || 0;
      this.idfs[i] = Math.log((1 + N) / (1 + df)) + 1;
    }

    // Compute document vectors
    this.docVectors = docTokensList.map((tokens, docIdx) => {
      const tf: Map<string, number> = new Map();
      tokens.forEach(t => {
        tf.set(t, (tf.get(t) || 0) + 1);
      });

      const vec = new Array(M).fill(0);
      tf.forEach((count, token) => {
        const id = this.vocabMap.get(token);
        if (id !== undefined) {
          // tf-idf = tf * idf (scikit-learn defaults to simple term counts for TF by default or log/boolean depending on config, TfidfVectorizer is tf(tc)*idf)
          vec[id] = count * this.idfs[id];
        }
      });

      // L2 Normalize document vector so dot product equals cosine similarity
      return this.l2Normalize(vec);
    });
  }

  private l2Normalize(vec: number[]): number[] {
    const norm = Math.sqrt(vec.reduce((sum, val) => sum + val * val, 0));
    if (norm === 0) return vec.fill(0);
    return vec.map(val => val / norm);
  }

  public search(query: string, topK: number = 2): Document[] {
    if (this.docs.length === 0 || this.vocabulary.length === 0) {
      return [];
    }

    const qTokens = this.tokenize(query);
    const qTf: Map<string, number> = new Map();
    qTokens.forEach(t => {
      qTf.set(t, (qTf.get(t) || 0) + 1);
    });

    const qVec = new Array(this.vocabulary.length).fill(0);
    qTf.forEach((count, token) => {
      const id = this.vocabMap.get(token);
      if (id !== undefined) {
        qVec[id] = count * this.idfs[id];
      }
    });

    const l2QVec = this.l2Normalize(qVec);

    // Compute cosine similarity (dot product since normalized)
    const scoredDocs = this.docVectors.map((docVec, docIdx) => {
      let score = 0;
      for (let i = 0; i < docVec.length; i++) {
        if (l2QVec[i] > 0 && docVec[i] > 0) {
          score += l2QVec[i] * docVec[i];
        }
      }
      return { doc: this.docs[docIdx], score };
    });

    // filter score > 0.01 and sort descending
    const filtered = scoredDocs
      .filter(x => x.score > 0.01)
      .sort((a, b) => b.score - a.score);

    return filtered.slice(0, topK).map(x => x.doc);
  }
}

// Translating code/generator/response.py
const ESCALATION_MESSAGES: Record<string, string> = {
  fraud: "This issue has been flagged as a potential fraud or security concern and has been escalated to our specialist team. Please do not share any sensitive information. A member of our team will contact you shortly.",
  security: "Thank you for reporting this security concern. This has been escalated to our security team for immediate review. We take all security reports seriously and will follow up with you directly.",
  outage: "We have detected a potential service disruption. This issue has been escalated to our engineering team for urgent investigation. Please check our status page for live updates.",
  billing: "Your billing concern has been escalated to our finance team who will review your account and contact you directly.",
  card_blocked: "Your card issue has been escalated to our card services team. For urgent assistance, please contact your card issuer directly.",
  account_access: "Your account access issue has been escalated to our account security team. We will review your case and respond within 24 hours.",
};

const DEFAULT_ESCALATION = "This issue has been escalated to our support team. A specialist will review your case and respond shortly.";

export function extractBody(text: string): string {
  const lines = text.split("\n");
  let frontmatterDone = false;
  let fenceCount = 0;
  const bodyLines: string[] = [];

  for (const line of lines) {
    const stripped = line.trim();

    if (!frontmatterDone) {
      if (stripped === "---") {
        fenceCount++;
        if (fenceCount >= 2) {
          frontmatterDone = true;
        }
        continue;
      } else if (fenceCount === 0 && stripped) {
        frontmatterDone = true;
      } else {
        continue;
      }
    }

    if (stripped.startsWith("#")) {
      continue;
    }

    if (stripped.startsWith("_Last updated") || stripped.startsWith("_Last modified")) {
      continue;
    }

    if (stripped.toLowerCase().startsWith("## related") || stripped.toLowerCase() === "related articles") {
      break;
    }

    if (stripped.startsWith("![")) {
      continue;
    }

    if (stripped === "\\") {
      continue;
    }

    bodyLines.push(line);
  }

  let body = bodyLines.join("\n").trim();
  body = body.replace(/!\[.*?\]\(.*?\)/g, '');
  body = body.replace(/\n{3,}/g, '\n\n');

  return body.trim();
}

export function cleanResponse(text: string, maxChars: number = 1200): string {
  const lines = text.split("\n");
  const cleaned: string[] = [];

  for (const line of lines) {
    let stripped = line.trim();

    if (!stripped) {
      if (cleaned.length > 0 && cleaned[cleaned.length - 1] !== "") {
        cleaned.push("");
      }
      continue;
    }

    stripped = stripped.replace(/\*\*(.*?)\*\*/g, '$1');
    stripped = stripped.replace(/\*(.*?)\*/g, '$1');
    stripped = stripped.replace(/`(.*?)`/g, '$1');

    if (stripped.startsWith("- ") || stripped.startsWith("* ")) {
      stripped = "• " + stripped.substring(2);
    }

    cleaned.push(stripped);
  }

  let result = cleaned.join("\n").trim();
  result = result.replace(/\n{3,}/g, '\n\n');

  if (result.length > maxChars) {
    const truncated = result.substring(0, maxChars);
    const lastPeriod = truncated.lastIndexOf('.');
    if (lastPeriod > maxChars * 0.6) {
      result = truncated.substring(0, lastPeriod + 1);
    } else {
      result = truncated.trim() + "...";
    }
  }

  return result;
}

export function generateResponse(query: string, docs: Document[], escalate: boolean, requestType: string = "product_issue", intent: string = "general"): string {
  if (escalate) {
    return ESCALATION_MESSAGES[intent] || DEFAULT_ESCALATION;
  }

  if (requestType === "invalid") {
    const q = query.toLowerCase().trim();
    const greetings = ["thank", "thanks", "hi", "hello", "bye", "good morning",
                     "good afternoon", "good evening", "great", "awesome", "perfect"];
    if (greetings.some(w => q.startsWith(w) || q === w) && q.split(/\s+/).length < 8) {
      return "Happy to help! Is there anything else I can assist you with?";
    }
    return "I'm sorry, but this request falls outside the scope of our support services. If you have questions about HackerRank, Claude, or Visa, we'd be happy to help.";
  }

  if (docs.length === 0) {
    return "We couldn't find specific documentation for your query. Please contact our support team directly for further assistance.";
  }

  const body = extractBody(docs[0].text);
  if (!body || body.length < 20) {
    return "We couldn't find specific documentation for your query. Please contact our support team directly for further assistance.";
  }

  return cleanResponse(body);
}

// Full Process Logic replicating main.py process_ticket
export function getProductArea(docPath: string, corpusPath: string = "data"): string {
  try {
    let rel = docPath.replace(/\\/g, "/");
    const normalizedCorpus = corpusPath.replace(/\\/g, "/");
    if (rel.includes(normalizedCorpus)) {
      const idx = rel.indexOf(normalizedCorpus);
      rel = rel.substring(idx + normalizedCorpus.length);
    }
    if (rel.startsWith("/")) {
      rel = rel.substring(1);
    }
    const parts = rel.split("/");

    const areaMap: Record<string, string> = {
      "screen": "Assessments & Screening",
      "hackerrank_community": "Community",
      "general-help": "General Help",
      "engage": "Engage",
      "chakra": "Chakra",
      "settings": "Settings",
      "integrations": "Integrations",
      "skillup": "SkillUp",
      "interviews": "Interviews",
      "library": "Library",
      "uncategorized": "General",
      "amazon-bedrock": "Amazon Bedrock",
      "claude-api-and-console": "Claude API & Console",
      "claude-code": "Claude Code",
      "claude-desktop": "Claude Desktop",
      "claude-for-education": "Claude for Education",
      "claude-for-government": "Claude for Government",
      "claude-for-nonprofits": "Claude for Nonprofits",
      "claude-in-chrome": "Claude in Chrome",
      "claude-mobile-apps": "Claude Mobile",
      "connectors": "Connectors",
      "identity-management-sso-jit-scim": "Identity & SSO",
      "privacy-and-legal": "Privacy & Legal",
      "pro-and-max-plans": "Pro & Max Plans",
      "safeguards": "Safeguards",
      "team-and-enterprise-plans": "Team & Enterprise",
      "travel-support": "Travel Support",
      "small-business": "Small Business",
      "consumer": "Consumer Support",
      "support": "General Support",
      "conversation-management": "Conversation Management",
      "account-management": "Account Management",
      "features-and-capabilities": "Features",
      "get-started-with-claude": "Getting Started",
      "personalization-and-settings": "Personalization",
      "troubleshooting": "Troubleshooting",
      "usage-and-limits": "Usage & Limits",
      "pricing-and-billing": "Billing",
      "api-faq": "API FAQ",
    };

    for (let i = parts.length - 2; i >= 0; i--) {
      const part = parts[i];
      if (areaMap[part]) {
        return areaMap[part];
      }
    }

    if (parts.length >= 2) {
      const p = parts[1];
      return p.replace(/-/g, " ").replace(/_/g, " ").replace(/\b\w/g, c => c.toUpperCase());
    }
  } catch (err) {
    // Ignore error
  }
  return "General";
}

export function processTicket(item: { Issue: string; Subject: string; Company: string }, retriever: Retriever, corpusPath: string = "data") {
  const issue = (item.Issue || "").trim();
  const subject = (item.Subject || "").trim();
  const query = `${subject} ${issue}`.trim();

  if (!query) {
    return null;
  }

  const intent = classifyIntent(query);

  let company = (item.Company || "").trim();
  if (!company || company.toLowerCase() === "none" || company.toLowerCase() === "unknown") {
    company = classifyProduct(query);
  }
  company = company.trim();

  const requestType = getRequestType(intent, query, company);
  const docs = retriever.search(query, TOP_K);
  const escalate = shouldEscalate(intent, docs, requestType, company);
  const status = escalate ? "escalated" : "replied";
  const response = generateResponse(query, docs, escalate, requestType, intent);

  const productArea = docs.length > 0 ? getProductArea(docs[0].path, corpusPath) : "General";

  const justification = `intent=${intent}; company=${company}; request_type=${requestType}; docs_found=${docs.length}; escalated=${escalate}`;

  return {
    issue,
    subject,
    company,
    response,
    productArea,
    status,
    requestType,
    justification,
    intent,
    docsFound: docs.length
  };
}

// Shareable robust CSV parser designed to handle embedded newlines in double-quoted fields
export function parseCSV(content: string): any[] {
  const results: string[][] = [];
  let row: string[] = [];
  let currentField = "";
  let inQuotes = false;

  for (let i = 0; i < content.length; i++) {
    const char = content[i];
    const nextChar = content[i + 1];

    if (char === '"') {
      if (inQuotes && nextChar === '"') {
        currentField += '"';
        i++; // skip escaped quote character
      } else {
        inQuotes = !inQuotes;
      }
    } else if (char === ',' && !inQuotes) {
      row.push(currentField);
      currentField = "";
    } else if ((char === '\n' || char === '\r') && !inQuotes) {
      if (char === '\r' && nextChar === '\n') {
        i++; // Skip LF in CRLF pair
      }
      row.push(currentField);
      currentField = "";
      
      // Only push rows that have some content
      if (row.length > 0 && row.some(cell => cell.trim() !== "")) {
        results.push(row);
      }
      row = [];
    } else {
      currentField += char;
    }
  }

  if (currentField !== "" || row.length > 0) {
    row.push(currentField);
    if (row.some(cell => cell.trim() !== "")) {
      results.push(row);
    }
  }

  if (results.length === 0) return [];

  const headers = results[0].map(h => h.trim().toLowerCase());
  const parsedRows: any[] = [];

  for (let i = 1; i < results.length; i++) {
    const values = results[i];
    const obj: any = {};
    
    headers.forEach((h, idx) => {
      const val = values[idx] || "";
      if (h === "issue") obj.Issue = val;
      else if (h === "subject") obj.Subject = val;
      else if (h === "company") obj.Company = val;
      else obj[h] = val;
    });
    
    parsedRows.push(obj);
  }

  return parsedRows;
}

