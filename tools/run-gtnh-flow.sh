#!/data/data/com.termux/files/usr/bin/bash
set -u

# Usage:
#   ./tools/run-gtnh-flow.sh path/to/file.yaml
#
# Example:
#   ./tools/run-gtnh-flow.sh flows/projects/epichlorohydrin.yaml

if [ $# -lt 1 ]; then
  echo "Usage: $0 <yaml-file>"
  exit 1
fi

SRC="$1"

if [ ! -f "$SRC" ]; then
  echo "ERROR: YAML file not found: $SRC"
  exit 1
fi

if [ ! -d "$HOME/gtnh-flow" ]; then
  echo "ERROR: ~/gtnh-flow not found."
  echo "Clone/setup gtnh-flow first:"
  echo "  cd ~"
  echo "  git clone https://github.com/OrderedSet86/gtnh-flow.git"
  echo "  cd ~/gtnh-flow"
  echo "  pip install -r requirements.txt"
  echo "  pkg install graphviz -y"
  exit 1
fi

BASE="$(basename "$SRC")"
NAME="${BASE%.*}"
DEST_DIR="$HOME/gtnh-flow/projects/workbench"
DEST="$DEST_DIR/$NAME.yaml"

mkdir -p "$DEST_DIR"
cp "$SRC" "$DEST"

echo "Copied:"
echo "  $SRC"
echo "to:"
echo "  $DEST"
echo

cd "$HOME/gtnh-flow" || exit 1

mkdir -p output

echo "Running gtnh-flow..."
echo "Trying project name: workbench/$NAME"
echo

set +e

python factory_graph.py "workbench/$NAME"
STATUS=$?

if [ $STATUS -ne 0 ]; then
  echo
  echo "First run failed. Trying direct YAML path..."
  python factory_graph.py "$DEST"
  STATUS=$?
fi

set -e

if [ $STATUS -ne 0 ]; then
  echo
  echo "ERROR: gtnh-flow failed."
  echo "Your YAML probably needs manual fixes."
  exit $STATUS
fi

echo
echo "Looking for newest output..."

OUT="$(find "$HOME/gtnh-flow/output" -type f \( -iname "*.svg" -o -iname "*.png" -o -iname "*.pdf" \) -printf "%T@ %p\n" 2>/dev/null | sort -nr | head -1 | cut -d' ' -f2-)"

if [ -z "$OUT" ]; then
  echo "ERROR: no SVG/PNG/PDF output found in ~/gtnh-flow/output"
  exit 1
fi

mkdir -p "$HOME/gtnhnei/flows/generated"

EXT="${OUT##*.}"
WEB_OUT="$HOME/gtnhnei/flows/generated/$NAME.$EXT"

cp "$OUT" "$WEB_OUT"

echo
echo "gtnh-flow output copied to:"
echo "  flows/generated/$NAME.$EXT"

cd "$HOME/gtnhnei" || exit 1

cat > flows/manifest.json <<MANIFEST
[
  {
    "id": "$NAME",
    "title": "$NAME",
    "yaml": "flows/projects/$NAME.yaml",
    "output": "flows/generated/$NAME.$EXT",
    "type": "$EXT",
    "source": "gtnh-flow"
  }
]
MANIFEST

echo
echo "Updated flows/manifest.json"
echo
echo "Open:"
echo "  http://127.0.0.1:5520/gtnh-flow.html"
