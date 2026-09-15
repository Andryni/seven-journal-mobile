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


RED = (240, 74, 48, 255)     # colors.red
GRID = (30, 33, 40, 255)     # faint chart rules


def draw_mark(size, fg=AMBER, accent=None, bg=None, inset=0.22, baseline=True,
              scene=True, mono=None):
    """
    The mark: a '7' standing on a chart baseline, with candlesticks printing
    across it.

    Earlier versions kept failing the same way -- a second picture placed
    beside the numeral, hoping the two would read as one symbol. This one
    interlocks them instead. The candles that sit inside the diagonal are
    shaded toward the plate so they recede, and the foreground series is drawn
    with a plate-coloured keyline so the green never dissolves into the amber
    behind it. The empty triangle under the 7 is where a chart naturally goes,
    so nothing has to be shoved aside to make room.

    `scene=False` drops the candles and the grid and draws only the numeral on
    its rule. That is what the small slots use: at 48px the candle bodies stop
    being candles and turn into noise, so the favicon keeps the silhouette and
    loses the detail rather than shipping a smudge.

    `mono` flattens everything to one colour for Android's themed-icon slot,
    which the OS tints itself and cannot do with a multi-colour source.
    """
    S = size * SS
    plate = bg if bg else None
    img = Image.new("RGBA", (S, S), plate if plate else (0, 0, 0, 0))
    d = ImageDraw.Draw(img)

    if accent is None:
        accent = fg

    ink = mono or fg
    rule = mono or accent
    up = mono or GREEN
    down = mono or RED

    m = S * inset
    w = S - 2 * m

    def X(f):
        return m + w * f

    def Y(f):
        return m + w * f

    # Candles inside the diagonal are the ink colour mixed toward the plate,
    # so they read as depth rather than as separate objects.
    def recede(f):
        if mono:
            return mono
        back = plate if plate else BACKGROUND
        return tuple(int(ink[i] * f + back[i] * (1 - f)) for i in range(3)) + (255,)

    if scene and not mono:
        gw = max(1, int(w * 0.006))
        for gx in (0.18, 0.46, 0.74):
            d.line([(X(gx), Y(0.02)), (X(gx), Y(0.98))], fill=GRID, width=gw)
        for gy in (0.22, 0.52, 0.82):
            d.line([(X(0.02), Y(gy)), (X(0.98), Y(gy))], fill=GRID, width=gw)

    # ── The numeral ──
    stroke = int(w * 0.154)
    r = stroke / 2
    x_l, x_r = X(0.04), X(0.92)
    y_top = Y(0.06)
    x_foot, y_foot = X(0.35), Y(0.94)

    d.line([(x_l, y_top), (x_r, y_top)], fill=ink, width=stroke)
    d.line([(x_r, y_top), (x_foot, y_foot)], fill=ink, width=stroke, joint="curve")
    for px, py in ((x_l, y_top), (x_r, y_top), (x_foot, y_foot)):
        d.ellipse([px - r, py - r, px + r, py + r], fill=ink)

    base_y = Y(1.02)

    if scene:
        # Receding candles, climbing the diagonal.
        for cx, top, bot, f in ((0.60, 0.42, 0.68, 0.52),
                                (0.72, 0.30, 0.56, 0.62),
                                (0.83, 0.18, 0.44, 0.72)):
            col = recede(f)
            bw = w * 0.052
            wick = max(1, int(w * 0.016))
            d.line([(X(cx), Y(top - 0.07)), (X(cx), Y(bot + 0.07))], fill=col, width=wick)
            d.rectangle([X(cx) - bw / 2, Y(top), X(cx) + bw / 2, Y(bot)], fill=col)

        # Foreground series, standing on the rule.
        #
        # The separation from the amber behind them is an OUTLINE on each
        # shape, not a filled panel behind it: filling a rectangle blanks out
        # the diagonal and the grid wherever a candle happens to sit, which
        # reads as damage rather than depth.
        key = plate if plate else BACKGROUND
        kw = max(2, int(w * 0.022))
        bw = w * 0.084
        wick_w = max(1, int(w * 0.024))

        def candle(cx, top, bot, col, wick_top, wick_bot):
            x0, x1 = X(cx) - bw / 2, X(cx) + bw / 2
            # Wick: keyline first, then the wick itself over it.
            d.line([(X(cx), Y(wick_top)), (X(cx), Y(wick_bot))],
                   fill=key, width=wick_w + kw)
            d.line([(X(cx), Y(wick_top)), (X(cx), Y(wick_bot))],
                   fill=col, width=wick_w)
            # Body: outlined, then filled.
            d.rectangle([x0 - kw / 2, Y(top) - kw / 2, x1 + kw / 2, Y(bot) + kw / 2],
                        fill=key)
            d.rectangle([x0, Y(top), x1, Y(bot)], fill=col)

        base_f = 1.02
        candle(0.40, 0.60, base_f, up, 0.53, base_f)
        candle(0.55, 0.68, base_f, up, 0.61, base_f)
        # One red print among the wins, floating clear of the rule.
        candle(0.69, 0.76, 0.88, down, 0.69, 0.96)
        candle(0.83, 0.50, base_f, up, 0.43, base_f)

    if baseline:
        bh = w * 0.040
        d.rounded_rectangle([X(-0.02), base_y, X(1.02), base_y + bh],
                            radius=bh / 2, fill=rule)

    # Optically centre on the drawn ink rather than the nominal box.
    bbox = img.getbbox()
    if bbox:
        cx = (bbox[0] + bbox[2]) / 2
        cy = (bbox[1] + bbox[3]) / 2
        dx, dy = int(round(S / 2 - cx)), int(round(S / 2 - cy))
        if dx or dy:
            shifted = Image.new("RGBA", (S, S), plate if plate else (0, 0, 0, 0))
            shifted.paste(img, (dx, dy), img)
            img = shifted

    return img.resize((size, size), Image.LANCZOS)


