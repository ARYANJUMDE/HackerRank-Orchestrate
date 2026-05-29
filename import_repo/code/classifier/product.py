def classify_product(query: str) -> str:
    q = query.lower()

    if any(k in q for k in ["visa", "card", "transaction", "cheque", "atm", "merchant"]):
        return "Visa"
    if any(k in q for k in ["hackerrank", "assessment", "test", "submission", "candidate",
                              "recruiter", "invite", "reinvite", "mock interview", "screen"]):
        return "HackerRank"
    if any(k in q for k in ["claude", "api", "anthropic", "conversation", "claude.ai",
                              "workspace", "team plan", "enterprise"]):
        return "Claude"

    return "None"
