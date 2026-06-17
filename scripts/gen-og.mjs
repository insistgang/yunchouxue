/**
 * gen-og.mjs
 * 生成 public/og-default.png（1200×630，深蓝学术风）
 *
 * 依赖：Python 3 + Pillow（系统已装）
 * 运行：node scripts/gen-og.mjs
 *
 * 若项目后续安装了 sharp，可改用：
 *   import sharp from 'sharp';
 *   await sharp(Buffer.from(svgString)).resize(1200,630).png().toFile('public/og-default.png');
 */
import { execFileSync } from 'node:child_process';
import { writeFileSync, unlinkSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const outPath = join(__dirname, '..', 'public', 'og-default.png');
const tmpPy = join(__dirname, '_gen_og_tmp.py');

const py = `
from PIL import Image, ImageDraw, ImageFont
import os, sys

W, H = 1200, 630
BG      = (29, 78, 137)      # #1D4E89 深蓝
ACCENT  = (255, 200, 80)     # 金色
WHITE   = (255, 255, 255)
LIGHT   = (180, 210, 240)
DARK    = (20, 60, 110)

img  = Image.new('RGB', (W, H), color=BG)
draw = ImageDraw.Draw(img)

# 右侧深色面板
draw.rectangle([820, 0, W, H], fill=DARK)
# 金色分隔竖线
draw.rectangle([800, 40, 808, H - 40], fill=ACCENT)

# 装饰：可行域示意（椭圆 + 最优点）
draw.ellipse([860, 155, 1060, 355], outline=ACCENT, width=3)
draw.ellipse([900, 195, 1020, 315], outline=LIGHT, width=1)
draw.line([(860, 375), (1060, 375)], fill=LIGHT, width=2)
draw.line([(860, 375), (860, 195)], fill=LIGHT, width=2)
draw.ellipse([952, 263, 972, 283], fill=ACCENT)

# 字体（尝试系统中文字体，回退系统等宽）
font_paths = [
    '/System/Library/Fonts/PingFang.ttc',
    '/System/Library/Fonts/STHeiti Light.ttc',
    '/System/Library/Fonts/Supplemental/Arial Unicode.ttf',
    '/Library/Fonts/Arial.ttf',
    '/System/Library/Fonts/Helvetica.ttc',
]
title_font = sub_font = cap_font = None
for fp in font_paths:
    if os.path.exists(fp):
        try:
            title_font = ImageFont.truetype(fp, 72)
            sub_font   = ImageFont.truetype(fp, 36)
            cap_font   = ImageFont.truetype(fp, 24)
            break
        except Exception:
            continue
if title_font is None:
    title_font = sub_font = cap_font = ImageFont.load_default()

draw.text((80, 180), '运筹学·教学站',               font=title_font, fill=WHITE)
draw.text((80, 290), 'Operations Research Teaching',  font=sub_font,   fill=LIGHT)
draw.text((80, 355), '线性规划 · 最短路 · 最大流 · 背包问题', font=cap_font, fill=LIGHT)
draw.text((80, 560), 'yunchouxue',                   font=cap_font,   fill=ACCENT)

out = sys.argv[1]
img.save(out, 'PNG', optimize=True)
print('Generated:', out)
`;

writeFileSync(tmpPy, py, 'utf8');
try {
  execFileSync('python3', [tmpPy, outPath], { stdio: 'inherit' });
} finally {
  unlinkSync(tmpPy);
}
