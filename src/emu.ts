import * as utils from "./utils.js";
import { CPU } from "./cpu.js";

const inputElement = document.getElementById("rom")!;
inputElement.addEventListener("change", handleROM, false);

// Can't use File.arrayBuffer() because it's not supported in Safari
function readFile(file: File): Promise<Uint8Array> {
  return new Promise(resolve => {
    const reader = new FileReader();
    reader.onload = function(event) {
      const buffer = event.target!.result as ArrayBuffer;
      resolve(new Uint8Array(buffer));
    };
    reader.readAsArrayBuffer(file);
  });
}

async function handleROM(event: Event) {
  const target = event.target as HTMLInputElement;
  const rom = target.files![0];

  const bytes = await readFile(rom);
  // const nintendoLogo = bytes.slice(0x104, 0x133 + 1);
  // console.log(`Nintendo logo: ${formatArrayAsHex(nintendoLogo)}`);
  const cpu = new CPU(bytes);
  mainLoop(cpu);
}

async function mainLoop(cpu: CPU) {
  if (!cpu.tick()) return;
  document.getElementById("PC")!.innerText = utils.hexString(cpu.PC);
  window.setTimeout(() => mainLoop(cpu), 1_000);
}
