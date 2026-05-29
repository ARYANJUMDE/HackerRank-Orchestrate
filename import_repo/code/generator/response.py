import re


ESCALATION_MESSAGES = {
    "fraud": "This issue has been flagged as a potential fraud or security concern and has been escalated to our specialist team. Please do not share any sensitive information. A member of our team will contact you shortly.",
    "security": "Thank you for reporting this security concern. This has been escalated to our security team for immediate review. We take all security reports seriously and will follow up with you directly.",
    "outage": "We have detected a potential service disruption. This issue has been escalated to our engineering team for urgent investigation. Please check our status page for live updates.",
    "billing": "Your billing concern has been escalated to our finance team who will review your account and contact you directly.",
    "card_blocked": "Your card issue has been escalated to our card services team. For urgent assistance, please contact your card issuer directly.",
    "account_access": "Your account access issue has been escalated to our account security team. We will review your case and respond within 24 hours.",
}

DEFAULT_ESCALATION = "This issue has been escalated to our support team. A specialist will review your case and respond shortly."


def extract_body(text):
    lines = text.split("\n")

    frontmatter_done = False
    fence_count = 0
    body_lines = []

    for line in lines:
        stripped = line.strip()

        if not frontmatter_done:
            if stripped == "---":
                fence_count += 1
                if fence_count >= 2:
                    frontmatter_done = True
                continue
            elif fence_count == 0 and stripped:
                frontmatter_done = True
            else:
                continue

        if stripped.startswith("#"):
            continue

        if stripped.startswith("_Last updated") or stripped.startswith("_Last modified"):
            continue

        if stripped.lower().startswith("## related") or stripped.lower() == "related articles":
            break

        if stripped.startswith("!["):
            continue

        if stripped == "\\":
            continue

        body_lines.append(line)

    body = "\n".join(body_lines).strip()

    body = re.sub(r'!\[.*?\]\(.*?\)', '', body)
    body = re.sub(r'\n{3,}', '\n\n', body)

    return body.strip()


def clean_response(text, max_chars=1200):
    lines = text.split("\n")
    cleaned = []

    for line in lines:
        stripped = line.strip()

        if not stripped:
            if cleaned and cleaned[-1] != "":
                cleaned.append("")
            continue

        stripped = re.sub(r'\*\*(.*?)\*\*', r'\1', stripped)
        stripped = re.sub(r'\*(.*?)\*', r'\1', stripped)
        stripped = re.sub(r'`(.*?)`', r'\1', stripped)

        if stripped.startswith("- ") or stripped.startswith("* "):
            stripped = "• " + stripped[2:]
        elif re.match(r'^\d+\.\s', stripped):
            pass

        cleaned.append(stripped)

    result = "\n".join(cleaned).strip()
    result = re.sub(r'\n{3,}', '\n\n', result)

    if len(result) > max_chars:
        truncated = result[:max_chars]
        last_period = truncated.rfind('.')
        if last_period > max_chars * 0.6:
            result = truncated[:last_period + 1]
        else:
            result = truncated.rstrip() + "..."

    return result


def generate_response(query, docs, escalate, request_type="product_issue", intent="general"):
    if escalate:
        msg = ESCALATION_MESSAGES.get(intent, DEFAULT_ESCALATION)
        return msg

    if request_type == "invalid":
        q = query.lower().strip()
        greetings = ["thank", "thanks", "hi", "hello", "bye", "good morning",
                     "good afternoon", "good evening", "great", "awesome", "perfect"]
        if any(q.startswith(w) or q == w for w in greetings) and len(q.split()) < 8:
            return "Happy to help! Is there anything else I can assist you with?"
        return "I'm sorry, but this request falls outside the scope of our support services. If you have questions about HackerRank, Claude, or Visa, we'd be happy to help."

    if not docs:
        return "We couldn't find specific documentation for your query. Please contact our support team directly for further assistance."

    body = extract_body(docs[0].text)
    if not body or len(body) < 20:
        return "We couldn't find specific documentation for your query. Please contact our support team directly for further assistance."

    return clean_response(body)
