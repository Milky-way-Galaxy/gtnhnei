#!/usr/bin/env python3
"""Generate/check independent expected results using two pinned GT5 Java classes.

Requires Python 3, network through the configured proxy, and JDK 21+. Downloads
stay in a temporary directory; no Minecraft instance or JavaScript port is used.
GTUtility's actual powInt/log4 implementations are extracted from each same pin.
"""
import argparse
import hashlib
import json
import pathlib
import random
import subprocess
import tempfile
import urllib.request

ROOT = pathlib.Path(__file__).resolve().parents[1]
PINS = {
    "gt5-5.09.51.470": "000a4d9b24d77f40a79da7a105bb79ac7efca817",
    "gt5-5.09.54.205": "a3e1e11241a814c9fa0dd0973d5699548428f689",
}


def extract(source, signature):
    start = source.index(signature)
    opening = source.index("{", start)
    depth, end = 1, opening + 1
    while depth:
        depth += (source[end] == "{") - (source[end] == "}")
        end += 1
    return source[start:end]


def cases():
    result = []
    # Named vectors from GT_OverclockCalculator_UnitTest, plus voltage, heat,
    # parallel, tick, and fractional-discount boundaries around tier thresholds.
    for heat in (1800, 2700, 3600, 9000):
        result.append(dict(eut=30, duration=1024, tier=5, amps=1, parallels=1,
                           perfect=False, ampOC=False, recipeHeat=1800, heat=heat, cap=14))
    result += [dict(eut=30, duration=1024, tier=6, amps=4, parallels=1,
                    perfect=False, ampOC=True, recipeHeat=-1, heat=0, cap=14),
               dict(eut=1920, duration=3, tier=5, amps=1, parallels=1,
                    perfect=True, ampOC=False, recipeHeat=-1, heat=0, cap=14),
               dict(eut=34, duration=1024, tier=2, amps=1, parallels=1,
                    perfect=False, ampOC=True, recipeHeat=1800, heat=2700, cap=14),
               # Actual bundled hot Oriharukon and Epichlorohydrin base values.
               dict(eut=7680, duration=1380, tier=6, amps=1, parallels=1,
                    perfect=False, ampOC=False, recipeHeat=5400, heat=7200, cap=14),
               dict(eut=30, duration=640, tier=2, amps=1, parallels=1,
                    perfect=False, ampOC=False, recipeHeat=-1, heat=0, cap=14),
               dict(eut=7, duration=3, tier=14, amps=4096, parallels=1,
                    perfect=False, ampOC=True, recipeHeat=-1, heat=0, cap=14),
               dict(eut=30720, duration=1380, tier=14, amps=4096, parallels=4096,
                    perfect=True, ampOC=False, recipeHeat=-1, heat=0, cap=14)]
    rng = random.Random(314159)
    for _ in range(360):
        heat_mode = rng.choice((True, False))
        entry = dict(eut=rng.choice((1, 7, 8, 30, 31, 32, 33, 34, 120, 128, 480, 512, 1920, 2048, 7680, 30720)),
                     duration=rng.choice((1, 2, 3, 25, 200, 640, 1380, 16384)),
                     tier=rng.randrange(1, 10), amps=rng.choice((1, 2, 4, 16, 64)),
                     parallels=1 if heat_mode else rng.choice((1, 2, 4, 16)),
                     perfect=False if heat_mode else rng.choice((True, False)),
                     ampOC=rng.choice((True, False)), recipeHeat=1800 if heat_mode else -1,
                     heat=1800 + rng.choice((0, 899, 900, 1799, 1800, 3600, 7200)),
                     cap=rng.choice((0, 1, 2, 4, 14)))
        if entry["eut"] <= 8 * 4 ** entry["tier"] * 4 and entry["eut"] * entry["parallels"] <= 8 * 4 ** entry["tier"] * entry["amps"]:
            result.append(entry)
    return result


