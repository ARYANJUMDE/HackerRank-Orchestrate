def classify_intent(query: str) -> str:
    q = query.lower()

    if any(w in q for w in [
        "fraud", "unauthorized", "identity theft", "identity has been stolen",
        "scam", "phishing", "account takeover"
    ]):
        return "fraud"

    if any(w in q for w in [
        "security vulnerability", "vulnerability", "bug bounty", "security flaw",
        "security issue", "exploit", "injection", "xss", "sql injection",
        "zero day", "cve", "responsible disclosure"
    ]):
        return "security"

    if any(w in q for w in [
        "payment", "charged", "refund", "invoice", "billing",
        "cheque", "dispute", "money", "cash", "transaction",
        "subscription", "plan", "pricing", "cost", "fee"
    ]):
        return "billing"

    if any(w in q for w in [
        "login", "password", "delete my account", "sign in",
        "access lost", "locked out", "forgot password", "reset password",
        "account deleted", "remove my account"
    ]):
        return "account_access"

    if any(w in q for w in [
        "hacked", "stolen", "compromised"
    ]):
        return "fraud"

    if any(w in q for w in [
        "site is down", "pages are accessible", "not accessible",
        "system down", "down completely", "is down",
        "stopped working", "completely", "none of the", "all requests"
    ]):
        return "outage"

    if any(w in q for w in [
        "card blocked", "bloquée", "bloqueada", "blocked",
        "been blocked"
    ]):
        return "card_blocked"

    if any(w in q for w in [
        "error", "not working", "not responding",
        "broken", "crash", "failed", "failing", "can't access",
        "cannot access", "unable to", "cannot", "blocker",
        "issue", "problem", "doesn't work", "won't work"
    ]):
        return "bug"

    if any(w in q for w in [
        "test", "assessment", "submission", "candidate", "invite",
        "reinvite", "recruiter", "score", "variant", "resume builder",
        "certificate", "mock interview", "resume"
    ]):
        return "assessment"

    if any(w in q for w in [
        "would like to", "can you add", "suggestion", "improvement",
        "please add", "feature request", "request a feature", "wish",
        "could you", "it would be nice"
    ]):
        return "feature_request"

    if any(w in q for w in [
        "crawl", "scrape", "data collection", "training data",
        "opt out", "data use", "privacy", "gdpr", "data retention"
    ]):
        return "privacy"

    if any(w in q for w in [
        "remove", "delete", "disable", "pause", "cancel",
        "add user", "remove user", "employee", "seat", "workspace",
        "account management", "admin"
    ]):
        return "account_management"

    return "general"


def get_request_type(intent: str, query: str, company: str = "") -> str:
    q = query.lower().strip()

    known_products = ["hackerrank", "claude", "visa"]

    product_words = [
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
    ]

    if company.lower() in known_products:
        if intent == "outage":
            return "bug"
        if intent == "bug":
            return "bug"
        if intent == "feature_request":
            return "feature_request"
        return "product_issue"

    if not any(k in q for k in product_words):
        return "invalid"

    if intent in ("outage", "bug"):
        return "bug"
    if intent == "feature_request":
        return "feature_request"

    return "product_issue"
