"""Evidence-bound generation: every factual statement must cite verifiable source text."""
from grounding.evidence import Evidence, EvidenceKind, EvidenceStore
from grounding.generator import GroundedResult, InsufficientEvidence, generate_grounded_sections
from grounding.verifier import Claim, VerifiedClaim, verify_claim

__all__ = [
    "Claim", "Evidence", "EvidenceKind", "EvidenceStore", "GroundedResult",
    "InsufficientEvidence", "VerifiedClaim", "generate_grounded_sections", "verify_claim",
]