def generate():
    inputs = cases()
    output = {"pins": {}, "cases": inputs, "expected": {}, "coils": {}, "coilNames": {}}
    harness = '''import gregtech.api.util.OverclockCalculator;
import java.util.Scanner;
class Reference {
 public static void main(String[] args) {
  Scanner input = new Scanner(System.in);
  while(input.hasNextLine()) {
   String[] v = input.nextLine().split(",");
   long voltage = 8L << (2 * Integer.parseInt(v[2]));
   if (Integer.parseInt(v[2]) == 14) voltage = Integer.MAX_VALUE - 7L;
   OverclockCalculator c = new OverclockCalculator().setRecipeEUt(Long.parseLong(v[0]))
    .setDuration(Integer.parseInt(v[1])).setEUt(voltage).setAmperage(Long.parseLong(v[3]))
    .setParallel(Integer.parseInt(v[4])).setAmperageOC(Boolean.parseBoolean(v[6]))
    .setMaxOverclocks(Integer.parseInt(v[9]));
   if (Boolean.parseBoolean(v[5])) c.enablePerfectOC();
   if (Integer.parseInt(v[7]) >= 0) c.setRecipeHeat(Integer.parseInt(v[7]))
     .setMachineHeat(Integer.parseInt(v[8])).setHeatDiscount(true).setHeatOC(true);
   c.calculate();
   System.out.println(c.getDuration()+","+c.getConsumption()+","+c.getPerformedOverclocks());
  }
 }
}'''
    with tempfile.TemporaryDirectory(prefix="atlas-gt5-reference-") as temp:
        folder = pathlib.Path(temp)
        for ruleset, pin in PINS.items():
            target = folder / ruleset
            java_folder = target / "gregtech/api/util"
            java_folder.mkdir(parents=True)
            sources = {}
            for name, package in (("OverclockCalculator", "util"), ("GTUtility", "util"), ("HeatingCoilLevel", "enums")):
                url = f"https://raw.githubusercontent.com/GTNewHorizons/GT5-Unofficial/{pin}/src/main/java/gregtech/api/{package}/{name}.java"
                with urllib.request.urlopen(url, timeout=60) as response:
                    sources[name] = response.read().decode()
            with urllib.request.urlopen(f"https://raw.githubusercontent.com/GTNewHorizons/GT5-Unofficial/{pin}/src/main/resources/assets/gregtech/lang/en_US.lang", timeout=60) as response:
                sources["Language"] = response.read().decode()
            output["pins"][ruleset] = dict(commit=pin, sha256={key: hashlib.sha256(value.encode()).hexdigest() for key, value in sources.items()})
            (java_folder / "OverclockCalculator.java").write_text(sources["OverclockCalculator"])
            # Keep the actual numerical helpers. A small stub supplies clamp;
            # that method is used only by excluded subtick code, never our calls.
            utility = "package gregtech.api.util; public class GTUtility {\n"
            for signature in ("public static double powInt(", "private static double powBySquaring(", "public static long log4(", "public static long log4ceil("):
                utility += extract(sources["GTUtility"], signature) + "\n"
            utility += "public static int clamp(int v, int min, int max) {return Math.max(min, Math.min(max,v));} }"
            (java_folder / "GTUtility.java").write_text(utility)
            (java_folder / "GTRecipe.java").write_text("package gregtech.api.util; public class GTRecipe {public int mEUt; public int mDuration;}")
            (target / "javax/annotation").mkdir(parents=True)
            (target / "javax/annotation/Nonnull.java").write_text("package javax.annotation; public @interface Nonnull {}")
            (target / "Reference.java").write_text(harness)
            (target / "gregtech/api/enums").mkdir(parents=True)
            (target / "gregtech/api/enums/HeatingCoilLevel.java").write_text(sources["HeatingCoilLevel"])
            (target / "gregtech/api/enums/GTValues.java").write_text("package gregtech.api.enums; public class GTValues { public static final String[] TIER_COLORS=new String[16]; }")
            (target / "net/minecraft/util").mkdir(parents=True)
            (target / "net/minecraft/util/StatCollector.java").write_text("package net.minecraft.util; public class StatCollector {public static String translateToLocal(String value) {return value;}}")
            (target / "CoilReference.java").write_text('''import gregtech.api.enums.HeatingCoilLevel;
class CoilReference { public static void main(String[] args) {
 for (HeatingCoilLevel coil : HeatingCoilLevel.values()) if (coil.ordinal() >= 2)
   System.out.println(coil.ordinal()+","+coil.getHeat());
}}''')
            subprocess.run(["java", "-m", "jdk.compiler/com.sun.tools.javac.Main", "-d", str(target), *map(str, target.rglob("*.java"))], check=True, capture_output=True)
            lines = "\n".join(",".join(str(v).lower() for v in entry.values()) for entry in inputs)
            result = subprocess.run(["java", "-cp", str(target), "Reference"], input=lines, text=True, capture_output=True, check=True)
            output["expected"][ruleset] = [list(map(int, line.split(","))) for line in result.stdout.splitlines()]
            assert len(output["expected"][ruleset]) == len(inputs)
            coils = subprocess.run(["java", "-cp", str(target), "CoilReference"], text=True, capture_output=True, check=True)
            output["coils"][ruleset] = [list(map(int, line.split(","))) for line in coils.stdout.splitlines()]
            names = dict(line.split("=",1) for line in sources["Language"].splitlines() if line.startswith("GT5U.coil."))
            output["coilNames"][ruleset] = [names["GT5U.coil." + key] for key in ("LV", "MV", "HV", "EV", "IV", "LuV", "ZPM", "UV", "UHV", "UEV", "UIV", "UMV", "UXV", "MAX")]
    # One vector per line keeps a large numerical fixture reviewable.
    expected = ",\n".join(json.dumps(key) + ": [\n" + ",\n".join(json.dumps(row) for row in rows) + "\n]" for key, rows in output["expected"].items())
    return "{\n\"pins\": " + json.dumps(output["pins"], indent=2) + ",\n\"cases\": [\n" + ",\n".join(json.dumps(row) for row in inputs) + "\n],\n\"expected\": {\n" + expected + "\n},\n\"coils\":" + json.dumps(output["coils"], indent=2) + ",\n\"coilNames\":" + json.dumps(output["coilNames"], indent=2) + "\n}\n"


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--write", action="store_true", help="Regenerate committed fixture")
    args = parser.parse_args()
    fixture = ROOT / "tests/fixtures/gt5-machine-reference.json"
    try:
        text = generate()
    except subprocess.CalledProcessError as failure:
        raise SystemExit(failure.stderr.decode() if isinstance(failure.stderr, bytes) else failure.stderr)
    if args.write:
        fixture.write_text(text)
    else:
        assert fixture.read_text() == text, "Reference fixture differs; inspect results before regenerating."
    print(f"Pinned GT5 Java reference: {len(cases())} cases × {len(PINS)} source versions verified.")
