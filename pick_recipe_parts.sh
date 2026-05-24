#!/data/data/com.termux/files/usr/bin/bash
set -u

out="recipe_parts_$(date +%Y%m%d_%H%M%S).txt"

{
echo "=== 1) top variables / data loading area ==="
sed -n '1,140p' app.js

echo
echo "=== 2) machine icon + recipe helpers area ==="
sed -n '680,760p' app.js

echo
echo "=== 3) recipe render area 1 ==="
sed -n '930,1080p' app.js

echo
echo "=== 4) recipe render area 2 ==="
sed -n '1120,1405p' app.js

echo
echo "=== 5) navigation/back/API area ==="
sed -n '1400,1925p' app.js

echo
echo "=== 6) function list only ==="
grep -nE "function |const .*=>|let .*=>" app.js | head -260
} | tee "$out"

echo
echo "Saved: $out"
