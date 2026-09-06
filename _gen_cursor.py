# -*- coding: utf-8 -*-
"""生成卡通牛指针 PNG（透明背景，64x64），用于按钮悬停时的自定义光标"""
from PIL import Image, ImageDraw

S = 64
img = Image.new("RGBA", (S, S), (0, 0, 0, 0))
d = ImageDraw.Draw(img)

TAN = (217, 161, 95, 255)        # 头/脸
TAN_D = (200, 138, 69, 255)      # 阴影
CREAM = (246, 228, 196, 255)     # 犄角
BROWN_D = (122, 74, 33, 255)     # 耳朵/轮廓
MUZZLE = (243, 205, 150, 255)    # 口鼻
DARK = (43, 33, 28, 255)
WHITE = (255, 255, 255, 255)
PINK = (232, 150, 130, 255)

# --- 犄角（弯角） ---
d.polygon([(12, 22), (20, 8), (26, 18), (18, 26)], fill=CREAM)
d.polygon([(52, 22), (44, 8), (38, 18), (46, 26)], fill=CREAM)

# --- 耳朵 ---
d.ellipse([2, 24, 18, 42], fill=BROWN_D)
d.ellipse([46, 24, 62, 42], fill=BROWN_D)
d.ellipse([5, 27, 15, 39], fill=PINK)
d.ellipse([49, 27, 59, 39], fill=PINK)

# --- 头（含脸颊、下颌毛） ---
d.ellipse([12, 12, 52, 56], fill=TAN)
# 头顶一撮毛
d.polygon([(28, 14), (34, 4), (37, 14)], fill=CREAM)

# --- 口鼻部 ---
d.ellipse([18, 34, 46, 54], fill=MUZZLE)
d.ellipse([25, 42, 29, 46], fill=DARK)   # 鼻孔
d.ellipse([35, 42, 39, 46], fill=DARK)

# --- 眼睛 ---
d.ellipse([19, 21, 27, 29], fill=WHITE)
d.ellipse([37, 21, 45, 29], fill=WHITE)
d.ellipse([22, 23, 26, 27], fill=DARK)
d.ellipse([40, 23, 44, 27], fill=DARK)
d.ellipse([23, 23.5, 24.5, 25], fill=WHITE)
d.ellipse([41, 23.5, 42.5, 25], fill=WHITE)

# --- 嘴（微笑） ---
d.arc([23, 26, 41, 42], start=25, end=155, fill=DARK, width=2)

img.save(r"C:\Users\86156\Desktop\量化定投策略代码\PortfolioCompass\static\img\bull-cursor.png")
print("saved bull-cursor.png", img.size)
