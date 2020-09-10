import { Loader } from "./loader.js";
import { Emulator } from "./emu.js";

const loader = new Loader();
loader.readFile.then((bytes: Uint8Array) => {
  const emu = new Emulator(bytes);
  emu.run();
})

