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
    The mark: a seven built from a market advance.

    A '7' whose horizontal bar is the resistance level and whose diagonal is
    the breakout leg through it. It reads as both the brand initial and a
    price making a higher high — flat geometry, hard edges, no gradient or
    glow, consistent with the rest of the UI.
    """
    S = size * SS
    img = Image.new("RGBA", (S, S), bg if bg else (0, 0, 0, 0))
    d = ImageDraw.Draw(img)

    if accent is None:
        accent = fg

    m = S * inset               # margin
    w = S - 2 * m               # drawing box
    stroke = int(w * 0.135)     # bar weight

    # Horizontal bar of the 7 — the level being broken.
    bar_y = m + w * 0.16
    d.rectangle([m, bar_y - stroke / 2, m + w, bar_y + stroke / 2], fill=fg)

    # Diagonal leg — the impulse leg. Drawn as a filled quad so the join with
    # the bar stays sharp instead of round-capped.
    top_x = m + w * 0.93
    bot_x = m + w * 0.34
    bot_y = m + w
    half = stroke / 2
    d.polygon(
        [
            (top_x - half, bar_y - half),
            (top_x + half, bar_y - half),
            (bot_x + half, bot_y),
            (bot_x - half, bot_y),
        ],
        fill=fg,
    )

    # Breakout candle: pierces the level rather than floating above it.
    # A mark that merely sits near the bar reads as a stray dash; one that
    # crosses it reads as price closing through resistance, which is the whole
    # idea of the glyph.
    body_w = stroke * 0.66
    body_x = m + w * 0.085
    d.rectangle(
        [body_x, bar_y - stroke * 2.05, body_x + body_w, bar_y + stroke * 1.15],
        fill=accent,
    )
    # Wick, centred on the body.
    wick_w = max(1, body_w * 0.26)
    wick_x = body_x + (body_w - wick_w) / 2
    d.rectangle(
        [wick_x, bar_y - stroke * 2.95, wick_x + wick_w, bar_y + stroke * 1.75],
        fill=accent,
    )

    # Optically centre on the drawn ink. The candle's upper wick extends the
    # glyph past the nominal drawing box, so a mathematically centred layout
    # sits visibly high in the launcher mask.
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
