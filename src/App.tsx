import React, { useState, useEffect, useRef } from "react";
import { 
  motion, 
  AnimatePresence 
} from "motion/react";
import { 
  Cpu, 
  FileText, 
  AlertTriangle, 
  CheckCircle, 
  Send, 
  RefreshCw, 
  Search, 
  Upload, 
  Terminal, 
  Bot, 
  Sparkles, 
  BookOpen, 
  BarChart2, 
  Layers, 
  ExternalLink,
  ChevronRight,
  Info
} from "lucide-react";
import { TICKET_SAMPLES, TicketSample } from "./samples.js";
import KnowledgeBase from "./components/KnowledgeBase.js";
import corpusData from "./corpus.json";
import { Retriever, processTicket, parseCSV } from "./engine.js";
// @ts-ignore
import rawTicketsCSV from "../support_tickets/support_tickets.csv?raw";

interface TicketResult {
  issue: string;
  subject: string;
  company: string;
  response: string;
  product_area: string;
  status: string;
  request_type: string;
  justification: string;
}

interface Stats {
  total: number;
  by_company: Record<string, number>;
  by_status: { replied: number; escalated: number };
  by_request_type: Record<string, number>;
  escalation_rate: number;
  doc_count: number;
}

export default function App() {
  // Playground State
  const [subject, setSubject] = useState("");
  const [issue, setIssue] = useState("");
  const [company, setCompany] = useState("");
  const [isProcessing, setIsProcessing] = useState(false);
  const [orchestrationResult, setOrchestrationResult] = useState<any | null>(null);

  // System State & Dataset Metrics
  const [stats, setStats] = useState<Stats>({
    total: 0,
    by_company: {},
    by_status: { replied: 0, escalated: 0 },
    by_request_type: {},
    escalation_rate: 0,
    doc_count: 0
  });
  const [results, setResults] = useState<TicketResult[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [companyFilter, setCompanyFilter] = useState("ALL");
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [isReprocessing, setIsReprocessing] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [activeTab, setActiveTab] = useState<"ledger" | "kb" | "analytics">("ledger");

  // Detailed Modal/Detail view on a single-screen layout
  const [selectedTicket, setSelectedTicket] = useState<TicketResult | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Standalone/Offline Fallback State
  const [isClientOnlyMode, setIsClientOnlyMode] = useState(false);
  const [fallbackRetriever, setFallbackRetriever] = useState<Retriever | null>(null);

  // Setup Browser-side core engine on load
  useEffect(() => {
    try {
      const docPairs: [string, string][] = corpusData.map((art: any) => [art.content, art.path]);
      const retriever = new Retriever(docPairs);
      setFallbackRetriever(retriever);
    } catch (e) {
      console.error("Failed to initialize client-side fallback retriever:", e);
    }
  }, []);

  // Process sample dataset client-side in browser
  const processCSVClientSide = (retrieverInstance: Retriever) => {
    if (!retrieverInstance) return;
    try {
      const tickets = parseCSV(rawTicketsCSV);
      const resultsArray: TicketResult[] = [];
      
      tickets.forEach(ticket => {
        const payload = {
          Issue: ticket.Issue || ticket.issue || "",
          Subject: ticket.Subject || ticket.subject || "",
          Company: ticket.Company || ticket.company || ""
        };
        const outcome = processTicket(payload, retrieverInstance, "data");
        if (outcome) {
          resultsArray.push({
            issue: outcome.issue,
            subject: outcome.subject,
            company: outcome.company,
            response: outcome.response,
            product_area: outcome.productArea,
            status: outcome.status,
            request_type: outcome.requestType,
            justification: outcome.justification
          });
        }
      });
      
      setResults(resultsArray);
      
      const total = resultsArray.length;
      const byCompany: Record<string, number> = {};
      const byStatus = { replied: 0, escalated: 0 };
      const byRequestType: Record<string, number> = {};

      resultsArray.forEach(r => {
        const comp = r.company || "Unknown";
        byCompany[comp] = (byCompany[comp] || 0) + 1;
        const stat = (r.status || "").toLowerCase() as "replied" | "escalated";
        if (stat === "replied" || stat === "escalated") {
          byStatus[stat] = (byStatus[stat] || 0) + 1;
        }
        const rt = r.request_type || "unknown";
        byRequestType[rt] = (byRequestType[rt] || 0) + 1;
      });

      setStats({
        total,
        by_company: byCompany,
        by_status: byStatus,
        by_request_type: byRequestType,
        escalation_rate: total ? Math.round((byStatus.escalated / total) * 100 * 10) / 10 : 0,
        doc_count: corpusData.length
      });
    } catch (e) {
      console.error("Error executing browser-side RAG pipelines:", e);
    }
  };

  // Clean initial state, waiting for explicit user interaction/upload or sample processing
  useEffect(() => {
    // Left purposefully empty to prevent unsolicited auto-population on load, as per user request to ask first
  }, [isClientOnlyMode, fallbackRetriever]);

  // Initial Data Fetching from server with offline automatic fallback
  const fetchAllData = async () => {
    try {
      const [resStats, resResults] = await Promise.all([
        fetch("/api/stats").then(r => {
          if (!r.ok) throw new Error("Offline");
          return r.json();
        }),
        fetch("/api/results").then(r => {
          if (!r.ok) throw new Error("Offline");
          return r.json();
        })
      ]);
      setStats(resStats);
      setResults(resResults);
      setIsClientOnlyMode(false);
    } catch (err) {
      console.warn("Backend API offline (Static build / Vercel detected). Activating high-performance browser-side triage fallback.");
      setIsClientOnlyMode(true);
    }
  };

  useEffect(() => {
    fetchAllData();
  }, []);

  // Quick select a draft template in playground
  const handleSelectSample = (sample: TicketSample) => {
    setSubject(sample.subject);
    setIssue(sample.issue);
    setCompany(sample.company === "None" ? "" : sample.company);
    setOrchestrationResult(null);
  };

  // Submit single custom ticket
  const handleProcessTicket = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!subject && !issue) return;

    setIsProcessing(true);
    setOrchestrationResult(null);

    // Browser-side fallback logic
    if (isClientOnlyMode && fallbackRetriever) {
      setTimeout(() => {
        try {
          const outcome = processTicket({ Issue: issue, Subject: subject, Company: company }, fallbackRetriever, "data");
          if (!outcome) throw new Error("Triage failed");
          
          const resultItem = {
            issue: outcome.issue,
            subject: outcome.subject,
            company: outcome.company,
            response: outcome.response,
            product_area: outcome.productArea,
            status: outcome.status,
            request_type: outcome.requestType,
            justification: outcome.justification
          };
          
          setOrchestrationResult(outcome);
          
          setResults(prev => {
            const updated = [resultItem, ...prev];
            const total = updated.length;
            const byCompany: Record<string, number> = {};
            const byStatus = { replied: 0, escalated: 0 };
            const byRequestType: Record<string, number> = {};

            updated.forEach(r => {
              const comp = r.company || "Unknown";
              byCompany[comp] = (byCompany[comp] || 0) + 1;
              const stat = (r.status || "").toLowerCase() as "replied" | "escalated";
              if (stat === "replied" || stat === "escalated") {
                byStatus[stat] = (byStatus[stat] || 0) + 1;
              }
              const rt = r.request_type || "unknown";
              byRequestType[rt] = (byRequestType[rt] || 0) + 1;
            });

            setStats({
              total,
              by_company: byCompany,
              by_status: byStatus,
              by_request_type: byRequestType,
              escalation_rate: total ? Math.round((byStatus.escalated / total) * 100 * 10) / 10 : 0,
              doc_count: corpusData.length
            });

            return updated;
          });
        } catch (err) {
          console.error(err);
          alert("Error processing ticket client-side.");
        } finally {
          setIsProcessing(false);
        }
      }, 350);
      return;
    }

    // Normal backend processing
    try {
      const res = await fetch("/api/process/ticket", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ subject, issue, company })
      });

      if (!res.ok) {
        throw new Error("Triage failed");
      }

      const outcome = await res.json();
      setOrchestrationResult(outcome);
      fetchAllData();
    } catch (err) {
      console.error(err);
      alert("Error triaging standard request. Please verify the backend is listening.");
    } finally {
      setIsProcessing(false);
    }
  };

  // Reprocess CSV
  const handleReprocess = async () => {
    if (isReprocessing) return;
    setIsReprocessing(true);

    if (isClientOnlyMode && fallbackRetriever) {
      setTimeout(() => {
        processCSVClientSide(fallbackRetriever);
        setIsReprocessing(false);
        
        const container = document.getElementById("root");
        if (container) {
          const alertDiv = document.createElement("div");
          alertDiv.className = "fixed bottom-5 right-5 z-[100] bg-cyan-400 text-neutral-950 px-4 py-2.5 rounded-lg text-xs font-bold shadow-2xl flex items-center gap-2 border border-cyan-400/30 animate-bounce";
          alertDiv.innerHTML = "<span>⚙️ Client Pipeline Executed Successfully!</span>";
          container.appendChild(alertDiv);
          setTimeout(() => alertDiv.remove(), 2500);
        }
      }, 600);
      return;
    }

    try {
      const res = await fetch("/api/reprocess", { method: "POST" });
      if (!res.ok) throw new Error("Reprocess output failed");
      await fetchAllData();
    } catch (err) {
      console.error(err);
      alert("Failed to run pipeline. Make sure support_tickets.csv exists.");
    } finally {
      setIsReprocessing(false);
    }
  };

  // Upload custom CSV file
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsUploading(true);

    if (isClientOnlyMode && fallbackRetriever) {
      const reader = new FileReader();
      reader.onload = (event) => {
        try {
          const content = event.target?.result as string;
          const tickets = parseCSV(content);
          const resultsArray: TicketResult[] = [];
          
          tickets.forEach(ticket => {
            const payload = {
              Issue: ticket.Issue || ticket.issue || "",
              Subject: ticket.Subject || ticket.subject || "",
              Company: ticket.Company || ticket.company || ""
            };
            const outcome = processTicket(payload, fallbackRetriever, "data");
            if (outcome) {
              resultsArray.push({
                issue: outcome.issue,
                subject: outcome.subject,
                company: outcome.company,
                response: outcome.response,
                product_area: outcome.productArea,
                status: outcome.status,
                request_type: outcome.requestType,
                justification: outcome.justification
              });
            }
          });

          setResults(resultsArray);
          
          const total = resultsArray.length;
          const byCompany: Record<string, number> = {};
          const byStatus = { replied: 0, escalated: 0 };
          const byRequestType: Record<string, number> = {};

          resultsArray.forEach(r => {
            const comp = r.company || "Unknown";
            byCompany[comp] = (byCompany[comp] || 0) + 1;
            const stat = (r.status || "").toLowerCase() as "replied" | "escalated";
            if (stat === "replied" || stat === "escalated") {
              byStatus[stat] = (byStatus[stat] || 0) + 1;
            }
            const rt = r.request_type || "unknown";
            byRequestType[rt] = (byRequestType[rt] || 0) + 1;
          });

          setStats({
            total,
            by_company: byCompany,
            by_status: byStatus,
            by_request_type: byRequestType,
            escalation_rate: total ? Math.round((byStatus.escalated / total) * 100 * 10) / 10 : 0,
            doc_count: corpusData.length
          });

          alert(`Successfully parsed file using browser engine: ${resultsArray.length} tickets categorized.`);
        } catch (err) {
          console.error(err);
          alert("Failed to parse CSV file on browser side.");
        } finally {
          setIsUploading(false);
          if (fileInputRef.current) fileInputRef.current.value = "";
        }
      };
      reader.readAsText(file);
      return;
    }

    const formData = new FormData();
    formData.append("file", file);

    try {
      const res = await fetch("/api/process/csv", {
        method: "POST",
        body: formData
      });
      if (!res.ok) throw new Error("Uploading failed");
      const data = await res.json();
      alert(`Successfully processed file: ${data.processed} tickets categorized.`);
      await fetchAllData();
    } catch (err) {
      console.error(err);
      alert("Failed to upload and process custom dataset. Ensure it's a valid CSV layout.");
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  // Filter logs logic
  const filteredResults = results.filter(row => {
    const matchesSearch = 
      (row.subject || "").toLowerCase().includes(searchQuery.toLowerCase()) ||
      (row.issue || "").toLowerCase().includes(searchQuery.toLowerCase()) ||
      (row.response || "").toLowerCase().includes(searchQuery.toLowerCase()) ||
      (row.justification || "").toLowerCase().includes(searchQuery.toLowerCase());

    const matchesCompany = companyFilter === "ALL" || (row.company || "").toUpperCase() === companyFilter.toUpperCase();
    const matchesStatus = statusFilter === "ALL" || (row.status || "").toLowerCase() === statusFilter.toLowerCase();

    return matchesSearch && matchesCompany && matchesStatus;
  });

  return (
    <div className="min-h-screen bg-neutral-950 text-neutral-100 font-sans flex flex-col selection:bg-brand-hr/30">
      
      {/* 1. Header Area with system telemetry status */}
      <header className="border-b border-neutral-900 bg-neutral-950/70 backdrop-blur-md sticky top-0 z-50 px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-brand-hr/12 rounded-lg border border-brand-hr/30 text-brand-hr">
            <Cpu className="w-6 h-6 animate-pulse" />
          </div>
          <div>
            <h1 className="text-xl font-bold tracking-tight font-display flex items-center gap-2">
              HackerRank Orchestrate 
              <span className="text-xs bg-brand-hr/10 text-brand-hr border border-brand-hr/20 py-0.5 px-2 rounded-full font-sans font-medium">Agentic Core v2.0</span>
            </h1>
            <p className="text-xs text-neutral-400">RAG Triage Engine • HackerRank. Claude. Visa.</p>
          </div>
        </div>
        
        {/* Connection status pills */}
        <div className="flex items-center gap-4 text-xs">
          <div className="hidden md:flex items-center gap-2 bg-neutral-900 px-3 py-1.5 rounded-md border border-neutral-800">
            <span className={`w-2 h-2 rounded-full ${isClientOnlyMode ? "bg-cyan-400" : "bg-brand-hr"} animate-pulse`} />
            <span className="text-neutral-300 font-mono text-[10px] tracking-tight">
              {isClientOnlyMode ? "STANDALONE MODE: BROWSER RAG ACTIVE" : `CORPUS STATUS: ${stats.doc_count ? `${stats.doc_count} DOCS ACTIVE` : "INDEXING..."}`}
            </span>
          </div>
          
          <button
            onClick={handleReprocess}
            disabled={isReprocessing}
            className="flex items-center gap-2 bg-brand-hr text-neutral-950 hover:bg-brand-hr-expanded px-4  py-1.5 rounded-lg text-xs font-semibold select-none cursor-pointer transition-colors disabled:opacity-50"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isReprocessing ? "animate-spin" : ""}`} />
            {isReprocessing ? "REPROCESSING COGNITIVE STREAM..." : "RUN BULK ANALYSIS"}
          </button>
        </div>
      </header>

      {/* 2. Key Metrics Telemetry Bar */}
      <section className="bg-neutral-950 px-6 pt-6 grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: "INDEXED SUPPORT CORPUS", val: `${stats.doc_count} docs`, icon: BookOpen, color: "text-brand-hr", sub: "Local help center files" },
          { label: "TICKETS CATEGORIZED", val: stats.total.toString(), icon: BarChart2, color: "text-cyan-400", sub: "Total input records resolved" },
          { label: "RESOLUTION RATE", val: `${stats.total ? Math.round(((stats.by_status?.replied || 0) / stats.total) * 100) : 0}%`, icon: CheckCircle, color: "text-emerald-400", sub: "Grounded documentation matches" },
          { label: "ESCALATION INDEX", val: `${stats.escalation_rate || 0}%`, icon: AlertTriangle, color: "text-amber-500", sub: "High-risk, fraud, or outage logs" }
        ].map((item, idx) => (
          <div key={idx} className="bg-neutral-900/60 rounded-xl border border-neutral-900 p-4 flex items-center justify-between shadow-lg">
            <div>
              <p className="text-[10px] tracking-wider text-neutral-400 font-semibold font-mono">{item.label}</p>
              <h2 className="text-2xl font-bold font-display mt-1">{item.val}</h2>
              <p className="text-[10px] text-neutral-500 mt-1">{item.sub}</p>
            </div>
            <div className={`p-2 rounded-lg bg-neutral-950 ${item.color}`}>
              <item.icon className="w-5 h-5" />
            </div>
          </div>
        ))}
      </section>

      {/* 3. Main Bento grid split (Playground + Dataset Explorer Ledger) */}
      <main className="flex-1 p-6 grid grid-cols-1 lg:grid-cols-12 gap-6 items-stretch">
        
        {/* LEFT COLUMN: INTERACTIVE AGENT TERMINAL (Scope: 5 columns) */}
        <div className="lg:col-span-5 flex flex-col gap-6">
          <div className="bg-neutral-900/40 rounded-xl border border-neutral-900 p-5 flex flex-col h-full">
            <div className="flex items-center justify-between mb-4 pb-3 border-b border-neutral-800">
              <div className="flex items-center gap-2">
                <Terminal className="w-4 h-4 text-brand-hr" />
                <h3 className="font-semibold text-sm tracking-tight font-display text-neutral-100">Agent Interactive Sandbox</h3>
              </div>
              <span className="text-[10px] font-mono bg-neutral-950 text-neutral-400 px-2 py-0.5 rounded border border-neutral-800">SANDBOX CONSOLE</span>
            </div>

            {/* Quick Presets */}
            <div className="mb-4">
              <p className="text-[11px] font-mono text-neutral-400 mb-2 flex items-center gap-1">
                <Sparkles className="w-3.5 h-3.5 text-brand-hr" /> Select Pre-defined Evaluation Preset:
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-[140px] overflow-y-auto pr-1">
                {TICKET_SAMPLES.map((sample) => (
                  <button
                    key={sample.id}
                    onClick={() => handleSelectSample(sample)}
                    className="text-left text-xs bg-neutral-900 hover:bg-neutral-800/80 p-2.5 rounded-lg border border-neutral-850 hover:border-neutral-700 font-sans cursor-pointer select-none transition-all flex flex-col gap-1 text-neutral-300"
                  >
                    <div className="flex items-center justify-between w-full">
                      <span className={`text-[9px] font-bold px-1.5 py-0.2 rounded-full uppercase ${
                        sample.company === "Claude" ? "bg-amber-500/10 text-amber-500 border border-amber-500/20" :
                        sample.company === "Visa" ? "bg-blue-500/10 text-blue-500 border border-blue-500/20" :
                        sample.company === "HackerRank" ? "bg-emerald-500/10 text-emerald-500 border border-emerald-500/20" :
                        "bg-red-500/10 text-red-400 border border-red-500/20"
                      }`}>
                        {sample.company}
                      </span>
                    </div>
                    <span className="font-semibold text-neutral-200 line-clamp-1">{sample.subject}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Terminal Form */}
            <form onSubmit={handleProcessTicket} className="space-y-3 flex-1 flex flex-col justify-between">
              <div className="space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-[10px] uppercase font-bold tracking-wider text-neutral-400 block mb-1">Company (Ecosystem)</label>
                    <select
                      value={company}
                      onChange={e => setCompany(e.target.value)}
                      className="w-full text-xs font-sans bg-neutral-950 border border-neutral-800 rounded-lg py-2 px-3 focus:outline-none focus:border-brand-hr text-neutral-200"
                    >
                      <option value="">Identify Autonomously</option>
                      <option value="Claude">Claude</option>
                      <option value="HackerRank">HackerRank</option>
                      <option value="Visa">Visa</option>
                    </select>
                  </div>

                  <div>
                    <label className="text-[10px] uppercase font-bold tracking-wider text-neutral-400 block mb-1">Status Target</label>
                    <div className="w-full text-xs font-mono bg-neutral-950 border border-neutral-850 rounded-lg py-2 px-3 text-neutral-400 select-none flex items-center justify-between">
                      <span>Evaluated On Submission</span>
                      <Bot className="w-3.5 h-3.5 text-neutral-500" />
                    </div>
                  </div>
                </div>

                <div>
                  <label className="text-[10px] uppercase font-bold tracking-wider text-neutral-400 block mb-1">Subject Heading</label>
                  <input
                    type="text"
                    required
                    value={subject}
                    onChange={e => setSubject(e.target.value)}
                    placeholder="e.g. Account double payment request"
                    className="w-full text-xs font-sans bg-neutral-950 border border-neutral-850 rounded-lg py-2 px-3 focus:outline-none focus:border-brand-hr text-neutral-100"
                  />
                </div>

                <div>
                  <label className="text-[10px] uppercase font-bold tracking-wider text-neutral-400 block mb-1">Issue Description / Content Body</label>
                  <textarea
                    required
                    rows={4}
                    value={issue}
                    onChange={e => setIssue(e.target.value)}
                    placeholder="Paste the user raw ticket description details here..."
                    className="w-full text-xs font-mono bg-neutral-950 border border-neutral-850 rounded-lg py-2 px-3 focus:outline-none focus:border-brand-hr text-neutral-100 placeholder-neutral-500 resize-none"
                  />
                </div>
              </div>

              <div className="pt-3">
                <button
                  type="submit"
                  disabled={isProcessing}
                  className="w-full flex items-center justify-center gap-2 bg-brand-hr hover:bg-brand-hr-expanded text-neutral-950 py-2.5 rounded-lg text-xs font-bold cursor-pointer transition-colors disabled:opacity-50 select-none uppercase tracking-wide"
                >
                  <Send className="w-3.5 h-3.5" />
                  {isProcessing ? "Computing Heuristics & Search Space..." : "Orchestrate Agent Response"}
                </button>
              </div>
            </form>
          </div>
        </div>

        {/* RIGHT COLUMN: REPOSITORIES WORKSPACE PANEL (Scope: 7 columns) */}
        <div className="lg:col-span-7 flex flex-col gap-4">
          
          {/* Workspace Tabs Header */}
          <div className="flex items-center gap-1.5 p-1 bg-neutral-900/60 border border-neutral-900 rounded-lg max-w-fit self-start">
            <button
              onClick={() => setActiveTab("ledger")}
              className={`text-xs px-3.5 py-1.5 rounded-md font-semibold font-display transition-all cursor-pointer flex items-center gap-1.5 ${
                activeTab === "ledger" 
                  ? "bg-neutral-950 text-brand-hr shadow-sm border border-neutral-850" 
                  : "text-neutral-400 hover:text-neutral-200"
              }`}
            >
              <FileText className="w-3.5 h-3.5" />
              Pipeline Outputs
            </button>
            <button
              onClick={() => setActiveTab("kb")}
              className={`text-xs px-3.5 py-1.5 rounded-md font-semibold font-display transition-all cursor-pointer flex items-center gap-1.5 ${
                activeTab === "kb" 
                  ? "bg-neutral-950 text-brand-hr shadow-sm border border-neutral-850" 
                  : "text-neutral-400 hover:text-neutral-200"
              }`}
            >
              <BookOpen className="w-3.5 h-3.5" />
              Knowledge Base
            </button>
            <button
              onClick={() => setActiveTab("analytics")}
              className={`text-xs px-3.5 py-1.5 rounded-md font-semibold font-display transition-all cursor-pointer flex items-center gap-1.5 ${
                activeTab === "analytics" 
                  ? "bg-neutral-950 text-brand-hr shadow-sm border border-neutral-850" 
                  : "text-neutral-400 hover:text-neutral-200"
              }`}
            >
              <BarChart2 className="w-3.5 h-3.5" />
              System Metrics
            </button>
          </div>

          {activeTab === "ledger" && (
            <div className="bg-neutral-900/40 rounded-xl border border-neutral-900 p-5 flex flex-col h-full min-h-[500px]">
              
              {results.length === 0 ? (
                <div className="flex-1 flex flex-col items-center justify-center p-8 bg-neutral-900/10 border-2 border-dashed border-neutral-800 rounded-xl my-2 text-center select-none animate-fade-in">
                  <div className="p-4 bg-brand-hr/12 text-brand-hr rounded-full border border-brand-hr/30 mb-5 animate-pulse">
                    <Upload className="w-8 h-8" />
                  </div>
                  
                  <h3 className="font-bold text-lg text-neutral-100 font-display tracking-tight">Support Ingestion & Triage Ready</h3>
                  <p className="text-xs text-neutral-400 max-w-lg mt-2 mb-8 leading-relaxed">
                    HackerRank Orchestrate is fully armed and ready. You can choose to process the pre-configured sample dataset from <code className="text-cyan-400 font-mono bg-neutral-950 px-1.5 py-0.5 rounded text-[10px]/normal">support_tickets.csv</code> directly inside your browser, or upload your own custom Support Tickets CSV dataset.
                  </p>
                  
                  <div className="flex flex-col sm:flex-row items-center justify-center gap-4 w-full max-w-md">
                    {/* Hidden input trigger */}
                    <input
                      type="file"
                      ref={fileInputRef}
                      onChange={handleFileUpload}
                      accept=".csv"
                      className="hidden"
                    />
                    
                    <button
                      onClick={() => fileInputRef.current?.click()}
                      disabled={isUploading}
                      className="w-full sm:w-auto h-11 px-6 rounded-lg bg-cyan-400 hover:bg-cyan-500 text-neutral-950 font-bold text-xs flex items-center justify-center gap-2 select-none transition-all cursor-pointer shadow-lg hover:shadow-cyan-400/10 active:scale-[0.98]"
                    >
                      <Upload className="w-4 h-4" />
                      {isUploading ? "Uploading CSV..." : "Upload Custom Ticket CSV"}
                    </button>
                    
                    <button
                      onClick={() => {
                        if (fallbackRetriever) {
                          processCSVClientSide(fallbackRetriever);
                        } else {
                          alert("Autonomous support engine is initializing, please try again in a moment.");
                        }
                      }}
                      className="w-full sm:w-auto h-11 px-6 rounded-lg bg-neutral-900 hover:bg-neutral-850 text-neutral-200 border border-neutral-800 font-semibold text-xs flex items-center justify-center gap-2 select-none transition-all cursor-pointer active:scale-[0.98]"
                    >
                      <RefreshCw className="w-4 h-4 text-brand-hr" />
                      Classify 58 Default Tickets
                    </button>
                  </div>

                  <div className="mt-10 pt-6 border-t border-neutral-900/80 w-full max-w-md">
                    <span className="text-[10px] font-mono font-bold tracking-wider text-neutral-500 uppercase block mb-2.5">ACCEPTED INPUT SCHEMA:</span>
                    <div className="bg-neutral-950/95 py-3 px-4 rounded-lg border border-neutral-850 text-left font-mono text-[11px] text-neutral-300 flex items-center justify-between">
                      <code className="text-brand-hr select-all">subject, issue, company</code>
                      <span className="text-[9px] bg-neutral-900 text-neutral-500 px-2 py-0.5 rounded border border-neutral-800 tracking-tight font-sans">Delimited format</span>
                    </div>
                  </div>
                </div>
              ) : (
                <>
                  {/* Header with Search and File Upload button */}
                  <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 mb-4 pb-3 border-b border-neutral-800">
                    <div className="flex items-center gap-2">
                      <FileText className="w-4 h-4 text-cyan-400" />
                      <h3 className="font-semibold text-sm font-display text-neutral-100">Processed Output Ledger</h3>
                    </div>

                    {/* Upload trigger */}
                    <div className="flex items-center gap-2">
                      <input
                        type="file"
                        ref={fileInputRef}
                        onChange={handleFileUpload}
                        accept=".csv"
                        className="hidden"
                      />
                      <button
                        onClick={() => fileInputRef.current?.click()}
                        disabled={isUploading}
                        className="flex items-center gap-1.5 bg-neutral-950 hover:bg-neutral-900 text-neutral-300 border border-neutral-800 hover:border-neutral-700 px-3 py-1 text-xs font-semibold rounded-md transition-colors cursor-pointer"
                      >
                        <Upload className="w-3 h-3 text-cyan-400" />
                        {isUploading ? "Uploading CSV..." : "Upload Custom Ticket CSV"}
                      </button>
                    </div>
                  </div>

                  {/* Filters Bar */}
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-4">
                    {/* Search Query input */}
                    <div className="relative">
                      <span className="absolute inset-y-0 left-0 pl-2.5 flex items-center pointer-events-none text-neutral-500">
                        <Search className="w-3.5 h-3.5" />
                      </span>
                      <input
                        type="text"
                        value={searchQuery}
                        onChange={e => setSearchQuery(e.target.value)}
                        placeholder="Query search outputs..."
                        className="w-full text-xs bg-neutral-950 border border-neutral-850 rounded-lg py-2 pl-8 pr-3 focus:outline-none focus:border-brand-hr text-neutral-200"
                      />
                    </div>

                    {/* Company select filter */}
                    <div>
                      <select
                        value={companyFilter}
                        onChange={e => setCompanyFilter(e.target.value)}
                        className="w-full text-xs bg-neutral-950 border border-neutral-850 rounded-lg py-2 px-3 focus:outline-none focus:border-brand-hr text-neutral-300"
                      >
                        <option value="ALL">All Companies</option>
                        <option value="Claude">Claude</option>
                        <option value="HackerRank">HackerRank</option>
                        <option value="Visa">Visa</option>
                        <option value="None">None (Unclassified)</option>
                      </select>
                    </div>

                    {/* Status filter */}
                    <div>
                      <select
                        value={statusFilter}
                        onChange={e => setStatusFilter(e.target.value)}
                        className="w-full text-xs bg-neutral-950 border border-neutral-850 rounded-lg py-2 px-3 focus:outline-none focus:border-brand-hr text-neutral-300"
                      >
                        <option value="ALL">All Status Actions</option>
                        <option value="replied">Replied (Grounded)</option>
                        <option value="escalated">Escalated (Manual review)</option>
                      </select>
                    </div>
                  </div>

                  {/* Results Table list */}
                  <div className="flex-1 overflow-y-auto max-h-[420px] rounded-lg border border-neutral-950 bg-neutral-960 min-h-[300px]">
                    <table className="w-full text-left text-xs border-collapse">
                      <thead className="bg-neutral-950 text-neutral-400 uppercase tracking-wider text-[9px] font-mono select-none border-b border-neutral-900 py-2.5 px-3 sticky top-0 z-10">
                        <tr>
                          <th className="py-2.5 px-4">Subject & Issue</th>
                          <th className="py-2.5 px-3">Ecosystem</th>
                          <th className="py-2.5 px-3">Product Area</th>
                          <th className="py-2.5 px-3 text-center">Status</th>
                          <th className="py-2.5 px-4 text-right">Details</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-neutral-900/40 divide-dashed flex-1">
                        {filteredResults.length === 0 ? (
                          <tr>
                            <td colSpan={5} className="py-12 text-center text-neutral-400 text-xs">
                              <div className="flex flex-col items-center justify-center gap-2">
                                <Info className="w-5 h-5 text-neutral-600" />
                                <span>No processed entries match the filters.</span>
                              </div>
                            </td>
                          </tr>
                        ) : (
                          filteredResults.map((row, idx) => (
                            <tr 
                              key={idx}
                              className="hover:bg-neutral-900/40 transition-colors group"
                            >
                              <td className="py-3 px-4 max-w-[220px]">
                                <div className="font-semibold text-neutral-200 line-clamp-1 group-hover:text-neutral-100">{row.subject}</div>
                                <div className="text-[10px] text-neutral-400 line-clamp-1 mt-0.5">{row.issue}</div>
                              </td>
                              <td className="py-3 px-3">
                                <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded uppercase ${
                                  row.company?.toLowerCase() === "claude" ? "bg-amber-500/10 text-amber-500 border border-amber-500/20" :
                                  row.company?.toLowerCase() === "visa" ? "bg-blue-500/10 text-blue-500 border border-blue-500/20" :
                                  row.company?.toLowerCase() === "hackerrank" ? "bg-emerald-500/10 text-emerald-500 border border-emerald-500/20" :
                                  "bg-neutral-800 text-neutral-400"
                                }`}>
                                  {row.company || "None"}
                                </span>
                              </td>
                              <td className="py-3 px-3 text-neutral-400 text-[10px] max-w-[120px] truncate">{row.product_area || "General"}</td>
                              <td className="py-3 px-3 text-center">
                                <span className={`inline-flex items-center gap-1 text-[9px] font-semibold py-0.5 px-2 rounded-full ${
                                  row.status === "replied" 
                                    ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20" 
                                    : "bg-amber-500/10 text-amber-500 border border-amber-500/20"
                                }`}>
                                  <span className={`w-1 h-1 rounded-full ${row.status === "replied" ? "bg-emerald-400" : "bg-amber-400"}`} />
                                  {row.status}
                                </span>
                              </td>
                              <td className="py-3 px-4 text-right">
                                <button
                                  onClick={() => setSelectedTicket(row)}
                                  className="bg-neutral-900 hover:bg-neutral-800 hover:text-neutral-100 text-neutral-400 border border-neutral-800 p-1 rounded transition-all cursor-pointer font-semibold text-[10px] inline-flex items-center gap-0.5 text-xs font-semibold"
                                >
                                  Browse
                                  <ChevronRight className="w-3 h-3" />
                                </button>
                              </td>
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>
                  </div>
                </>
              )}

            </div>
          )}

          {activeTab === "kb" && (
            <KnowledgeBase 
              onLoadToSandbox={(subj, iss, comp) => {
                setSubject(subj);
                setIssue(iss);
                setCompany(comp === "None" ? "" : comp);
                setOrchestrationResult(null);
                
                // Add minor flash alert in UI
                const container = document.getElementById("root");
                if (container) {
                  const alertDiv = document.createElement("div");
                  alertDiv.className = "fixed bottom-5 right-5 z-[100] bg-brand-hr text-neutral-950 px-4 py-2.5 rounded-lg text-xs font-bold shadow-2xl flex items-center gap-2 border border-brand-hr/30 animate-bounce";
                  alertDiv.innerHTML = "<span>⚡ Sandbox Workspace Loaded!</span>";
                  container.appendChild(alertDiv);
                  setTimeout(() => alertDiv.remove(), 2500);
                }
              }}
            />
          )}

          {activeTab === "analytics" && (
            <div className="bg-neutral-900/40 rounded-xl border border-neutral-900 p-5 flex flex-col h-full min-h-[500px]">
              
              {/* Analytics Header */}
              <div className="flex items-center justify-between mb-5 pb-3 border-b border-neutral-800 animate-fade-in">
                <div className="flex items-center gap-2">
                  <BarChart2 className="w-4 h-4 text-cyan-400" />
                  <h3 className="font-semibold text-sm font-display text-neutral-100">Evaluative Dataset Statistics</h3>
                </div>
                <span className="text-[10px] font-mono bg-neutral-950 text-neutral-400 px-2.5 py-0.5 rounded border border-neutral-800 uppercase">Live Metrics</span>
              </div>

              {stats.total === 0 ? (
                <div className="py-12 border border-dashed border-neutral-800 rounded-lg text-center flex-1 flex flex-col items-center justify-center gap-2">
                  <Info className="w-5 h-5 text-neutral-600" />
                  <span className="text-xs text-neutral-400">Please process some support tickets to unlock advanced stats telemetry.</span>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-5 flex-1 select-none overflow-y-auto max-h-[460px]">
                  
                  {/* Ecosystem Splits */}
                  <div className="bg-neutral-950 p-4 rounded-xl border border-neutral-850 flex flex-col justify-between">
                    <div>
                      <h4 className="text-[11px] font-bold tracking-wider font-mono text-cyan-400 uppercase mb-3">Ecosystem Volume Share</h4>
                      <div className="space-y-4">
                        {Object.entries(stats.by_company || {}).map(([comp, count]) => {
                          const pct = stats.total ? Math.round(((count as number) / stats.total) * 100) : 0;
                          return (
                            <div key={comp} className="space-y-1">
                              <div className="flex items-center justify-between text-xs font-mono">
                                <span className="text-neutral-300 font-semibold">{comp === "None" ? "Unclassified" : comp}</span>
                                <span className="text-neutral-400 text-[11px]">{count} tickets ({pct}%)</span>
                              </div>
                              <div className="w-full bg-neutral-900 rounded-full h-2 overflow-hidden border border-neutral-850">
                                <div 
                                  className={`h-full rounded-full transition-all duration-500 ${
                                    comp?.toLowerCase() === "claude" ? "bg-amber-500" :
                                    comp?.toLowerCase() === "visa" ? "bg-blue-500" :
                                    comp?.toLowerCase() === "hackerrank" ? "bg-emerald-500" : "bg-neutral-600"
                                  }`}
                                  style={{ width: `${pct}%` }}
                                />
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                    <p className="text-[10px] text-neutral-500 font-mono mt-4 pt-2 border-t border-neutral-900/60">
                      Evaluated on raw candidate/customer headers
                    </p>
                  </div>

                  {/* Request Type Distributions */}
                  <div className="bg-neutral-950 p-4 rounded-xl border border-neutral-850 flex flex-col justify-between">
                    <div>
                      <h4 className="text-[11px] font-bold tracking-wider font-mono text-cyan-400 uppercase mb-3">Triage Classification Frequency</h4>
                      <div className="space-y-4.5">
                        {Object.entries(stats.by_request_type || {}).map(([rt, count]) => {
                          const pct = stats.total ? Math.round(((count as number) / stats.total) * 100) : 0;
                          return (
                            <div key={rt} className="space-y-1">
                              <div className="flex items-center justify-between text-xs font-mono">
                                <span className="text-neutral-300 capitalize">{rt.replace(/_/g, " ")}</span>
                                <span className="text-neutral-400 text-[11px]">{count} count ({pct}%)</span>
                              </div>
                              <div className="w-full bg-neutral-900 rounded-full h-2 overflow-hidden border border-neutral-850">
                                <div 
                                  className={`h-full rounded-full transition-all duration-500 ${
                                    rt === "invalid" ? "bg-rose-500" :
                                    rt === "bug" ? "bg-pink-500" :
                                    rt === "feature_request" ? "bg-indigo-400" : "bg-cyan-500"
                                  }`}
                                  style={{ width: `${pct}%` }}
                                />
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                    <p className="text-[10px] text-neutral-500 font-mono mt-4 pt-2 border-t border-neutral-900/60">
                      Calculated using custom NLP keyword heuristical map
                    </p>
                  </div>

                  {/* Triage Decision Ratios */}
                  <div className="bg-neutral-950 p-4 rounded-xl border border-neutral-850 md:col-span-2 flex flex-col justify-between">
                    <div>
                      <h4 className="text-[11px] font-bold tracking-wider font-mono text-cyan-400 uppercase mb-3">Triage Dispatch Ratio</h4>
                      <div className="grid grid-cols-2 gap-4">
                        <div className="p-3 bg-neutral-900/60 rounded-lg border border-neutral-850 flex items-center justify-between">
                          <div>
                            <span className="text-[10px] text-neutral-400 font-mono block">REPLIED (Grounded matching)</span>
                            <span className="text-xl font-bold text-emerald-400 font-display mt-1 block">{stats.by_status?.replied || 0}</span>
                          </div>
                          <CheckCircle className="w-8 h-8 text-emerald-500/10" />
                        </div>
                        <div className="p-3 bg-neutral-900/60 rounded-lg border border-neutral-850 flex items-center justify-between">
                          <div>
                            <span className="text-[10px] text-neutral-400 font-mono block">ESCALATED (Manual callout)</span>
                            <span className="text-xl font-bold text-amber-400 font-display mt-1 block">{stats.by_status?.escalated || 0}</span>
                          </div>
                          <AlertTriangle className="w-8 h-8 text-amber-500/10" />
                        </div>
                      </div>

                      <div className="mt-4 space-y-2">
                        <div className="flex items-center justify-between text-xs font-mono">
                          <span className="text-neutral-400">Grounded Automatic Reply</span>
                          <span className="text-neutral-400">Escalation Threshold ({stats.escalation_rate || 0}% rate)</span>
                        </div>
                        <div className="w-full bg-neutral-900 rounded-full h-3 overflow-hidden border border-neutral-850 flex font-mono text-[9px]">
                          <div 
                            className="bg-emerald-500 h-full transition-all duration-500" 
                            style={{ width: `${stats.total ? Math.round(((stats.by_status?.replied || 0) / stats.total) * 100) : 100}%` }}
                          />
                          <div 
                            className="bg-amber-500 h-full transition-all duration-500" 
                            style={{ width: `${stats.total ? Math.round(((stats.by_status?.escalated || 0) / stats.total) * 100) : 0}%` }}
                          />
                        </div>
                      </div>
                    </div>
                  </div>

                </div>
              )}

            </div>
          )}

        </div>

      </main>

      {/* 4. Instant Output Visualization Overlay (Real-time agentic trace response) */}
      <AnimatePresence>
        {orchestrationResult && (
          <motion.section 
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 15 }}
            className="px-6 pb-6"
          >
            <div className="bg-neutral-900/90 rounded-xl border border-neutral-850 p-5 shadow-2xl relative overflow-hidden backdrop-blur">
              <div className="absolute top-0 left-0 w-1.5 h-full bg-brand-hr" />
              
              <div className="flex items-center justify-between mb-4 pb-3 border-b border-neutral-800">
                <div className="flex items-center gap-2">
                  <Bot className="w-5 h-5 text-brand-hr" />
                  <h3 className="font-bold text-sm tracking-tight font-display text-neutral-100">Live Agent Triaging Pipeline Trace</h3>
                </div>
                <button 
                  onClick={() => setOrchestrationResult(null)}
                  className="text-neutral-400 hover:text-neutral-200 text-xs py-0.5 px-2 bg-neutral-950 rounded cursor-pointer border border-neutral-800 select-none font-semibold"
                >
                  Dismiss Trace
                </button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                
                {/* Visual categorizer outcomes */}
                <div className="bg-neutral-950 p-4 rounded-lg border border-neutral-900 space-y-3.5">
                  <h4 className="text-[10px] font-mono text-brand-hr tracking-wider font-bold uppercase">Heuristic Triages</h4>
                  
                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <div>
                      <span className="text-neutral-400 font-mono text-[9px] block">ECOSYSTEM</span>
                      <span className="font-bold text-neutral-100">{orchestrationResult.company}</span>
                    </div>
                    <div>
                      <span className="text-neutral-400 font-mono text-[9px] block">CLASSIFIED INTENT</span>
                      <span className="font-bold text-neutral-100 capitalize">{orchestrationResult.intent}</span>
                    </div>
                    <div>
                      <span className="text-neutral-400 font-mono text-[9px] block">REQUEST TYPE</span>
                      <span className={`font-bold ${
                        orchestrationResult.requestType === "invalid" ? "text-red-400" : "text-neutral-200"
                      }`}>{orchestrationResult.requestType}</span>
                    </div>
                    <div>
                      <span className="text-neutral-400 font-mono text-[9px] block font-semibold text-neutral-400">PRODUCT AREA</span>
                      <span className="font-bold text-neutral-100 truncate block">{orchestrationResult.productArea || "General"}</span>
                    </div>
                  </div>

                  <div className="pt-2 border-t border-neutral-900">
                    <span className="text-neutral-500 font-mono text-[9px] block">TRIAGE ACTION</span>
                    <span className={`inline-flex items-center gap-1.5 text-[11px] font-bold mt-1 uppercase ${
                      orchestrationResult.status === "replied" ? "text-emerald-400" : "text-amber-500"
                    }`}>
                      {orchestrationResult.status === "replied" ? (
                        <>
                          <CheckCircle className="w-3.5 h-3.5" />
                          Replied • Grounded In Corpus
                        </>
                      ) : (
                        <>
                          <AlertTriangle className="w-3.5 h-3.5" />
                          Escalated • Human Callback Required
                        </>
                      )}
                    </span>
                  </div>

                  <div className="pt-2">
                    <span className="text-neutral-500 font-mono text-[9px] block">COGNITIVE CODES</span>
                    <span className="font-mono text-[10px] text-neutral-400 mt-1 block break-all whitespace-pre-wrap leading-relaxed">{orchestrationResult.justification}</span>
                  </div>
                </div>

                {/* Grounded response body */}
                <div className="bg-neutral-950 p-4 rounded-lg border border-neutral-900 flex flex-col justify-between md:col-span-2">
                  <div>
                    <h4 className="text-[10px] font-mono text-cyan-400 tracking-wider font-bold uppercase mb-2">Automated Ticket Draft</h4>
                    <div className="bg-neutral-910 p-3 rounded border border-neutral-850 font-mono text-xs text-neutral-200 whitespace-pre-wrap leading-relaxed max-h-[170px] overflow-y-auto">
                      {orchestrationResult.response}
                    </div>
                  </div>
                  <div className="flex items-center justify-between text-[10px] text-neutral-400 pt-3 border-t border-neutral-900/60 mt-3 font-mono">
                    <span>RECONSTRUCTED USING MINIMALIST PARSERS</span>
                    <button 
                      onClick={() => {
                        navigator.clipboard.writeText(orchestrationResult.response);
                        alert("Copied draft response to clipboard");
                      }}
                      className="text-brand-hr hover:underline cursor-pointer select-none"
                    >
                      COPY RESPONSE DRAFT
                    </button>
                  </div>
                </div>

              </div>

            </div>
          </motion.section>
        )}
      </AnimatePresence>

      {/* 5. Details Modal Overlay for Outputs history */}
      <AnimatePresence>
        {selectedTicket && (
          <div className="fixed inset-0 bg-neutral-950/80 backdrop-blur-sm flex items-center justify-center p-4 z-50">
            <motion.div 
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-neutral-900 border border-neutral-800 rounded-xl w-full max-w-2xl overflow-hidden shadow-2xl flex flex-col max-h-[90vh]"
            >
              
              <div className="p-4 bg-neutral-950 border-b border-neutral-800 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Layers className="w-4 h-4 text-cyan-400" />
                  <span className="font-bold text-sm font-display">Triage Record Inspector</span>
                </div>
                
                <span className={`text-[10px] py-0.5 px-2.5 rounded-full font-semibold uppercase ${
                  selectedTicket.status === "replied" ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20" : "bg-amber-500/10 text-amber-500 border border-amber-500/20"
                }`}>
                  {selectedTicket.status}
                </span>
              </div>

              <div className="p-5 overflow-y-auto space-y-4">
                
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <span className="text-[10px] text-neutral-400 font-mono block">CLIENT ECOSYSTEM</span>
                    <span className="font-semibold text-neutral-100 text-xs mt-1 block uppercase">{selectedTicket.company || "None"}</span>
                  </div>
                  <div>
                    <span className="text-[10px] text-neutral-400 font-mono block">DETERMINED REQUEST CLASSIFICATION</span>
                    <span className="font-semibold text-neutral-100 text-xs mt-1 block uppercase">{selectedTicket.request_type || "invalid"}</span>
                  </div>
                  <div>
                    <span className="text-[10px] text-neutral-400 font-mono block">SUPPORT SUB-DOMAIN</span>
                    <span className="font-semibold text-neutral-100 text-xs mt-1 block">{selectedTicket.product_area || "General"}</span>
                  </div>
                  <div>
                    <span className="text-[10px] text-neutral-400 font-mono block">DETERMINISTIC COGNITIVE CODE</span>
                    <span className="font-mono text-[9px] text-neutral-300 mt-1 block truncate" title={selectedTicket.justification}>
                      {selectedTicket.justification}
                    </span>
                  </div>
                </div>

                <div className="pt-2 border-t border-neutral-850">
                  <span className="text-[10px] text-neutral-400 font-mono block mb-1">METADATA SUBJECT</span>
                  <span className="text-xs font-semibold text-neutral-100 leading-normal">{selectedTicket.subject}</span>
                </div>

                <div>
                  <span className="text-[10px] text-neutral-400 font-mono block mb-1.5">USER SUBMITTED DESCRIPTION</span>
                  <div className="bg-neutral-950 p-3 rounded font-mono text-xs text-neutral-200 max-h-[120px] overflow-y-auto leading-relaxed border border-neutral-950">
                    {selectedTicket.issue}
                  </div>
                </div>

                <div>
                  <span className="text-[10px] text-neutral-400 font-mono block mb-1.5">FORMULATED RESPONSE/ESCALATION DISPATCH</span>
                  <div className="bg-neutral-950 p-3 rounded font-mono text-xs text-neutral-100 max-h-[140px] overflow-y-auto leading-relaxed border border-neutral-950">
                    {selectedTicket.response}
                  </div>
                </div>

              </div>

              <div className="p-4 bg-neutral-950 border-t border-neutral-800 flex items-center justify-between">
                <button
                  onClick={() => {
                    setSubject(selectedTicket.subject);
                    setIssue(selectedTicket.issue);
                    setCompany(selectedTicket.company === "None" ? "" : selectedTicket.company);
                    setSelectedTicket(null);
                  }}
                  className="bg-neutral-900 border border-neutral-800 text-brand-hr hover:text-brand-hr-expanded px-3.5 py-1.5 text-xs font-semibold rounded-lg hover:bg-neutral-850 transition-colors cursor-pointer"
                >
                  Load Into Workspace
                </button>
                
                <button
                  onClick={() => setSelectedTicket(null)}
                  className="bg-brand-hr text-neutral-950 px-4 py-1.5 text-xs font-bold rounded-lg hover:bg-brand-hr-expanded transition-colors cursor-pointer"
                >
                  Close Inspector
                </button>
              </div>

            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* 6. Simple Footer Info block */}
      <footer className="border-t border-neutral-950 bg-neutral-950 px-6 py-4 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-neutral-500 mt-auto">
        <div>
          <span>Evaluator Workspace: {selectedTicket ? "Inspecting" : "Monitoring Pipeline"}</span>
        </div>
        <div>
          <span className="font-mono">May 2026 Hackathon • Grounded RAG Systems</span>
        </div>
      </footer>
    </div>
  );
}
