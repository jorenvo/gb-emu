import * as utils from "./utils";
import { CPU } from "./cpu";
import { Memory } from "./memory";
import { Instruction } from "./instruction";
import { Disassembler } from "./disassembler";

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

function disassemble(bytes: Uint8Array): Instruction[] {
  const instructions = [];
  let i = 0;

  while (i < bytes.length) {
    const newInstruction = Disassembler.buildInstruction(i, bytes);
    i += newInstruction.size();
    instructions.push(newInstruction);
  }

  return instructions;
}

function addressToInstruction(
  instructions: Instruction[]
): Map<number, Instruction> {
  let res = new Map();
  let addr = 0;

  for (let instruction of instructions) {
    res.set(addr, instruction);
    addr += instruction.size();
  }

  return res;
}

async function handleROM(event: Event) {
  const target = event.target as HTMLInputElement;
  const rom = target.files![0];

  const bytes = await readFile(rom);
  // const nintendoLogo = bytes.slice(0x104, 0x133 + 1);
  // console.log(`Nintendo logo: ${formatArrayAsHex(nintendoLogo)}`);

  const instructions = disassemble(bytes);
  const memory = new Memory(bytes);
  const cpu = new CPU(addressToInstruction(instructions));
  mainLoop(cpu, memory);
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

function createMemoryDiv(addr: number, byte: number) {
  const newDiv = document.createElement("div");
  newDiv.innerText = `${utils.hexString(addr)}: ${utils.hexString(
    byte
  )} ${utils.binString(byte)}`;
  return newDiv;
}

function updateMemory(PC: number, memory: Memory) {
  const memoryDiv = document.getElementById("memory")!;
  memoryDiv.innerHTML = "";

  const bytesBefore = Math.min(4, PC - 1);
  for (let addr = PC - bytesBefore; addr <= PC - 1; addr++) {
    memoryDiv.appendChild(createMemoryDiv(addr, memory.getByte(addr)));
  }

  const currentMemory = createMemoryDiv(PC, memory.getByte(PC));
  currentMemory.style.color = "#2e7bff";
  memoryDiv.appendChild(currentMemory);

  const bytesAfter = Math.min(4, memory.bytes.length - 1 - PC);
  for (let addr = PC + 1; addr <= PC + bytesAfter; addr++) {
    memoryDiv.appendChild(createMemoryDiv(addr, memory.getByte(addr)));
  }
}

function updateUI(cpu: CPU, memory: Memory) {
  updateRegs(cpu);
  updateMemory(cpu.PC, memory);
}

async function mainLoop(cpu: CPU, memory: Memory) {
  if (!cpu.tick(memory)) return;
  updateUI(cpu, memory);
  window.setTimeout(() => mainLoop(cpu, memory), 1_000);
}