def compose(size, bg, inset=0.22, fg=AMBER, accent=None, scene=True):
    base = Image.new("RGBA", (size, size), bg)
    mark = draw_mark(size, fg=fg, accent=accent, inset=inset, bg=bg, scene=scene)
    base.alpha_composite(mark)
    return base


def save(img, *paths):
    for p in paths:
        os.makedirs(os.path.dirname(p), exist_ok=True)
        img.save(p, "PNG", optimize=True)
        print(f"  {os.path.relpath(p, ROOT):48} {img.size[0]}x{img.size[1]} {img.mode}")


print("Generating icons")

# iOS / store icon: opaque, no transparency allowed by App Store.
save(compose(1024, BACKGROUND, inset=0.22, accent=GREEN),
     os.path.join(ASSETS, "icon.png"))

# Android adaptive foreground: TRANSPARENT, and safe-zone aware. Only the
# centre 66% survives the mask on a circular launcher, so the glyph is inset
# far more than on the flat icon.
save(draw_mark(1024, fg=AMBER, accent=GREEN, inset=0.32, bg=BACKGROUND),
     os.path.join(ASSETS, "android-icon-foreground.png"))

# Android monochrome (themed icons, Android 13+): a single-colour silhouette.
# The old file was a photoreal image, which the OS cannot tint.
# A tintable silhouette cannot carry the scene: flattened to one colour the
# candles merge with the numeral into a solid blob.
save(draw_mark(1024, inset=0.34, scene=False, mono=(255, 255, 255, 255)),
     os.path.join(ASSETS, "android-icon-monochrome.png"))

# Adaptive background: flat colour, matching app.json.
save(Image.new("RGBA", (1024, 1024), BACKGROUND),
     os.path.join(ASSETS, "android-icon-background.png"))

# Splash: transparent so it sits on the configured background colour.
save(draw_mark(1024, fg=AMBER, accent=GREEN, inset=0.28, bg=BACKGROUND),
     os.path.join(ASSETS, "splash-icon.png"))

# Favicon: rendered large and reduced, so the candles survive the downscale
# instead of being drawn at a size where they alias into noise.
save(compose(1024, BACKGROUND, inset=0.18, accent=GREEN).resize((196, 196), Image.LANCZOS),
     os.path.join(ASSETS, "favicon.png"))

# In-app wordmark glyph, transparent, used by AuthScreen / TopAccountBar /
# splash / lock screen. Rendered at 512 since it is never shown larger.
save(draw_mark(1024, fg=AMBER, accent=GREEN, inset=0.14, bg=BACKGROUND)
     .resize((512, 512), Image.LANCZOS),
     os.path.join(SRC_ASSETS, "seven_tracking_logo.png"))

print("Done.")
