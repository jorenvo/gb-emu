import * as utils from "./utils.js";
import { CPU } from "./cpu.js";
import { Memory } from "./memory.js";
import { Instruction } from "./instruction.js";
import { Disassembler } from "./disassembler.js";

const inputElement = document.getElementById("rom")!;
inputElement.addEventListener("change", handleROM, false);

// Can't use File.arrayBuffer() because it's not supported in Safari
function readFile(file: File): Promise<Uint8Array> {
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onload = function (event) {
      const buffer = event.target!.result as ArrayBuffer;
      resolve(new Uint8Array(buffer));
    };
    reader.readAsArrayBuffer(file);
  });
}

function disassemble(bytes: Uint8Array): Instruction[] {
  const instructions = [];
  let i = 0;

  while (i < bytes.length) {
    const newInstruction = Disassembler.buildInstruction(i, bytes);
    const size = newInstruction.size();
    if (size === 0) {
      throw new Error(
        `Encountered unimplemented instruction: ${newInstruction.disassemble(
          new Memory(new Uint8Array())
        )}`
      );
    }

    i += size;
    instructions.push(newInstruction);
  }

  return instructions;
}

function addressToInstruction(
  instructions: Instruction[]
): Map<number, Instruction> {
  let res = new Map();

  for (let instruction of instructions) {
    res.set(instruction.getAddress(), instruction);
  }

  return res;
}

async function handleROM(event: Event) {
  const target = event.target as HTMLInputElement;
  const rom = target.files![0];

  const bytes = await readFile(rom);
  // const nintendoLogo = bytes.slice(0x104, 0x133 + 1);
  // console.log(`Nintendo logo: ${formatArrayAsHex(nintendoLogo)}`);

  console.log("handling rom");
  const instructions = disassemble(bytes);
  const memory = new Memory(bytes);
  const addrToInstruction = addressToInstruction(instructions);
  const cpu = new CPU(addrToInstruction);
  console.log("starting main loop");
  mainLoop(cpu, memory, addrToInstruction);
}

function updateRegs(cpu: CPU) {
  let s = `PC: ${utils.hexString(cpu.PC, 16)}  `;
  s += `SP: ${utils.hexString(cpu.SP, 16)}  `;

  s += `B: ${utils.hexString(cpu.regs[CPU.B])}  `;
  s += `C: ${utils.hexString(cpu.regs[CPU.C])}  `;
  s += `D: ${utils.hexString(cpu.regs[CPU.D])}  `;
  s += `E: ${utils.hexString(cpu.regs[CPU.E])}  `;
  s += `H: ${utils.hexString(cpu.regs[CPU.H])}  `;
  s += `L: ${utils.hexString(cpu.regs[CPU.L])}  `;
  s += `F: ${utils.hexString(cpu.regs[CPU.F])}  `;
  s += `A: ${utils.hexString(cpu.regs[CPU.A])}  `;

  document.getElementById("regs")!.innerText = s;
}

function createMemoryDiv(addr: number, memory: Memory, addrToInstruction: Map<number, Instruction>) {
  const byte = memory.getByte(addr);
  const newDiv = document.createElement("div");

  if (addr === undefined || byte === undefined) debugger;
  
  newDiv.innerText = `${utils.hexString(addr)}: ${utils.hexString(
    byte
  )} ${utils.binString(byte)}`;

  const instruction = addrToInstruction.get(addr);
  if (instruction) {
    newDiv.innerText += ` ${instruction.disassemble(memory)}`;
  }

  return newDiv;
}

function updateMemory(PC: number, memory: Memory, addrToInstruction: Map<number, Instruction>) {
  const contextInstructions = 16;
  const memoryDiv = document.getElementById("memory")!;
  memoryDiv.innerHTML = "";

  const bytesBefore = Math.min(contextInstructions, PC);
  for (let addr = PC - bytesBefore; addr <= PC - 1; addr++) {
    memoryDiv.appendChild(createMemoryDiv(addr, memory, addrToInstruction));
  }

  const currentMemory = createMemoryDiv(PC, memory, addrToInstruction);
  currentMemory.style.color = "#2e7bff";
  memoryDiv.appendChild(currentMemory);

  const bytesAfter = Math.min(contextInstructions, memory.bytes.length - 1 - PC);
  for (let addr = PC + 1; addr <= PC + bytesAfter; addr++) {
    memoryDiv.appendChild(createMemoryDiv(addr, memory, addrToInstruction));
  }
}

function updateUI(cpu: CPU, memory: Memory, addrToInstruction: Map<number, Instruction>) {
  updateRegs(cpu);
  updateMemory(cpu.PC, memory, addrToInstruction);
}

async function mainLoop(cpu: CPU, memory: Memory, addrToInstruction: Map<number, Instruction>) {
  if (!cpu.tick(memory)) return;
  console.log("main loop");
  updateUI(cpu, memory, addrToInstruction);
  window.setTimeout(() => mainLoop(cpu, memory, addrToInstruction), 1_000);
}
