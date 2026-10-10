#!/usr/bin/env python3
"""Generate professional Open Graph social preview image (1200x630)"""
from PIL import Image, ImageDraw, ImageFont
import os

# Create 1200x630 image
img = Image.new('RGB', (1200, 630), color='#0B0B10')
draw = ImageDraw.Draw(img)

# Background: dark F1-themed gradient
for y in range(630):
    progress = y / 630
    # Deep charcoal to F1 red gradient
    r = int(11 + (200 - 11) * (progress * 0.3))
    g = int(11 + (16 - 11) * (progress * 0.3))
    b = int(16 + (20 - 16) * (progress * 0.3))
    draw.line([(0, y), (1200, y)], fill=(r, g, b))

# Subtle circuit pattern - diagonal lines
for i in range(-630, 1200, 60):
    draw.line([(i, 0), (i + 630, 630)], fill=(255, 255, 255, 6), width=1)

# Subtle grid pattern
for x in range(0, 1200, 100):
    draw.line([(x, 0), (x, 630)], fill=(255, 255, 255, 3), width=1)

# Load fonts
try:
    font_f1 = ImageFont.truetype("/System/Library/Fonts/HelveticaNeue-Bold.ttf", 140)
    font_title = ImageFont.truetype("/System/Library/Fonts/HelveticaNeue-Bold.ttf", 68)
    font_sub = ImageFont.truetype("/System/Library/Fonts/HelveticaNeue.ttf", 28)
    font_tag = ImageFont.truetype("/System/Library/Fonts/HelveticaNeue-Medium.ttf", 22)
    font_small = ImageFont.truetype("/System/Library/Fonts/HelveticaNeue.ttf", 24)
except:
    font_f1 = ImageFont.load_default()
    font_title = ImageFont.load_default()
    font_sub = ImageFont.load_default()
    font_tag = ImageFont.load_default()
    font_small = ImageFont.load_default()

# Left margin
MARGIN = 100

# F1 Logo mark - stylized "F1" in red with checkered accent
draw.text((MARGIN, 40), "F1", font=font_f1, fill="#E31E24")

# Checkered flag accent next to F1
f1_width = draw.textbbox((0, 0), "F1", font=font_f1)[2]
flag_x = MARGIN + f1_width + 18
for i in range(5):
    for j in range(5):
        if (i + j) % 2 == 0:
            draw.rectangle(
                [flag_x + i * 10, 52 + j * 10, flag_x + (i + 1) * 10, 52 + (j + 1) * 10],
                fill="#E31E24"
            )

# Main title
draw.text((MARGIN, 200), "F1 DataStop", font=font_title, fill="#FFFFFF")

# Subtitle
draw.text((MARGIN, 290), "Formula 1 Data Analysis Platform", font=font_sub, fill="#A0A0A0")

# Feature tags
tags = ["Timing", "Telemetry", "Charts", "Standings"]
x = MARGIN
for tag in tags:
    bbox = draw.textbbox((0, 0), tag, font=font_tag)
    w = bbox[2] - bbox[0]
    # Tag background
    draw.rounded_rectangle([x, 370, x + w + 28, 420], radius=20, fill="#1A1A20")
    draw.rounded_rectangle([x, 370, x + w + 28, 420], radius=20, outline="#E31E24", width=2)
    draw.text((x + 14, 382), tag, font=font_tag, fill="#FFFFFF")
    x += w + 42

# Divider line
draw.line([(MARGIN, 460), (1100, 460)], fill="#E31E24", width=3)

# URL
draw.text((MARGIN, 485), "f1datastop.com", font=font_small, fill="#666666")

# Bottom accent - thin red line
draw.line([(MARGIN, 540), (1100, 540)], fill="#E31E24", width=1)

# Save high quality
img.save("og-image.png", "PNG", quality=95, optimize=True)
print("Generated og-image.png (1200x630)")
