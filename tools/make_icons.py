#!/usr/bin/env python3
"""
Generate every app icon from one vector-style definition.

The shipped icons were a single 1024x1024 JPEG copied six times and renamed
.png: no alpha channel (so Android's adaptive mask and the web favicon could
not cut it out), a photoreal 3D diamond that contradicts the flat amber
"Trading Desk" identity, and 5.4 MB of duplicated bytes in the repo.

Drawing them here means the marks are reproducible, exact in colour, and
regenerate in seconds when the palette moves. Run:  python3 tools/make_icons.py
"""
from PIL import Image, ImageDraw
import os

# Palette — must track src/theme/index.ts
AMBER      = (255, 159, 28, 255)   # colors.primary
BACKGROUND = (10, 10, 11, 255)     # colors.background
TEXT       = (245, 243, 240, 255)  # colors.textPrimary
GREEN      = (43, 213, 118, 255)   # colors.green

SS = 8  # supersampling factor; drawn big then reduced for clean edges

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
ASSETS = os.path.join(ROOT, "assets")
SRC_ASSETS = os.path.join(ROOT, "src", "assets")


def draw_mark(size, fg=AMBER, accent=None, bg=None, inset=0.22):
    """
    The mark: a bold '7' with an ascending step motif in its counter.

    The previous version speared a candlestick straight through the horizontal
    bar of the 7. At icon scale that reads as two shapes colliding -- a
    misalignment rather than a symbol -- and the thin wick vanished entirely
    below ~48px, leaving an orange smudge on the numeral.

    This one keeps the shapes separate and legible: a heavy seven, and beneath
    its diagonal three rising bars that sit in the empty triangle the numeral
    already creates. Nothing overlaps, the negative space does the work, and
    the silhouette survives being shrunk to a favicon or flattened to a
    single-colour themed icon.
    """
    S = size * SS
    img = Image.new("RGBA", (S, S), bg if bg else (0, 0, 0, 0))
    d = ImageDraw.Draw(img)

    if accent is None:
        accent = fg

    m = S * inset
    w = S - 2 * m
    stroke = int(w * 0.155)

    # Top bar of the 7.
    bar_y = m + w * 0.085
    d.rounded_rectangle(
        [m, bar_y, m + w, bar_y + stroke],
        radius=stroke * 0.16,
        fill=fg,
    )

    # Diagonal leg, as a filled quad so the corner with the bar stays crisp.
    top_x = m + w
    bot_x = m + w * 0.52
    bot_y = m + w
    d.polygon(
        [
            (top_x - stroke, bar_y + stroke),
            (top_x, bar_y + stroke),
            (bot_x, bot_y),
            (bot_x - stroke, bot_y),
        ],
        fill=fg,
    )

    # Ascending bars in the counter of the 7 -- the journal's own subject.
    # Sized and placed to clear the diagonal with real breathing room, so the
    # mark never looks like two overlapping glyphs.
    bar_w = w * 0.085
    gap = w * 0.048
    base_y = m + w * 0.97
    heights = [w * 0.15, w * 0.23, w * 0.31]
    x = m + w * 0.0
    for i, h in enumerate(heights):
        d.rounded_rectangle(
            [x, base_y - h, x + bar_w, base_y],
            radius=bar_w * 0.22,
            fill=accent if i == len(heights) - 1 else fg,
        )
        x += bar_w + gap

    # Optically centre on the drawn ink rather than the nominal box.
    bbox = img.getbbox()
    if bbox:
        cx = (bbox[0] + bbox[2]) / 2
        cy = (bbox[1] + bbox[3]) / 2
        dx, dy = int(round(S / 2 - cx)), int(round(S / 2 - cy))
        if dx or dy:
            shifted = Image.new("RGBA", (S, S), bg if bg else (0, 0, 0, 0))
            shifted.paste(img, (dx, dy), img)
            img = shifted

    return img.resize((size, size), Image.LANCZOS)


def compose(size, bg, inset=0.22, fg=AMBER, accent=None):
    base = Image.new("RGBA", (size, size), bg)
    mark = draw_mark(size, fg=fg, accent=accent, inset=inset)
    base.alpha_composite(mark)
    return base


def save(img, *paths):
    for p in paths:
        os.makedirs(os.path.dirname(p), exist_ok=True)
        img.save(p, "PNG", optimize=True)
        print(f"  {os.path.relpath(p, ROOT):48} {img.size[0]}x{img.size[1]} {img.mode}")


print("Generating icons")

# iOS / store icon: opaque, no transparency allowed by App Store.
save(compose(1024, BACKGROUND, inset=0.24, accent=GREEN),
     os.path.join(ASSETS, "icon.png"))

# Android adaptive foreground: TRANSPARENT, and safe-zone aware. Only the
# centre 66% survives the mask on a circular launcher, so the glyph is inset
# far more than on the flat icon.
save(draw_mark(1024, fg=AMBER, accent=GREEN, inset=0.34),
     os.path.join(ASSETS, "android-icon-foreground.png"))

# Android monochrome (themed icons, Android 13+): a single-colour silhouette.
# The old file was a photoreal image, which the OS cannot tint.
save(draw_mark(1024, fg=(255, 255, 255, 255), accent=(255, 255, 255, 255), inset=0.34),
     os.path.join(ASSETS, "android-icon-monochrome.png"))

# Adaptive background: flat colour, matching app.json.
save(Image.new("RGBA", (1024, 1024), BACKGROUND),
     os.path.join(ASSETS, "android-icon-background.png"))

# Splash: transparent so it sits on the configured background colour.
save(draw_mark(1024, fg=AMBER, accent=GREEN, inset=0.30),
     os.path.join(ASSETS, "splash-icon.png"))

# Favicon: small, so the mark is tightened to stay legible at 48px.
save(compose(196, BACKGROUND, inset=0.20, accent=GREEN),
     os.path.join(ASSETS, "favicon.png"))

# In-app wordmark glyph, transparent, used by AuthScreen / TopAccountBar /
# splash / lock screen. Rendered at 512 since it is never shown larger.
save(draw_mark(512, fg=AMBER, accent=GREEN, inset=0.16),
     os.path.join(SRC_ASSETS, "seven_tracking_logo.png"))

print("Done.")
