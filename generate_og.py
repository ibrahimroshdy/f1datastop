#!/usr/bin/env python3
"""Generate Open Graph social preview image (1200x630)"""
from PIL import Image, ImageDraw, ImageFont
import os

# Create 1200x630 image
img = Image.new('RGB', (1200, 630), color='#0a0a0f')
draw = ImageDraw.Draw(img)

# F1 Red gradient background - top to bottom
for y in range(630):
    progress = y / 630
    r = int(15 + (180 - 15) * progress)
    g = int(8 + (20 - 8) * progress)
    b = int(12 + (15 - 12) * progress)
    draw.line([(0, y), (1200, y)], fill=(r, g, b))

# Add subtle diagonal stripes pattern
for i in range(-630, 1200, 40):
    draw.line([(i, 0), (i + 630, 630)], fill=(255, 255, 255, 8), width=2)

# F1 Logo - drawn with text
try:
    font_logo = ImageFont.truetype("/System/Library/Fonts/HelveticaNeue-Bold.ttf", 120)
    font_big = ImageFont.truetype("/System/Library/Fonts/HelveticaNeue-Bold.ttf", 72)
    font_small = ImageFont.truetype("/System/Library/Fonts/HelveticaNeue.ttf", 28)
    font_tag = ImageFont.truetype("/System/Library/Fonts/HelveticaNeue-Medium.ttf", 22)
except:
    font_logo = ImageFont.load_default()
    font_big = ImageFont.load_default()
    font_small = ImageFont.load_default()
    font_tag = ImageFont.load_default()

# F1 Logo - red "F1" with flag
draw.text((80, 60), "F1", font=font_logo, fill="#E31E24")
# Small checkered flag next to F1
flag_x = 80 + draw.textbbox((0, 0), "F1", font=font_logo)[2] + 10
for i in range(4):
    for j in range(4):
        if (i + j) % 2 == 0:
            draw.rectangle([flag_x + i*8, 70 + j*8, flag_x + (i+1)*8, 70 + (j+1)*8], fill="#E31E24")

# Main title
draw.text((80, 220), "F1 DataStop", font=font_big, fill="#FFFFFF")

# Subtitle
draw.text((80, 310), "Formula 1 Data Analysis Platform", font=font_small, fill="#CCCCCC")

# Tags
tags = ["Live Timing", "Telemetry", "Charts", "Standings"]
x = 80
for tag in tags:
    bbox = draw.textbbox((0, 0), tag, font=font_tag)
    w = bbox[2] - bbox[0]
    draw.rounded_rectangle([x, 380, x + w + 24, 424], radius=18, fill="#E31E24")
    draw.text((x + 12, 388), tag, font=font_tag, fill="#FFFFFF")
    x += w + 34

# URL
draw.text((80, 480), "f1datastop.com", font=font_small, fill="#888888")

# Bottom accent line
draw.line([(80, 530), (1120, 530)], fill="#E31E24", width=3)

# Save
img.save("og-image.png", "PNG", quality=95)
print("Generated og-image.png (1200x630)")
