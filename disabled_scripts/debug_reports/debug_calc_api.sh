#!/data/data/com.termux/files/usr/bin/bash
set -u

out="calc_api_debug_$(date +%Y%m%d_%H%M%S).txt"

{
echo "=== file sizes ==="
ls -lh index.html app.js extras.js calc.js topstrip.js data/data.bin data/atlas.webp 2>/dev/null

echo
echo "=== script/style order ==="
grep -nE "script|stylesheet" index.html

echo
echo "=== app.js recipe/data clues ==="
grep -nEi "recipe|recipes|usage|uses|production|consume|input|output|items|fluids|data|view|render|search|currentView|historyStack" app.js | head -260

echo
echo "=== window/global API clues ==="
grep -nEi "window\.|globalThis\.|GTNHNEI|ICON_API|install.*Api|setIcon|find|lookup|getRecipe|getUsage|api" app.js extras.js calc.js topstrip.js | head -260

echo
echo "=== important function names ==="
grep -nE "function |const .*=>|let .*=>|class " app.js | head -260
} | tee "$out"

echo
echo "Saved debug report: $out"
