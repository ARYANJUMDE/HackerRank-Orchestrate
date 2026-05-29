import fs from "fs";
import path from "path";

const CORPUS_PATH = path.resolve("data");
const OUTPUT_FILE = path.resolve("src", "corpus.json");

function getProductArea(docPath, corpusPath) {
  try {
    const rel = path.relative(path.resolve(corpusPath), path.resolve(docPath));
    const parts = rel.replace(/\\/g, "/").split("/");

    const areaMap = {
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
      "claude-for-nonprofits": "Claude for nonprofits",
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
      "api-faq": "API FAQ"
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
    // Ignore
  }
  return "General";
}

function walkDir(dir, callback) {
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

function generate() {
  console.log("Generating src/corpus.json...");
  const articles = [];
  
  walkDir(CORPUS_PATH, (filePath) => {
    try {
      const text = fs.readFileSync(filePath, "utf-8").trim();
      const relPath = path.relative(CORPUS_PATH, filePath).replace(/\\/g, "/");
      const company = relPath.split("/")[0];
      
      let title = path.basename(filePath, path.extname(filePath)).replace(/[-_]/g, " ");
      title = title.replace(/\b\w/g, c => c.toUpperCase());
      
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
      console.error("Failed to read " + filePath, err);
    }
  });

  fs.mkdirSync(path.dirname(OUTPUT_FILE), { recursive: true });
  fs.writeFileSync(OUTPUT_FILE, JSON.stringify(articles, null, 2), "utf-8");
  console.log(`Successfully generated src/corpus.json with ${articles.length} articles.`);
}

generate();
