import sys
import os

sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..', 'code'))

from flask import Flask, request, jsonify
from flask_cors import CORS
import csv
import io

from classifier.intent import classify_intent, get_request_type
from classifier.product import classify_product
from safety.escalation import should_escalate
from retrieval.retriever import Retriever
from generator.response import generate_response
from utils.csv_handler import write_output

app = Flask(__name__)
CORS(app)

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
CORPUS_PATH = os.path.join(BASE_DIR, '..', 'data')
OUTPUT_CSV = os.path.join(BASE_DIR, '..', 'output', 'output.csv')
TICKETS_CSV = os.path.join(BASE_DIR, '..', 'support_tickets', 'support_tickets.csv')

retriever = None
doc_count = 0


def load_corpus():
    global retriever, doc_count
    docs = []
    for root, _, files in os.walk(CORPUS_PATH):
        for fname in files:
            fpath = os.path.join(root, fname)
            try:
                with open(fpath, 'r', encoding='utf-8') as f:
                    text = f.read().strip()
                    if len(text) > 50:
                        docs.append((text, fpath))
            except Exception:
                continue
    doc_count = len(docs)
    retriever = Retriever(docs)
    print(f"Corpus loaded: {doc_count} documents")


def get_product_area(doc_path):
    try:
        rel = os.path.relpath(doc_path, os.path.abspath(CORPUS_PATH))
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


def process_single(issue, subject, company=""):
    query = (subject + " " + issue).strip()
    if not query:
        return None

    intent = classify_intent(query)

    if not company or company.lower() in ["none", "", "unknown"]:
        company = classify_product(query)
    company = company.strip()

    request_type = get_request_type(intent, query, company)
    docs = retriever.search(query)
    escalate = should_escalate(intent, docs, request_type, company)
    status = "escalated" if escalate else "replied"
    response = generate_response(query, docs, escalate, request_type, intent)
    product_area = get_product_area(docs[0].path) if docs else "General"

    justification = (
        f"intent={intent}; "
        f"company={company}; "
        f"request_type={request_type}; "
        f"docs_found={len(docs)}; "
        f"escalated={escalate}"
    )

    return {
        "issue": issue,
        "subject": subject,
        "company": company,
        "response": response,
        "product_area": product_area,
        "status": status,
        "request_type": request_type,
        "justification": justification,
        "intent": intent,
        "docs_found": len(docs),
    }


@app.route('/api/health')
def health():
    return jsonify({"status": "ok", "doc_count": doc_count})


@app.route('/api/results')
def get_results():
    results = []
    if os.path.exists(OUTPUT_CSV):
        with open(OUTPUT_CSV, 'r', encoding='utf-8') as f:
            reader = csv.DictReader(f)
            for row in reader:
                results.append(dict(row))
    return jsonify(results)


@app.route('/api/stats')
def get_stats():
    results = []
    if os.path.exists(OUTPUT_CSV):
        with open(OUTPUT_CSV, 'r', encoding='utf-8') as f:
            reader = csv.DictReader(f)
            for row in reader:
                results.append(dict(row))

    total = len(results)
    by_company = {}
    by_status = {"replied": 0, "escalated": 0}
    by_request_type = {}

    for r in results:
        company = r.get("company", "Unknown") or "Unknown"
        by_company[company] = by_company.get(company, 0) + 1

        status = r.get("status", "").lower()
        if status in by_status:
            by_status[status] += 1
        else:
            by_status[status] = 1

        rt = r.get("request_type", "unknown") or "unknown"
        by_request_type[rt] = by_request_type.get(rt, 0) + 1

    escalation_rate = round(by_status.get("escalated", 0) / total * 100, 1) if total else 0

    return jsonify({
        "total": total,
        "by_company": by_company,
        "by_status": by_status,
        "by_request_type": by_request_type,
        "escalation_rate": escalation_rate,
        "doc_count": doc_count,
    })


@app.route('/api/process/ticket', methods=['POST'])
def process_ticket_endpoint():
    data = request.get_json()
    if not data:
        return jsonify({"error": "No JSON body provided"}), 400

    issue = data.get("issue", "").strip()
    subject = data.get("subject", "").strip()
    company = data.get("company", "").strip()

    if not issue and not subject:
        return jsonify({"error": "Provide at least 'issue' or 'subject'"}), 400

    result = process_single(issue, subject, company)
    if result is None:
        return jsonify({"error": "Could not process ticket"}), 422

    return jsonify(result)


@app.route('/api/process/csv', methods=['POST'])
def process_csv_endpoint():
    if 'file' not in request.files:
        return jsonify({"error": "No file uploaded. Use multipart/form-data with key 'file'"}), 400

    file = request.files['file']
    if not file.filename.endswith('.csv'):
        return jsonify({"error": "File must be a .csv"}), 400

    content = file.read().decode('utf-8')
    reader = csv.DictReader(io.StringIO(content))

    rows_out = []
    results = []

    for row in reader:
        issue = row.get("Issue", row.get("issue", ""))
        subject = row.get("Subject", row.get("subject", ""))
        company = row.get("Company", row.get("company", ""))

        result = process_single(issue, subject, company)
        if result is None:
            continue

        results.append(result)
        rows_out.append([
            result["issue"], result["subject"], result["company"],
            result["response"], result["product_area"], result["status"],
            result["request_type"], result["justification"]
        ])

    os.makedirs(os.path.dirname(OUTPUT_CSV), exist_ok=True)
    write_output(OUTPUT_CSV, rows_out)

    return jsonify({"processed": len(results), "results": results})


@app.route('/api/reprocess', methods=['POST'])
def reprocess():
    if not os.path.exists(TICKETS_CSV):
        return jsonify({"error": "support_tickets.csv not found"}), 404

    rows_out = []
    results = []

    with open(TICKETS_CSV, 'r', encoding='utf-8') as f:
        reader = csv.DictReader(f)
        for row in reader:
            issue = row.get("Issue", "")
            subject = row.get("Subject", "")
            company = row.get("Company", "")
            result = process_single(issue, subject, company)
            if result is None:
                continue
            results.append(result)
            rows_out.append([
                result["issue"], result["subject"], result["company"],
                result["response"], result["product_area"], result["status"],
                result["request_type"], result["justification"]
            ])

    os.makedirs(os.path.dirname(OUTPUT_CSV), exist_ok=True)
    write_output(OUTPUT_CSV, rows_out)

    return jsonify({"processed": len(results), "results": results})


if __name__ == '__main__':
    load_corpus()
    app.run(host='localhost', port=8000, debug=False)
