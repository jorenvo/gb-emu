import "mocha";
import * as assert from "assert";
import * as instruction from "./instruction";
import { CPU } from "./cpu";
import { Memory } from "./memory";
import { ControllerMock } from "./controller";

function createCPU(): CPU {
  const cpu = new CPU();
  cpu.setController(new ControllerMock());
  return cpu;
}

function createMemory(bytes: Uint8Array): Memory {
  const memory = new Memory(bytes, new ControllerMock());
  memory.setBank(0);
  return memory;
}

describe("OpLdD16ToR16", function() {
  it("should correctly load", function() {
    const cpu = createCPU();
    const memory = createMemory(new Uint8Array([0x21, 0x20, 0x21]));
    const ld = new instruction.OpLdD16ToR16(0x00);

    cpu.SP = 0;
    assert.equal(cpu.SP, 0);

    assert.equal("LD HL, $0x2120", ld.disassemble(memory));

    assert.equal(cpu.getHL(), 0);
    ld.exec(cpu, memory);
    assert.equal(cpu.getHL(), 0x2120);
  });
});

describe("OpLdD8ToR8", function() {
  it("should correctly disassemble", function() {
    let memory = createMemory(new Uint8Array([0x16, 0x34]));
    const ld = new instruction.OpLdD8ToR8(0x00);
    assert.equal("LD D, $0x34", ld.disassemble(memory));

    memory = createMemory(new Uint8Array([0x36, 0x34]));
    assert.equal("LD (HL), $0x34", ld.disassemble(memory));
  });
});

describe("OpLdD8ToR8", function() {
  it("should correctly disassemble", function() {
    const ld = new instruction.OpLdR8ToR8(0x00);
    let memory = createMemory(new Uint8Array([0x62]));
    assert.equal("LD H, D", ld.disassemble(memory));

    memory = createMemory(new Uint8Array([0x74]));
    assert.equal("LD (HL), H", ld.disassemble(memory));

    memory = createMemory(new Uint8Array([0x7e]));
    assert.equal("LD A, (HL)", ld.disassemble(memory));
  });
});

describe("OpLdR8ToA16", function() {
  it("should correctly disassemble", function() {
    const ld = new instruction.OpLdR8ToA16(0x00);

    let memory = createMemory(new Uint8Array([0x22]));
    assert.equal("LD (HL+), A", ld.disassemble(memory));

    memory = createMemory(new Uint8Array([0x02]));
    assert.equal("LD (BC), A", ld.disassemble(memory));

    memory = createMemory(new Uint8Array([0x70]));
    assert.equal("LD (HL), B", ld.disassemble(memory));

    memory = createMemory(new Uint8Array([0x74]));
    assert.equal("LD (HL), H", ld.disassemble(memory));

    memory = createMemory(new Uint8Array([0x75]));
    assert.equal("LD (HL), L", ld.disassemble(memory));

    memory = createMemory(new Uint8Array([0x77]));
    assert.equal("LD (HL), A", ld.disassemble(memory));
  });
});

describe("rotations", function() {
  it("should correctly rotate left", function() {
    const cpu = createCPU();
    const memory = createMemory(new Uint8Array());
    const opRLCA = new instruction.OpRLCA(0x00);
    assert.equal(cpu.getReg(0x7), 0);
    assert.equal(cpu.getCarryFlag(), 0);

    // 0b1_1010_0000 rotated left is
    // 0b1_0100_0001
    cpu.setReg(0x7, 0b1010_0000);
    cpu.setCarryFlagDirect(1);
    opRLCA.exec(cpu, memory);
    assert.equal(cpu.getReg(0x7), 0b0100_0001);
    assert.equal(cpu.getCarryFlag(), 1);

    // 0b1_0001_0110 rotated left is
    // 0b0_0010_1101
    cpu.setReg(0x7, 0b0001_0110);
    cpu.setCarryFlagDirect(1);
    opRLCA.exec(cpu, memory);
    // assert.equal(cpu.getReg(0x7), 0b0010_1101); // TODO fix this test or the code
    // assert.equal(cpu.getCarryFlag(), 0);
  });

  it("should correctly rotate right", function() {
    const cpu = createCPU();
    const memory = createMemory(new Uint8Array());
    const opRRCA = new instruction.OpRRCA(0x00);
    assert.equal(cpu.getReg(0x7), 0);
    assert.equal(cpu.getCarryFlag(), 0);

    // 0b1_1010_0001 rotated right is
    // 0b1_0101_0000
    cpu.setReg(0x7, 0b1010_0000);
    cpu.setCarryFlagDirect(1);
    opRRCA.exec(cpu, memory);
    assert.equal(cpu.getReg(0x7), 0b0101_0000);
    assert.equal(cpu.getCarryFlag(), 0);

    // 0b0_0001_0110 rotated right is
    // 0b0_0000_1011
    cpu.setReg(0x7, 0b0001_0110);
    cpu.setCarryFlagDirect(0);
    opRRCA.exec(cpu, memory);
    assert.equal(cpu.getReg(0x7), 0b0000_1011);
    assert.equal(cpu.getCarryFlag(), 0);
  });
});

describe("bit extractions", function() {
  it("should correctly disassemble bit ops", function() {
    function getMemory(opcode: number) {
      return createMemory(new Uint8Array([0xcb, opcode]));
    }
    const opBit = new instruction.OpBit(0x00);

    let memory = getMemory(0x7c);
    assert.equal(opBit.disassemble(memory), "BIT 7, H");

    memory = getMemory(0x78);
    assert.equal(opBit.disassemble(memory), "BIT 7, B");

    memory = getMemory(0x59);
    assert.equal(opBit.disassemble(memory), "BIT 3, C");

    memory = getMemory(0x53);
    assert.equal(opBit.disassemble(memory), "BIT 2, E");

    memory = getMemory(0x66);
    assert.equal(opBit.disassemble(memory), "BIT 4, (HL)");

    memory = getMemory(0x4e);
    assert.equal(opBit.disassemble(memory), "BIT 1, (HL)");

    // BIT 7, H
    memory = getMemory(0x7c);
    const cpu = createCPU();
    cpu.setHL(0x8000);
    assert.equal(cpu.getReg(CPU.H), 0x80);
    assert.equal(cpu.getReg(CPU.L), 0x00);

    assert.equal(cpu.getZeroFlag(), 0);
    opBit.execAndIncrementPC(cpu, memory);
    assert.equal(cpu.getZeroFlag(), 0);

    cpu.setHL(0x8000 - 1);
    assert.equal(cpu.getReg(CPU.H), 0x7f);
    assert.equal(cpu.getReg(CPU.L), 0xff);
    opBit.execAndIncrementPC(cpu, memory);
    assert.equal(cpu.getZeroFlag(), 1);
  });
});
