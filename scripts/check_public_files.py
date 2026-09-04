"""Fail when files unsafe for a public source snapshot are tracked."""
from pathlib import Path
import re
import subprocess
import sys

root = Path(__file__).resolve().parents[1]
tracked = subprocess.check_output(["git", "ls-files", "-z"], cwd=root).decode().split("\0")
tracked = [item for item in tracked if item]
unsafe_names = {".env", "credentials.json", "service-account.json"}
unsafe_suffixes = (".sqlite", ".sqlite3", ".db", ".bak", ".backup", ".dump", ".pem", ".key", ".p12", ".pfx")
secret_patterns = [
    re.compile(r"-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----"),
    re.compile(r"gh[pousr]_[A-Za-z0-9_]{30,}"),
    re.compile(r"(?:AKIA|ASIA)[A-Z0-9]{16}"),
]
violations = []
for relative in tracked:
    path = root / relative
    lowered = relative.lower()
    name = path.name.lower()
    if name in unsafe_names or (name.startswith(".env.") and not name.endswith(".example")) or lowered.endswith(unsafe_suffixes):
        violations.append(f"unsafe tracked path: {relative}")
        continue
    try:
        text = path.read_text(encoding="utf-8")
    except (UnicodeDecodeError, OSError):
        continue
    if any(pattern.search(text) for pattern in secret_patterns):
        violations.append(f"credential-like content: {relative}")
if violations:
    print("Public snapshot check failed:")
    print("\n".join(f"- {item}" for item in violations))
    raise SystemExit(1)
print(f"Public snapshot check passed ({len(tracked)} tracked files).")
