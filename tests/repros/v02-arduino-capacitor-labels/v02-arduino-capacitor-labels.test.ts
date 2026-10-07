import { expect, test } from "bun:test"
import { readFileSync } from "node:fs"
import { KicadToCircuitJsonConverter } from "../../../lib"

const source = readFileSync(
  new URL("./arduino-c12.source.kicad_sch", import.meta.url),
  "utf8",
)

function convertSource(content = source) {
  const converter = new KicadToCircuitJsonConverter()
  converter.addFile("arduino-c12.kicad_sch", content)
  converter.runUntilFinished()
  return converter.getOutput()
}

test("V02 keeps C12 property coordinates and the capacitor geometry", () => {
  const circuitJson = convertSource()
  expect(
    circuitJson.filter((e) => e.type === "schematic_component"),
  ).toHaveLength(1)
  expect(circuitJson.filter((e) => e.type === "schematic_port")).toHaveLength(2)
  for (const [value, x, y] of [
    ["C12", 330.962, 114.808],
    ["100n", 330.708, 118.618],
  ] as const) {
    const text = circuitJson.find(
      (e) => e.type === "schematic_text" && e.text === value,
    )
    expect(text?.type).toBe("schematic_text")
    if (text?.type !== "schematic_text") throw new Error(`Missing ${value}`)
    expect(text.position.x).toBeCloseTo((x - 105) / 15, 10)
    expect(text.position.y).toBeCloseTo((148.5 - y) / 15, 10)
    expect(text.rotation).toBe(0)
  }
})

// Native KiCad flips the field justification on this 180-degree symbol.
test("V02 places C12 and 100n to the right of their field anchors", () => {
  const texts = convertSource().filter(
    (e) => e.type === "schematic_text" && ["C12", "100n"].includes(e.text),
  )
  expect(texts).toHaveLength(2)
  for (const text of texts) {
    if (text.type !== "schematic_text")
      throw new Error("Expected property text")
    expect(text.anchor).toBe("left")
  }
})

// Independently checked against KiCad 10.0.6's native field bounding boxes.
const orientations = [
  [0, 0],
  [0, 90],
  [90, 0],
  [90, 90],
  [180, 0],
  [180, 90],
  [270, 0],
  [270, 90],
] as const
const effectiveRightAnchors = {
  none: ["right", "right", "right", "left", "left", "left", "left", "right"],
  x: ["right", "left", "left", "left", "left", "right", "right", "right"],
  y: ["left", "right", "right", "right", "right", "left", "left", "left"],
} as const
for (const mirror of ["none", "x", "y"] as const) {
  for (const [index, [symbolAngle, fieldAngle]] of orientations.entries()) {
    for (const storedAnchor of ["left", "center", "right"] as const) {
      test(`V02 fields: symbol ${symbolAngle}, field ${fieldAngle}, mirror ${mirror}, anchor ${storedAnchor}`, () => {
        const content = source
          .replace(
            "(at 327.66 119.38 180)",
            `(at 327.66 119.38 ${symbolAngle})${mirror === "none" ? "" : `\n(mirror ${mirror})`}`,
          )
          .replace(
            "(at 330.962 114.808 0)",
            `(at 330.962 114.808 ${fieldAngle})`,
          )
          .replace(
            "(at 330.708 118.618 0)",
            `(at 330.708 118.618 ${fieldAngle})`,
          )
          .replaceAll(
            "(justify right)",
            storedAnchor === "center"
              ? "(justify)"
              : `(justify ${storedAnchor})`,
          )
        const flip = effectiveRightAnchors[mirror][index] === "left"
        const expectedAnchor =
          storedAnchor === "center"
            ? "center"
            : flip
              ? storedAnchor === "right"
                ? "left"
                : "right"
              : storedAnchor
        const rotation = (symbolAngle + fieldAngle) % 180 === 0 ? 0 : 90
        const texts = convertSource(content).filter(
          (element) => element.type === "schematic_text",
        )
        expect(texts).toHaveLength(2)
        for (const text of texts) {
          if (text.type !== "schematic_text")
            throw new Error("Expected property text")
          expect(text.anchor).toBe(expectedAnchor)
          expect(text.rotation).toBe(rotation)
          const [x, y] =
            text.text === "C12" ? [330.962, 114.808] : [330.708, 118.618]
          expect(text.position.x).toBeCloseTo((x! - 105) / 15, 10)
          expect(text.position.y).toBeCloseTo((148.5 - y!) / 15, 10)
        }
      })
    }
  }
}
