import { mkdir, readFile, readdir, writeFile } from "node:fs/promises"
import { join } from "node:path"
import { CircuitJsonToKicadSchConverter } from "circuit-json-to-kicad"
import sharp from "sharp"
import { KicadToCircuitJsonConverter } from "../../../lib"

const base = import.meta.dir
const out = join(base, "out")
const snapshots = join(base, "__snapshots__")
await mkdir(out, { recursive: true })
await mkdir(snapshots, { recursive: true })
const source = join(base, "arduino-c12.source.kicad_sch")
const importer = new KicadToCircuitJsonConverter()
importer.addFile("arduino-c12.kicad_sch", await readFile(source, "utf8"))
importer.runUntilFinished()
const circuitJson = importer.getOutput()
const exporter = new CircuitJsonToKicadSchConverter(circuitJson, {
  paperSize: { name: "A3", width: 420, height: 297 },
  schematicSheets: [{ circuitOrigin: { x: 105, y: 148.5 } }],
})
exporter.runUntilFinished()
const roundtrip = join(out, "arduino-c12.roundtrip.kicad_sch")
await writeFile(roundtrip, exporter.getOutputString())
await writeFile(join(out, "circuit.json"), JSON.stringify(circuitJson, null, 2))

const cli = process.env.KICAD_CLI ?? "kicad-cli"
const width = 700
const height = 900
const headerHeight = 48
const images: Buffer[] = []
for (const [name, path] of [
  ["original", source],
  ["roundtrip", roundtrip],
] as const) {
  const dir = join(out, name)
  await mkdir(dir, { recursive: true })
  const result = Bun.spawn(
    [
      cli,
      "sch",
      "export",
      "svg",
      path,
      "-o",
      dir,
      "--theme",
      "KiCad Default",
      "--exclude-drawing-sheet",
    ],
    { stdout: "pipe", stderr: "pipe" },
  )
  const [exitCode, stdout, stderr] = await Promise.all([
    result.exited,
    new Response(result.stdout).text(),
    new Response(result.stderr).text(),
  ])
  if (exitCode !== 0)
    throw new Error(`KiCad export failed: ${stdout}\n${stderr}`)
  const file = (await readdir(dir)).find((f) => f.endsWith(".svg"))
  if (!file) throw new Error(`No native SVG in ${dir}`)
  const svg = (await readFile(join(dir, file), "utf8")).replace(
    /width="[^"]+" height="[^"]+" viewBox="[^"]+"/,
    `width="${width}px" height="${height}px" viewBox="322 110 18 ${(18 * height) / width}"`,
  )
  images.push(
    await sharp(Buffer.from(svg))
      .flatten({ background: "white" })
      .png()
      .toBuffer(),
  )
}
const header = Buffer.from(
  `<svg width="${width * 2}" height="${headerHeight}"><rect width="100%" height="100%" fill="#f5f5f5"/><g font-family="Arial" font-size="22" fill="#222"><text x="20" y="32">Original KiCad</text><text x="${width + 20}" y="32">Round trip KiCad</text></g></svg>`,
)
await sharp({
  create: {
    width: width * 2,
    height: height + headerHeight,
    channels: 4,
    background: "white",
  },
})
  .composite([
    { input: images[0]!, left: 0, top: headerHeight },
    { input: images[1]!, left: width, top: headerHeight },
    { input: header, left: 0, top: 0 },
  ])
  .png()
  .toFile(join(snapshots, "arduino-c12.comparison.png"))
console.log("Saved native KiCad original / round-trip comparison")
