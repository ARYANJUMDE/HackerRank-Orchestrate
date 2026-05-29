export interface TicketSample {
  id: string;
  subject: string;
  issue: string;
  company: string;
  summary: string;
}

export const TICKET_SAMPLES: TicketSample[] = [
  {
    id: "claude-billing-1",
    subject: "Charged twice for Claude Pro subscription",
    issue: "My credit card was charged twice ($20 and $20) on May 15th for my Claude Pro subscription. I only intended to purchase one subscription. Can you refund the duplicate charge?",
    company: "Claude",
    summary: "Claude double-charge refund request (Billing)"
  },
  {
    id: "visa-fraud-2",
    subject: "Urgent: Unrecognized transaction list on my credit card",
    issue: "I just noticed three transactions from yesterday that I did not authorize. One for $450 at BestBuy, one for $89 at Walmart, and $150 at Exxon. My identity might be compromised! Help blocks my card immediately.",
    company: "Visa",
    summary: "Potential Visa identity fraud / card block (High Risk)"
  },
  {
    id: "hackerrank-score-3",
    subject: "Candidate cannot submit my coding test on HackerRank",
    issue: "A candidate at Microsoft was taking my test (id: 48921) and the browser crashed on the final coding question. Can we reinvite or reset their session so they don't lose progress?",
    company: "HackerRank",
    summary: "HackerRank candidate test crash reinvite (Technical)"
  },
  {
    id: "claude-code-4",
    subject: "Claude Code CLI throws connection errors",
    issue: "Whenever I run `claude` in my terminal to start Claude Code, it fails with 'api.anthropic.com connection timed out'. I am behind a corporate firewall. How can I configure a proxy?",
    company: "Claude",
    summary: "Claude Code CLI Network/Proxy issue (Technical)"
  },
  {
    id: "visa-travel-5",
    subject: "Travel notice: Visa card usage in France and Italy",
    issue: "I am traveling to Paris and Rome next week for 10 days. Do I need to notify Visa or set a travel notice on my consumer debit card to prevent it from being blocked for suspicious activity?",
    company: "Visa",
    summary: "Visa card travel notification (General Support)"
  },
  {
    id: "hackerrank-security-6",
    subject: "Report: Vulnerability in SQL assessment sandbox",
    issue: "I discovered a security flaw in your MySQL assessment environment where a candidate can execute a shell injection and read the parent container environment variables. Who do I contact for disclosure?",
    company: "HackerRank",
    summary: "Assessment environment sandbox injection vulnerability (High Risk)"
  },
  {
    id: "claude-government-7",
    subject: "Workspace SSO configuration in Claude for Government",
    issue: "We are onboarding our agency to Claude for Government and want to configure Okta SSO. Where is the SCIM and metadata URL inside the console settings?",
    company: "Claude",
    summary: "Claude Gov workspace SSO mapping request (Product)"
  },
  {
    id: "invalid-query-8",
    subject: "Awesome product!",
    issue: "Just wanted to say hi and thank you! The application interface is incredibly beautiful.",
    company: "None",
    summary: "General greeting / non-support request (Invalid)"
  }
];
