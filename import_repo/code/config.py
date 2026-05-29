INTENT_KEYWORDS = {
    "billing": ["payment", "charged", "refund", "invoice"],
    "fraud": ["fraud", "unauthorized", "hacked", "stolen"],
    "account_access": ["login", "password", "account", "signin"],
    "technical_issue": ["error", "bug", "not working", "issue"],
    "assessment": ["test", "assessment", "submission"]
}

HIGH_RISK_INTENTS = ["fraud", "billing", "account_access"]

TOP_K = 2