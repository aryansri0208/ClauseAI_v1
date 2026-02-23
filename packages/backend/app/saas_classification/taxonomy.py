"""
SaaS taxonomy: categories, keywords, metadata triggers, and negative signals.

Edit this file to add/change categories or signals. Structure is intentional
for readability and minimal code.
"""

from typing import TypedDict


class CategoryDefinition(TypedDict):
    """Single category in the taxonomy."""
    keywords: list[str]
    metadata_triggers: list[str]
    negative_signals: list[str]


# ---------------------------------------------------------------------------
# Scoring weight constants (used by ClassificationEngine)
# ---------------------------------------------------------------------------
WEIGHT_WEBSITE_KEYWORD = 1.0
WEIGHT_METADATA_MATCH = 1.5
WEIGHT_EXACT_PRODUCT_TAG = 2.0


def get_taxonomy() -> dict[str, CategoryDefinition]:
    """
    Returns the full SaaS taxonomy. Each key is the category label;
    value holds keywords, metadata triggers, and negative signals.
    """
    return {
        "Payments": {
            "keywords": [
                "payment", "payments", "checkout", "billing", "subscription billing",
                "invoicing", "stripe", "stripe-like", "payment gateway", "payment processing",
                "recurring revenue", "merchant", "transaction", "refund", "chargeback",
                "payment method", "card", "ach", "wire", "fintech", "payments api",
            ],
            "metadata_triggers": ["payments", "fintech", "billing", "checkout", "payment"],
            "negative_signals": ["payroll", "salary", "hr payroll"],
        },
        "Analytics": {
            "keywords": [
                "analytics", "dashboard", "metrics", "kpi", "reporting", "data visualization",
                "bi ", "business intelligence", "insights", "funnel", "conversion",
                "tracking", "events", "segmentation", "cohort", "attribution",
            ],
            "metadata_triggers": ["analytics", "bi", "reporting", "metrics", "insights"],
            "negative_signals": [],
        },
        "CRM": {
            "keywords": [
                "crm", "customer relationship", "sales pipeline", "lead", "contact",
                "deal", "opportunity", "sales force", "sales automation", "contact management",
                "account management", "sales engagement", "revenue operations",
            ],
            "metadata_triggers": ["crm", "sales", "lead", "pipeline", "contact"],
            "negative_signals": [],
        },
        "DevTools": {
            "keywords": [
                "developer", "devtools", "api", "sdk", "cli", "ide", "code",
                "ci/cd", "cicd", "continuous integration", "deployment", "git",
                "debug", "logging", "monitoring", "observability", "infrastructure as code",
                "container", "kubernetes", "docker", "serverless", "sre",
            ],
            "metadata_triggers": ["devtools", "developer", "api", "sdk", "ci/cd", "dev"],
            "negative_signals": ["marketing automation", "crm"],
        },
        "Marketing Automation": {
            "keywords": [
                "marketing automation", "email marketing", "campaign", "automation",
                "lead nurturing", "drip", "landing page", "ab test", "a/b test",
                "marketing ops", "demand gen", "content marketing", "seo",
            ],
            "metadata_triggers": ["marketing", "automation", "email", "campaign", "demand gen"],
            "negative_signals": ["crm", "sales pipeline"],
        },
        "HRTech": {
            "keywords": [
                "hr", "human resources", "recruiting", "recruitment", "hiring",
                "payroll", "benefits", "onboarding", "performance", "ats",
                "applicant tracking", "workforce", "employee", "hrms", "hris",
            ],
            "metadata_triggers": ["hr", "hrtech", "recruiting", "payroll", "hiring", "hrms"],
            "negative_signals": [],
        },
        "Cybersecurity": {
            "keywords": [
                "security", "cybersecurity", "sso", "identity", "auth", "mfa",
                "compliance", "soc", "threat", "vulnerability", "pentest",
                "zero trust", "dlp", "siem", "endpoint", "vpn",
            ],
            "metadata_triggers": ["security", "cybersecurity", "sso", "compliance", "identity"],
            "negative_signals": [],
        },
        "Infrastructure": {
            "keywords": [
                "infrastructure", "cloud", "hosting", "cdn", "database", "storage",
                "compute", "server", "edge", "serverless", "iaas", "paas",
                "backup", "disaster recovery", "scaling", "load balancer",
            ],
            "metadata_triggers": ["infrastructure", "cloud", "hosting", "database", "storage"],
            "negative_signals": [],
        },
        "Collaboration": {
            "keywords": [
                "collaboration", "team", "chat", "messaging", "video call",
                "meeting", "slack", "document", "wiki", "project management",
                "async", "remote", "workspace", "whiteboard",
            ],
            "metadata_triggers": ["collaboration", "team", "chat", "messaging", "meeting"],
            "negative_signals": [],
        },
    }
