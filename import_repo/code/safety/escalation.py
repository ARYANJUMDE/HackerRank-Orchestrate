ALWAYS_ESCALATE_INTENTS = ["fraud", "security"]
ESCALATE_NO_DOCS_INTENTS = ["outage", "billing", "account_access", "account_management"]
FINANCIAL_ESCALATE_INTENTS = ["billing", "card_blocked"]
FINANCIAL_PRODUCTS = ["visa"]
SENSITIVE_INTENTS = ["privacy"]


def should_escalate(intent: str, retrieved_docs: list, request_type: str, company: str = "") -> bool:
    if request_type == "invalid":
        return False

    if intent in ALWAYS_ESCALATE_INTENTS:
        return True

    if intent in FINANCIAL_ESCALATE_INTENTS and company.lower() in FINANCIAL_PRODUCTS:
        return True

    if intent == "outage":
        return True

    if intent in ESCALATE_NO_DOCS_INTENTS and not retrieved_docs:
        return True

    if intent == "privacy" and not retrieved_docs:
        return True

    if not retrieved_docs:
        return True

    return False
