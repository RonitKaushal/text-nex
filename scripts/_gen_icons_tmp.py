from PIL import Image
from pathlib import Path
import json
import shutil

root = Path(r'd:\text-nex')
master = Image.open(root / 'assets' / 'icons' / 'arcticswitch-icon-master-1024.png').convert('RGBA')

sizes = [1024, 512, 256, 128, 64, 48, 32, 24, 16]
ico_sizes = [256, 128, 64, 48, 32, 24, 16]

out_dir = root / 'build' / 'icons'
out_dir.mkdir(parents=True, exist_ok=True)
(root / 'build').mkdir(exist_ok=True)
(root / 'public').mkdir(exist_ok=True)

sized = {}
for s in sizes:
    img = master.resize((s, s), Image.Resampling.LANCZOS)
    sized[s] = img
    path = out_dir / f'icon-{s}.png'
    img.save(path, 'PNG')
    print('wrote', path)

sized[512].save(root / 'build' / 'icon.png', 'PNG')
sized[512].save(out_dir / 'icon.png', 'PNG')
sized[1024].save(out_dir / 'icon-1024.png', 'PNG')
sized[1024].save(out_dir / '1024x1024.png', 'PNG')
sized[512].save(out_dir / '512x512.png', 'PNG')

sized[32].save(root / 'public' / 'favicon-32.png', 'PNG')
sized[16].save(root / 'public' / 'favicon-16.png', 'PNG')
sized[512].save(root / 'public' / 'logo.png', 'PNG')

ico_images = [sized[s] for s in ico_sizes]
ico_path_build = root / 'build' / 'icon.ico'
ico_images[0].save(
    ico_path_build,
    format='ICO',
    sizes=[(s, s) for s in ico_sizes],
    append_images=ico_images[1:],
)
shutil.copyfile(ico_path_build, root / 'public' / 'icon.ico')
shutil.copyfile(ico_path_build, out_dir / 'icon.ico')
print('wrote', ico_path_build)

icns_ok = False
try:
    import png2icons

    data = (out_dir / 'icon-1024.png').read_bytes()
    icns = png2icons.createICNS(data, png2icons.BICUBIC, 0)
    if icns:
        (root / 'build' / 'icon.icns').write_bytes(icns)
        (out_dir / 'icon.icns').write_bytes(icns)
        icns_ok = True
        print('wrote ICNS')
except Exception as e:
    print('ICNS skip:', e)

manifest = {
    'app': 'ARCTICSWITCH',
    'master': 'icon-1024.png',
    'source': 'public/logo_light.png (on black plate)',
    'sizes': sizes,
    'icns': icns_ok,
}
(out_dir / 'manifest.json').write_text(json.dumps(manifest, indent=2), encoding='utf-8')
print('done')
