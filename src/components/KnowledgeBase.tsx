import React, { useState, useEffect } from "react";
import { 
  BookOpen, 
  Search, 
  ChevronRight, 
  Download, 
  FileText, 
  ArrowLeft,
  Terminal,
  Clock,
  ExternalLink,
  Tag,
  HelpCircle
} from "lucide-react";
import corpusData from "../corpus.json";

interface Article {
  path: string;
  company: string;
  productArea: string;
  title: string;
  length: number;
  preview: string;
  content: string;
}

interface KnowledgeBaseProps {
  onLoadToSandbox: (subject: string, issue: string, company: string) => void;
}

export default function KnowledgeBase({ onLoadToSandbox }: KnowledgeBaseProps) {
  const [articles, setArticles] = useState<Article[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [companyFilter, setCompanyFilter] = useState("ALL");
  const [selectedArticle, setSelectedArticle] = useState<Article | null>(null);

  useEffect(() => {
    fetch("/api/kb")
      .then(res => {
        if (!res.ok) throw new Error("Offline");
        return res.json();
      })
      .then(data => {
        setArticles(data);
        setIsLoading(false);
      })
      .catch(err => {
        console.warn("Backend KB offline. Falling back to built static documentation corpus.");
        setArticles(corpusData as Article[]);
        setIsLoading(false);
      });
  }, []);

  const filteredArticles = articles.filter(art => {
    const matchesSearch = 
      art.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      art.productArea.toLowerCase().includes(searchQuery.toLowerCase()) ||
      art.content.toLowerCase().includes(searchQuery.toLowerCase());
    
    const matchesCompany = companyFilter === "ALL" || art.company.toLowerCase() === companyFilter.toLowerCase();
    
    return matchesSearch && matchesCompany;
  });

  // Extract a clean mock ticket issue from an article to instantly help the user evaluate
  const handleSimulateTicket = (art: Article) => {
    // Find some sample problem statement or standard instruction
    let mockIssue = art.preview;
    if (art.content.length > 200) {
      // Clean off # title
      const lines = art.content.split("\n")
        .filter(l => !l.trim().startsWith("#") && !l.trim().startsWith("---") && l.trim().length > 15);
      if (lines.length > 2) {
        mockIssue = lines.slice(0, 3).join("\n").replace(/[*`#_]/g, "");
      }
    }
    
    // Auto fill subject
    const mockSubject = `Inquiry regarding ${art.title}`;
    onLoadToSandbox(mockSubject, mockIssue, art.company);
  };

  return (
    <div className="bg-neutral-900/40 rounded-xl border border-neutral-900 p-5 flex flex-col h-full min-h-[500px]">
      
      {/* KB Header */}
      <div className="flex items-center justify-between mb-4 pb-3 border-b border-neutral-800">
        <div className="flex items-center gap-2">
          <BookOpen className="w-4 h-4 text-amber-400" />
          <h3 className="font-semibold text-sm font-display text-neutral-100">RAG Reference Knowledge Base ({articles.length} articles)</h3>
        </div>
        <span className="text-[10px] font-mono bg-neutral-950 text-neutral-400 px-2.5 py-0.5 rounded border border-neutral-800 uppercase">Interactive Corpus</span>
      </div>

      {isLoading ? (
        <div className="flex-1 flex flex-col items-center justify-center gap-3 py-16">
          <Clock className="w-6 h-6 text-brand-hr animate-spin" />
          <p className="text-xs text-neutral-400">Scanning local markdown documentation registry...</p>
        </div>
      ) : selectedArticle ? (
        /* Full Article Viewer Mode */
        <div className="flex flex-col flex-1">
          <div className="flex items-center justify-between mb-4 pb-3 border-b border-neutral-800">
            <button 
              onClick={() => setSelectedArticle(null)}
              className="flex items-center gap-1.5 text-neutral-400 hover:text-neutral-100 text-xs py-1 px-2.5 bg-neutral-950 rounded-lg border border-neutral-850 cursor-pointer font-semibold transition-colors"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              Back to Index
            </button>
            <div className="flex items-center gap-2">
              <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded uppercase ${
                selectedArticle.company.toLowerCase() === "claude" ? "bg-amber-500/10 text-amber-500 border border-amber-505/20" :
                selectedArticle.company.toLowerCase() === "visa" ? "bg-blue-500/10 text-blue-500 border border-blue-505/20" :
                "bg-emerald-500/10 text-emerald-400 border border-emerald-505/20"
              }`}>
                {selectedArticle.company}
              </span>
              <span className="text-[10px] text-neutral-400 font-mono">
                {selectedArticle.productArea}
              </span>
            </div>
          </div>

          <div className="flex-1 overflow-y-auto max-h-[460px] bg-neutral-950 p-5 rounded-lg border border-neutral-850 dark-scroller select-text">
            <h2 className="text-lg font-bold font-display text-neutral-100 mb-3 border-b border-neutral-900 pb-2 flex items-center gap-2">
              <FileText className="w-4 h-4 text-brand-hr" />
              {selectedArticle.title}
            </h2>
            
            <div className="prose prose-invert prose-xs text-xs whitespace-pre-wrap leading-relaxed text-neutral-300">
              {selectedArticle.content}
            </div>
          </div>

          {/* Load into Sandbox Action */}
          <div className="mt-4 pt-3 border-t border-neutral-800 flex items-center justify-between">
            <span className="text-[10px] text-neutral-500 font-mono">
              FILE: {selectedArticle.path} • {selectedArticle.length} chars
            </span>
            <button
              onClick={() => {
                handleSimulateTicket(selectedArticle);
                // Dispatch alert or scroll
              }}
              className="flex items-center gap-1.5 bg-brand-hr hover:bg-brand-hr-expanded text-neutral-950 px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer"
            >
              <Terminal className="w-3.5 h-3.5" />
              Load Mock Sandbox Ticket
            </button>
          </div>
        </div>
      ) : (
        /* List and Search Mode */
        <div className="flex flex-col flex-1">
          
          {/* Search KB and Filter controls */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-4">
            <div className="relative sm:col-span-2">
              <span className="absolute inset-y-0 left-0 pl-2.5 flex items-center pointer-events-none text-neutral-500">
                <Search className="w-3.5 h-3.5" />
              </span>
              <input
                type="text"
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                placeholder="Search articles & reference text..."
                className="w-full text-xs bg-neutral-950 border border-neutral-850 rounded-lg py-1.5 pl-8 pr-3 focus:outline-none focus:border-neutral-700 text-neutral-200"
              />
            </div>
            
            <div>
              <select
                value={companyFilter}
                onChange={e => setCompanyFilter(e.target.value)}
                className="w-full text-xs bg-neutral-950 border border-neutral-850 rounded-lg py-1.5 px-3 focus:outline-none focus:border-neutral-700 text-neutral-300"
              >
                <option value="ALL">All Providers</option>
                <option value="Claude">Claude</option>
                <option value="HackerRank">HackerRank</option>
                <option value="Visa">Visa</option>
              </select>
            </div>
          </div>

          {/* Grid of KB articles */}
          <div className="flex-1 overflow-y-auto max-h-[460px] min-h-[300px] space-y-2.5 pr-1">
            {filteredArticles.length === 0 ? (
              <div className="py-12 border border-dashed border-neutral-800 rounded-lg text-center flex flex-col items-center justify-center gap-2">
                <HelpCircle className="w-5 h-5 text-neutral-600" />
                <span className="text-xs text-neutral-400">No matching help articles found in corpus database.</span>
              </div>
            ) : (
              filteredArticles.map((art, idx) => (
                <div 
                  key={idx}
                  className="bg-neutral-950 rounded-lg border border-neutral-850 hover:border-neutral-750 p-4 transition-all hover:translate-x-0.5 flex flex-col justify-between"
                >
                  <div>
                    <div className="flex items-center justify-between gap-2 mb-1">
                      <span className={`text-[8px] font-extrabold px-1.5 py-0.2 rounded uppercase ${
                        art.company.toLowerCase() === "claude" ? "bg-amber-500/10 text-amber-500 border border-amber-500/20" :
                        art.company.toLowerCase() === "visa" ? "bg-blue-500/10 text-blue-500 border border-blue-500/20" :
                        "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20"
                      }`}>
                        {art.company}
                      </span>
                      <span className="text-[10px] text-neutral-500 font-mono inline-flex items-center gap-1">
                        <Tag className="w-2.5 h-2.5 text-neutral-600" />
                        {art.productArea}
                      </span>
                    </div>
                    
                    <h4 className="font-semibold text-xs text-neutral-200 hover:text-neutral-100 transition-colors line-clamp-1">
                      {art.title}
                    </h4>
                    
                    <p className="text-[10px] text-neutral-400 mt-1 line-clamp-2 leading-relaxed">
                      {art.preview}
                    </p>
                  </div>

                  <div className="flex items-center justify-between mt-3.5 pt-2 border-t border-neutral-900/60 text-[10px]">
                    <span className="text-neutral-500 font-mono">
                      {(art.length / 1024).toFixed(1)} KB document
                    </span>
                    <button
                      onClick={() => setSelectedArticle(art)}
                      className="text-brand-hr hover:text-brand-hr-expanded font-semibold flex items-center gap-0.5 cursor-pointer"
                    >
                      Read Document
                      <ChevronRight className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>

        </div>
      )}
    </div>
  );
}
