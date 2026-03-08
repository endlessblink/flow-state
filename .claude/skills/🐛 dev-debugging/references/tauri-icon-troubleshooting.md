# Tauri/Linux Desktop Icon Troubleshooting

Read this when icons don't update after a Tauri build on KDE Plasma.

## Common Causes
1. **Conflicting .desktop files** - User-local file takes precedence over system file
2. **KDE icon cache** - Cached icons not refreshed
3. **StartupWMClass mismatch** - Desktop file doesn't match app's WM_CLASS
4. **Old binary still running** - System using old installed version

## Diagnostic Commands
```bash
# Find all .desktop files for your app
find /usr/share/applications ~/.local/share/applications -iname "*flowstate*" -o -iname "*flow-state*" 2>/dev/null

# Check WM_CLASS of running app (click on app window when prompted)
xprop WM_CLASS

# Check installed icon locations
ls -la /usr/share/icons/hicolor/*/apps/flow-state.png
```

## Fix Procedure (KDE Plasma)
```bash
# Step 1: Remove conflicting user .desktop file
rm -f ~/.local/share/applications/flowstate.desktop

# Step 2: Clear ALL icon caches
rm -f ~/.cache/icon-cache.kcache
rm -f ~/.cache/ksvg-elements-*
rm -rf ~/.cache/ksycoca6*

# Step 3: Update desktop database
update-desktop-database ~/.local/share/applications 2>/dev/null

# Step 4: Rebuild KDE system configuration
kbuildsycoca6 --noincremental  # For Plasma 6
# OR
kbuildsycoca5 --noincremental  # For Plasma 5

# Step 5: Kill the app
pkill -f "flow-state"

# Step 6: Restart plasmashell
kquitapp6 plasmashell && kstart plasmashell

# Step 7: Relaunch app
/usr/bin/flow-state &
```

## If Icons Still Don't Update
1. **Reinstall the .deb package**:
   ```bash
   sudo dpkg -i src-tauri/target/release/bundle/deb/FlowState_*.deb
   ```

2. **Manually copy icons** (requires sudo):
   ```bash
   sudo cp src-tauri/icons/32x32.png /usr/share/icons/hicolor/32x32/apps/flow-state.png
   sudo cp src-tauri/icons/128x128.png /usr/share/icons/hicolor/128x128/apps/flow-state.png
   sudo cp src-tauri/icons/128x128@2x.png /usr/share/icons/hicolor/256x256@2/apps/flow-state.png
   sudo gtk-update-icon-cache -f /usr/share/icons/hicolor/
   ```

3. **Log out and log back in** - Some icon changes only take effect after re-login

## Key Files Reference
| File | Purpose |
|------|---------|
| `src-tauri/icons/` | Source icons for Tauri build |
| `src-tauri/tauri.conf.json` | Icon configuration (`bundle.icon` array) |
| `/usr/share/applications/FlowState.desktop` | System .desktop file |
| `~/.local/share/applications/` | User .desktop files (take precedence!) |
| `/usr/share/icons/hicolor/*/apps/` | Installed icon locations |
| `~/.cache/icon-cache.kcache` | KDE icon cache |

## Desktop File Best Practices
```ini
[Desktop Entry]
Name=FlowState
Comment=Productivity app
Exec=flow-state
Icon=flow-state
Terminal=false
Type=Application
Categories=Office;Productivity;
StartupWMClass=flow-state  # MUST match app's WM_CLASS exactly!
```

## Creating Transparent Taskbar Icons from Complex SVGs

Use ImageMagick flood-fill to remove connected background pixels:

```bash
# Render SVG and make background transparent via flood-fill from all 4 corners
magick convert "original.svg" \
  -fuzz 25% -fill none -draw "color 0,0 floodfill" \
  -fuzz 25% -fill none -draw "color WIDTH-1,0 floodfill" \
  -fuzz 25% -fill none -draw "color 0,HEIGHT-1 floodfill" \
  -fuzz 25% -fill none -draw "color WIDTH-1,HEIGHT-1 floodfill" \
  /tmp/transparent.png

# Trim transparent areas and resize to 512x512
magick convert /tmp/transparent.png \
  -trim +repage \
  -resize 490x490 \
  -gravity center \
  -background none \
  -extent 512x512 \
  src-tauri/icons/icon.png
```

Key parameters: `-fuzz 25%` (tolerance), `floodfill` (connected pixels), `-trim +repage` (remove borders).

### Generate Full Icon Set
```bash
for size in 16 24 32 48 64 128 256; do
  magick convert src-tauri/icons/icon.png -resize ${size}x${size} /tmp/ico/${size}.png
done

# Windows ICO
magick convert /tmp/ico/16.png /tmp/ico/24.png /tmp/ico/32.png /tmp/ico/48.png \
  /tmp/ico/64.png /tmp/ico/128.png /tmp/ico/256.png src-tauri/icons/icon.ico

# Tauri-specific sizes
magick convert src-tauri/icons/icon.png -resize 32x32 src-tauri/icons/32x32.png
magick convert src-tauri/icons/icon.png -resize 128x128 src-tauri/icons/128x128.png
magick convert src-tauri/icons/icon.png -resize 256x256 "src-tauri/icons/128x128@2x.png"
```

### Full Workflow: SVG → Tauri App → KDE Taskbar
```bash
# 1. Create transparent icon from SVG (adjust WIDTH/HEIGHT from `identify "$SVG_FILE"`)
# 2. Generate all icon sizes (script above)
# 3. npm run tauri build
# 4. sudo dpkg -i src-tauri/target/release/bundle/deb/FlowState_*.deb
# 5. kbuildsycoca6 --noincremental
# 6. kquitapp6 plasmashell && kstart plasmashell
```

### Troubleshooting Transparency
```bash
# Check alpha range (should be 0-1, not 1-1)
magick convert icon.png -alpha extract -format "Alpha: %[fx:minima]-%[fx:maxima]" info:

# If alpha is 1-1 (fully opaque), try increasing fuzz to 35%
```
