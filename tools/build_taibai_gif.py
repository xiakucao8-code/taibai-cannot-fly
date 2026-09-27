"""Compose the four approved Taibai pose sprites into a silent gameplay preview GIF."""

from pathlib import Path
import math
from PIL import Image, ImageDraw, ImageFont


ROOT = Path(__file__).resolve().parents[1]
ART = ROOT / "assets" / "art"
OUT = ROOT / "preview" / "taibai_flight_preview.gif"
WIDTH, HEIGHT = 360, 640
FPS, SECONDS = 12, 5.8
FRAME_COUNT = round(FPS * SECONDS)

poses = {}
for state in ("idle", "rise", "fall", "hit"):
    path = ART / "characters" / "taibai" / f"taibai_{state}.png"
    with Image.open(path) as source:
        poses[state] = source.convert("RGBA").resize((186, 124), Image.Resampling.LANCZOS)

with Image.open(ART / "backgrounds" / "bg_tiangong_sky.png") as source:
    sky = source.convert("RGB").resize((WIDTH, HEIGHT), Image.Resampling.LANCZOS).convert("RGBA")
with Image.open(ART / "backgrounds" / "bg_tiangong_far_islands.png") as source:
    far = source.convert("RGBA").resize((360, 240), Image.Resampling.LANCZOS)
far.putalpha(far.getchannel("A").point(lambda value: round(value * .38)))

font_path = "C:/Windows/Fonts/msyh.ttc"
font_label = ImageFont.truetype(font_path, 20)
font_hint = ImageFont.truetype(font_path, 14)


def ease_out_cubic(u):
    return 1 - (1 - u) ** 3


def ease_in_quad(u):
    return u * u


def position_and_state(t):
    if t < 1.0:
        return "idle", 305 + 5 * math.sin(t * 2 * math.pi / 1.0), -1.5 * math.sin(t * 2 * math.pi), "待机 · 空中悬浮", "轻轻上下漂浮，等待玩家按住屏幕"
    if t < 2.7:
        u = (t - 1.0) / 1.7
        return "rise", 305 - 120 * ease_out_cubic(u), -9 + math.sin(t * 9) * 1.5, "长按 · 持续上升", "按住时提气，身体向上飞"
    if t < 4.45:
        u = (t - 2.7) / 1.75
        return "fall", 185 + 228 * ease_in_quad(u), 7 + u * 4, "松开 · 自由下落", "松开后重力逐渐带动下落"
    if t < 4.9:
        return "hit", 413 + math.sin((t - 4.45) * 48) * 4, math.sin((t - 4.45) * 40) * 5, "碰撞 · 结束本局", "受击后短暂停顿，随后重新待机"
    return "idle", 305 + 5 * math.sin((t - 4.9) * 2 * math.pi), 0, "待机 · 再来一次", "角色回到起点，可以重新开始"


frames = []
for index in range(FRAME_COUNT):
    t = index / FPS
    state, y, rotation, label, hint = position_and_state(t)
    canvas = sky.copy()
    # The far islands travel gently to suggest forward flight. The fixed sky
    # and HUD keep the focus on Taibai's posture.
    dx = round(-22 * t / SECONDS)
    canvas.alpha_composite(far, (-34 + dx, 325))

    pose = poses[state]
    if state == "idle":
        stretch = 1.0 + .008 * math.sin(t * 2 * math.pi)
        pose = pose.resize((round(186 * stretch), round(124 / stretch)), Image.Resampling.BICUBIC)
    pose = pose.rotate(-rotation, Image.Resampling.BICUBIC, expand=True)
    x = round(168 - pose.width / 2)
    top = round(y - pose.height / 2)
    canvas.alpha_composite(pose, (x, top))

    draw = ImageDraw.Draw(canvas, "RGBA")
    draw.rounded_rectangle((15, 18, 345, 75), radius=17, fill=(28, 48, 66, 194))
    draw.text((29, 22), label, font=font_label, fill=(255, 248, 228, 255))
    draw.rounded_rectangle((15, 555, 345, 617), radius=15, fill=(255, 250, 235, 210))
    draw.text((27, 565), hint, font=font_hint, fill=(34, 52, 67, 255))

    if state == "hit":
        pulse = max(0, 1 - (t - 4.45) / .45)
        cx, cy = 168, round(y)
        radius = round(45 + (1 - pulse) * 45)
        draw.ellipse((cx-radius, cy-radius, cx+radius, cy+radius),
                     outline=(255, 246, 195, round(170 * pulse)), width=3)

    # A common adaptive palette is derived from the unchanging sky; colors
    # are quantized per frame to keep a compact, broadly compatible GIF.
    frames.append(canvas.convert("RGB").quantize(colors=192, method=Image.Quantize.FASTOCTREE))

OUT.parent.mkdir(parents=True, exist_ok=True)
frames[0].save(OUT, format="GIF", save_all=True, append_images=frames[1:],
               duration=round(1000 / FPS), loop=0, disposal=2, optimize=True)
print(f"{OUT} | {FRAME_COUNT} frames | {OUT.stat().st_size / 1048576:.2f} MiB")
