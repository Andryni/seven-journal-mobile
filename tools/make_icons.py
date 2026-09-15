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


def draw_mark(size, fg=AMBER, accent=None, bg=None, inset=0.22, baseline=True):
    """
    The mark: a bold '7' standing on a chart baseline.

    Two earlier attempts failed for the same reason -- they put a second
    picture next to the numeral and hoped the two would read as one symbol.
    First a candlestick speared through the horizontal bar. Then three
    ascending bars in the counter, which at launcher size stopped reading as
    bars at all and turned the icon into "a wifi glyph next to a 7".

    This version stops adding objects. The numeral is drawn as one continuous
    stroke with round joins, heavy enough to hold the whole plate, and the only
    other element is a green rule beneath it. That rule is not decoration: it
    is the axis the figure stands on, so the seven becomes a value on a chart
    rather than a digit with an ornament. It also never touches the glyph, so
    there is nothing to collide at any size.

    Drawn amber-on-dark or dark-on-amber depending on `fg`/`bg`; the silhouette
    is identical either way, which is what the Android monochrome slot needs.
    """
    S = size * SS
    img = Image.new("RGBA", (S, S), bg if bg else (0, 0, 0, 0))
    d = ImageDraw.Draw(img)

    if accent is None:
        accent = fg

    m = S * inset
    w = S - 2 * m
    stroke = int(w * 0.144)
    r = stroke / 2

    # Geometry in fractions of the inner box, matched to the reference art.
    # The foot stops short of the bottom to leave the baseline its own air.
    x0, x1 = m, m + w
    y_top = m + w * 0.12
    x_foot = m + w * 0.40
    y_foot = m + w * 0.80

    def dot(x, y):
        d.ellipse([x - r, y - r, x + r, y + r], fill=fg)

    # Top bar and diagonal, as round-capped strokes: one gesture, no seams.
    d.line([(x0, y_top), (x1, y_top)], fill=fg, width=stroke)
    d.line([(x1, y_top), (x_foot, y_foot)], fill=fg, width=stroke, joint="curve")
    dot(x0, y_top)
    dot(x1, y_top)
    dot(x_foot, y_foot)

    # The baseline the numeral stands on.
    if baseline:
        # Inset from the numeral's own width: a rule running the full span
        # competes with the top bar for the eye, and the two equal horizontals
        # made the mark read as a striped block rather than a figure standing
        # on an axis.
        bh = w * 0.072
        by = m + w * 0.92
        bx = w * 0.082
        d.rounded_rectangle([x0 + bx, by, x1 - bx, by + bh], radius=bh / 2, fill=accent)

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
