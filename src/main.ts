import { Loader } from "./loader.js";
import { Emulator } from "./emu.js";
import { BOOTROM } from "./roms.js";

function runEmulator(bytes: Uint8Array) {
  const emu = new Emulator(bytes);
  emu.run();
}

const loader = new Loader();
loader.readFile.then(runEmulator);

const bootromButton = document.getElementById("loadBootrom")!;
bootromButton.addEventListener("click", () => runEmulator(BOOTROM));
