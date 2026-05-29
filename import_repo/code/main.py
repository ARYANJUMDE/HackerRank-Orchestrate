import os
import csv
import glob

from classifier.intent import classify_intent, get_request_type
from classifier.product import classify_product
from safety.escalation import should_escalate
from retrieval.retriever import Retriever
from generator.response import generate_response
from utils.csv_handler import write_output
from utils.logger import init_log, log_step


def load_corpus(base_path):
    docs = []

    for root, _, files in os.walk(base_path):
        for file in files:
            file_path = os.path.join(root, file)

            try:
                with open(file_path, "r", encoding="utf-8") as f:
                    text = f.read().strip()

                    if len(text) > 50:
                        docs.append((text, file_path))

            except Exception:
                continue

    return docs


def get_product_area(doc_path, base_path):
    try:
        rel = os.path.relpath(doc_path, base_path)
        parts = rel.replace("\\", "/").split("/")

        area_map = {
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
        }

        for part in reversed(parts[:-1]):
            if part in area_map:
                return area_map[part]

        if len(parts) >= 2:
            return parts[1].replace("-", " ").replace("_", " ").title()

    except Exception:
        pass

    return "General"


def process_ticket(row, retriever, corpus_path):
    query = (
        (row.get("Subject") or "") + " " +
        (row.get("Issue") or "")
    ).strip()

    if not query:
        return None

    intent = classify_intent(query)

    company = row.get("Company", "").strip()
    if not company or company.lower() in ["none", "", "unknown"]:
        company = classify_product(query)
    elif company.lower() == "unknown":
        company = "None"
    company = company.strip()

    request_type = get_request_type(intent, query, company)

    docs = retriever.search(query)

    escalate = should_escalate(intent, docs, request_type, company)
    status = "escalated" if escalate else "replied"

    response = generate_response(query, docs, escalate, request_type, intent)

    product_area = ""
    if docs:
        product_area = get_product_area(docs[0].path, os.path.abspath(corpus_path))

    justification = (
        f"intent={intent}; "
        f"company={company}; "
        f"request_type={request_type}; "
        f"docs_found={len(docs)}; "
        f"escalated={escalate}"
    )

    return {
        "issue": row.get("Issue", ""),
        "subject": row.get("Subject", ""),
        "company": company,
        "response": response,
        "product_area": product_area,
        "status": status,
        "request_type": request_type,
        "justification": justification,
    }


def main():
    corpus_path = "../data/"
    tickets_path = "../support_tickets/**/*.csv"

    os.makedirs("../output", exist_ok=True)
    init_log("../output/log.txt")

    corpus_docs = load_corpus(corpus_path)
    print(f"Loaded {len(corpus_docs)} documents")

    retriever = Retriever(corpus_docs)

    rows = []

    ticket_files = glob.glob(tickets_path, recursive=True)
    ticket_files = [f for f in ticket_files if "sample" not in f.lower() and "output" not in f.lower()]
    print(f"Found {len(ticket_files)} ticket files")

    for file in ticket_files:
        with open(file, "r", encoding="utf-8") as f:
            reader = csv.DictReader(f)

            for row in reader:
                result = process_ticket(row, retriever, corpus_path)
                if result is None:
                    continue

                rows.append([
                    result["issue"],
                    result["subject"],
                    result["company"],
                    result["response"],
                    result["product_area"],
                    result["status"],
                    result["request_type"],
                    result["justification"],
                ])

                log_step(
                    "../output/log.txt",
                    f"subject={result['subject'][:50]} | intent=? | company={result['company']} | status={result['status']} | request_type={result['request_type']}"
                )

    write_output("../output/output.csv", rows)
    print(f"Wrote {len(rows)} rows to output.csv")


if __name__ == "__main__":
    main()
