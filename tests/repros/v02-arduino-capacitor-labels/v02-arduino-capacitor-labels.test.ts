import { expect, test } from "bun:test"
import { readFileSync } from "node:fs"
import { KicadToCircuitJsonConverter } from "../../../lib"

const source = readFileSync(
  new URL("./arduino-c12.source.kicad_sch", import.meta.url),
  "utf8",
)

function convertSource() {
  const converter = new KicadToCircuitJsonConverter()
  converter.addFile("arduino-c12.kicad_sch", source)
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
// This desired contract intentionally fails on the repro layer of the stack.
test.failing("V02 places C12 and 100n to the right of their field anchors", () => {
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
