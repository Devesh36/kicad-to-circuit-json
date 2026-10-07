# V02: Arduino C12 field justification

This fixture retains only the original `Device:C` library symbol and C12 instance
from [Arduino-Uno-R3-PCB-Design](https://github.com/daviddzekwer/Arduino-Uno-R3-PCB-Design/tree/cc11949e6205e757a8a8fdc65092ab99e8a60bfb).
Source commit: `cc11949e6205e757a8a8fdc65092ab99e8a60bfb`.
The symbol position, 180-degree angle, field positions, font sizes and right
justifications are unchanged. Other circuit items are removed to isolate V02.

![Original KiCad left, round trip right](./__snapshots__/arduino-c12.comparison.png)

KiCad displays the source right-justified properties as left-anchored readable
text after applying the symbol orientation. The baseline importer retained the raw
`right` justification, so C12 and 100n extended left across the capacitor instead.
The fixed importer transforms the field baseline with the symbol rotation and
mirror, reverses left/right anchoring when that baseline reverses, and keeps
text at readable 0/90-degree angles. Absolute property positions are preserved.

The ordinary regression assertion now passes. Coverage includes all four
orthogonal symbol rotations, both field orientations, X/Y mirroring and all
three horizontal anchors: 74 tests total. Native KiCad 10.0.6 exports independently
confirmed the 24 rotation/mirror combinations underlying the expectations.
With the production file restored to the repro revision, 37 tests fail; with the
fix all 74 pass. The updated snapshot shows the labels clear of the capacitor.

## Reproduce

```sh
bun install
bun test tests/repros/v02-arduino-capacitor-labels/v02-arduino-capacitor-labels.test.ts
bun tests/repros/v02-arduino-capacitor-labels/render.ts
```

The renderer requires native KiCad CLI 10.0.6 (tested version), or set `KICAD_CLI`
to its absolute path. Both panels use that same native renderer and equal crops,
not a Circuit JSON preview. Export is pinned to `circuit-json-to-kicad@0.0.230`.
Explicit A3 dimensions and the original coordinate origin remove global page
translation from the comparison. Generated intermediate JSON, round-trip
schematic and native SVG files are written to ignored `out/` for inspection.
`polygon-clipping` is supplied as a dev dependency because the pinned exporter
imports it without declaring it as a runtime dependency.

This reproduction isolates label placement. Field colors and unrelated defaults
are separate audit findings and are not part of V02.
