# Button Sender — Icon Pack

Transparent PNG icons for Electron (Windows / macOS / Linux).
Ready to convert to .ico (Windows) and .icns (macOS).

| File | Size | Purpose |
|------|------|---------|
| `icon-1024.png` | 1024×1024 | Master / macOS / Linux source |
| `icon-512.png` | 512×512 | Linux app launcher / installer |
| `icon-256.png` | 256×256 | Windows desktop / Start Menu |
| `icon-128.png` | 128×128 | Windows medium icons |
| `icon-64.png` | 64×64 | Windows Explorer / settings |
| `icon-48.png` | 48×48 | Windows Explorer / Control Panel |
| `icon-32.png` | 32×32 | Electron title bar / toolbar |
| `icon-24.png` | 24×24 | Toolbar / navigation |
| `icon-16.png` | 16×16 | Title bar / taskbar / tray |

## Platform files

- `icon.ico` — multi-resolution Windows icon (16–256)
- `icon.png` — alias of 512×512 (Linux / electron-builder)
- `icon-1024.png` — master source for `.icns` conversion

## Convert to .icns (macOS)

```bash
# With iconutil (macOS):
mkdir icon.iconset
cp icon-16.png  icon.iconset/icon_16x16.png
cp icon-32.png  icon.iconset/icon_16x16@2x.png
cp icon-32.png  icon.iconset/icon_32x32.png
cp icon-64.png  icon.iconset/icon_32x32@2x.png
cp icon-128.png icon.iconset/icon_128x128.png
cp icon-256.png icon.iconset/icon_128x128@2x.png
cp icon-256.png icon.iconset/icon_256x256.png
cp icon-512.png icon.iconset/icon_256x256@2x.png
cp icon-512.png icon.iconset/icon_512x512.png
cp icon-1024.png icon.iconset/icon_512x512@2x.png
iconutil -c icns icon.iconset -o icon.icns
```
