#!/usr/bin/env python3
"""Generate the donation QR codes for the support drawer.

Emits one SVG per payment method into web-landing-page/support/qr/. The SVGs are
self-hosted (served under the site's strict CSP img-src 'self') and scale via
viewBox, so a single file looks crisp at any size.

This shells out to the `qrencode` CLI (the C tool, usually preinstalled on Linux;
`pacman -S qrencode` / `apt install qrencode`). We use it instead of a Python QR
library because this machine's Python is externally managed (no pip), and qrencode
is already present.

Run after editing the PAYMENTS block below (only when an address/link changes):

    python3 build_support_qr.py

IMPORTANT: the same payment values are ALSO used for display in
web-landing-page/support.js (PAYMENTS object there). When you replace a placeholder
here, replace it there too, or the visible address/link and its QR will disagree.
"""

import os
import shutil
import subprocess
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
OUT_DIR = os.path.join(HERE, "web-landing-page", "support", "qr")

# ---------------------------------------------------------------------------
# EDIT THESE. Each value is exactly what the QR will encode.
#   - Revolut / PayPal: the payment URL (so a phone camera opens the app/page).
#   - Crypto: a payment URI (scheme:address) so wallet apps prefill the address.
# Placeholders are obvious on purpose; replace before deploying.
# ---------------------------------------------------------------------------
PAYMENTS = {
    "revolut": "https://revolut.me/kopylow",
    "paypal":  "https://paypal.me/kopylow",
    "btc":     "bitcoin:bc1qlmzpu3neanphpwpl7m0edqevfy45340sutq37j",
    "eth":     "ethereum:0x1C8A2d42a66DF41C3a0467D659f23d6f8b8A59b2",
    "sol":     "solana:7gf3oeu38riHM2g8rTtuFYw6vUeEFDQbkVjTVVwDd8no",
}


def main():
    if not shutil.which("qrencode"):
        sys.exit("qrencode not found. Install it (e.g. `pacman -S qrencode` or "
                 "`apt install qrencode`) and re-run.")

    os.makedirs(OUT_DIR, exist_ok=True)

    for name, data in PAYMENTS.items():
        out = os.path.join(OUT_DIR, f"{name}.svg")
        # -t SVG: scalable output. -m 2: quiet-zone modules (scanners need margin).
        # -l M: medium error correction, a good size/robustness tradeoff for addresses.
        subprocess.run(
            ["qrencode", "-t", "SVG", "-o", out, "-m", "2", "-l", "M", data],
            check=True,
        )
        flag = "  <-- still a placeholder" if "REPLACE_ME" in data else ""
        print(f"wrote {os.path.relpath(out, HERE)}{flag}")

    if any("REPLACE_ME" in v for v in PAYMENTS.values()):
        print("\nNote: some values are still placeholders. Edit PAYMENTS in this "
              "file (and the matching block in web-landing-page/support.js), then "
              "re-run.")


if __name__ == "__main__":
    main()
