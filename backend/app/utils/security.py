import hashlib
import secrets


def hash_handoff_code(code: str) -> str:
    return hashlib.sha256(code.strip().encode("utf-8")).hexdigest()


def generate_handoff_code() -> str:
    return secrets.randbelow(900_000) + 100_000
