"""Crop the app screenshots used in the deck into docs/deck/assets/.

Usage: python prep_images.py <folder with the screenshots>
Expects captures at deviceScaleFactor 2 (phones 780 px wide, bank 2880 px):
08-customer-amount, 09-soundbox-payments, 12-merchant-proofs, 15-merchant-hold, 16-bank-hold.
Only needed when the screenshots change; build.js reads assets/ directly.
"""
import os
import sys

from PIL import Image

SRC = sys.argv[1]
OUT = os.path.join(os.path.dirname(os.path.abspath(__file__)), "assets")
os.makedirs(OUT, exist_ok=True)


def load(name):
    return Image.open(os.path.join(SRC, name)).convert("RGB")


def save(im, out):
    im.save(os.path.join(OUT, out), optimize=True)
    print(out, im.size)


def crop(name, box, out):
    save(load(name).crop(box), out)


def stack(name, boxes, out, gap=24):
    """Cut several horizontal bands from one capture and stack them, on its own background."""
    im = load(name)
    parts = [im.crop(b) for b in boxes]
    w = max(p.width for p in parts)
    h = sum(p.height for p in parts) + gap * (len(parts) - 1)
    canvas = Image.new("RGB", (w, h), im.getpixel((4, 4)))
    y = 0
    for p in parts:
        canvas.paste(p, (0, y))
        y += p.height + gap
    save(canvas, out)


# Customer: pay ₹826 (header, amount, pay-from, Pay button).
crop("08-customer-amount.png", (0, 0, 780, 1668), "customer.png")
# Soundbox: the ₹826 BILL-0001 display, the "speak the bill" prompt, and the recent list.
stack("09-soundbox-payments.png", [
    (0, 30, 780, 400),      # device header + ₹826 BILL-0001
    (0, 1080, 780, 1265),   # बोलकर बिल बनाइए: रक़म और सामान + subtitle
    (0, 1650, 780, 2180),   # पिछले पेमेंट: ₹826 BILL-0001 tag, ₹560, ₹40, ₹1,240
], "soundbox.png")
# Merchant सबूत (Proofs) tab, above the bottom nav bar.
crop("12-merchant-proofs.png", (0, 0, 780, 1555), "merchant-proofs.png")
# Merchant: ₹826 पर रोक, Hindi explanation, start of the two questions (above the nav bar).
crop("15-merchant-hold.png", (0, 0, 780, 1560), "merchant-hold.png")
# Bank console: report, restrict, grievance cards.
crop("16-bank-hold.png", (320, 190, 2560, 1490), "bank.png")
