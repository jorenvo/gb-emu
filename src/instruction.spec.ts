import "mocha";
import * as assert from "assert";
import * as instruction from "./instruction";
import * as utils from "./utils";
import { CPU } from "./cpu";
import { Memory } from "./memory";
import { ControllerMock } from "./controller";

function createCPU(): CPU {
  const cpu = new CPU();
  cpu.setController(new ControllerMock());
  return cpu;
}

function createMemory(bytes: Uint8Array): Memory {
  const fakeROM = new Uint8Array(0x4000);
  fakeROM.set(bytes);

  const memory = new Memory(fakeROM, new ControllerMock());
  memory.setBank(0);
  return memory;
}

describe("OpLdD16ToR16", function() {
  it("should correctly load", function() {
    const cpu = createCPU();
    const memory = createMemory(new Uint8Array([0x21, 0x20, 0x21]));
    const ld = new instruction.OpLdD16ToR16(0x00);

    cpu.SP = 0;
    assert.strictEqual(cpu.SP, 0);

    assert.strictEqual("LD HL, $0x2120", ld.disassemble(memory));

    assert.strictEqual(cpu.getHL(), 0);
    ld.exec(cpu, memory);
    assert.strictEqual(cpu.getHL(), 0x2120);
  });
});

describe("OpLdD8ToR8", function() {
  it("should correctly disassemble", function() {
    let memory = createMemory(new Uint8Array([0x16, 0x34]));
    const ld = new instruction.OpLdD8ToR8(0x00);
    assert.strictEqual("LD D, $0x34", ld.disassemble(memory));

    memory = createMemory(new Uint8Array([0x36, 0x34]));
    assert.strictEqual("LD (HL), $0x34", ld.disassemble(memory));
  });
});

describe("OpLdD8ToR8", function() {
  it("should correctly disassemble", function() {
    const ld = new instruction.OpLdR8ToR8(0x00);
    let memory = createMemory(new Uint8Array([0x62]));
    assert.strictEqual("LD H, D", ld.disassemble(memory));

    memory = createMemory(new Uint8Array([0x74]));
    assert.strictEqual("LD (HL), H", ld.disassemble(memory));

    memory = createMemory(new Uint8Array([0x7e]));
    assert.strictEqual("LD A, (HL)", ld.disassemble(memory));
  });
});

describe("OpLdR8ToA16", function() {
  it("should correctly disassemble", function() {
    const ld = new instruction.OpLdR8ToA16(0x00);

    let memory = createMemory(new Uint8Array([0x22]));
    assert.strictEqual("LD (HL+), A", ld.disassemble(memory));

    memory = createMemory(new Uint8Array([0x02]));
    assert.strictEqual("LD (BC), A", ld.disassemble(memory));

    memory = createMemory(new Uint8Array([0x70]));
    assert.strictEqual("LD (HL), B", ld.disassemble(memory));

    memory = createMemory(new Uint8Array([0x74]));
    assert.strictEqual("LD (HL), H", ld.disassemble(memory));

    memory = createMemory(new Uint8Array([0x75]));
    assert.strictEqual("LD (HL), L", ld.disassemble(memory));

    memory = createMemory(new Uint8Array([0x77]));
    assert.strictEqual("LD (HL), A", ld.disassemble(memory));
  });
});

describe("OpPop & OpPush", function() {
  it("should correctly pop/push", function() {
    function testR16(name: string, opcodePush: number, opcodePop: number) {
      let r1: number, r2: number;
      switch (name) {
        case "BC":
          r1 = 0;
          r2 = 1;
          break;
        case "DE":
          r1 = 2;
          r2 = 3;
          break;
        case "HL":
          r1 = 4;
          r2 = 5;
          break;
        case "AF":
          r1 = 7;
          r2 = 6;
          break;
        default:
          throw new Error(`Unknown register ${name}`);
      }
      const cpu = createCPU();
      const memory = createMemory(new Uint8Array([opcodePush, opcodePop]));
      const push = new instruction.OpPush(0x00);
      const pop = new instruction.OpPop(0x01);

      assert.strictEqual(`POP ${name}`, pop.disassemble(memory));
      assert.strictEqual(`PUSH ${name}`, push.disassemble(memory));

      const HLVal = 0x1122;
      cpu.setCombinedRegister(r1, r2, HLVal);
      assert.strictEqual(cpu.getCombinedRegister(r1, r2), HLVal);
      push.exec(cpu, memory);

      const HLValHigh = HLVal >> 8;
      const HLValLow = HLVal & 0xff;

      assert.strictEqual(HLValLow, memory.getByte(cpu.SP));
      assert.strictEqual(HLValHigh, memory.getByte(cpu.SP + 1));

      cpu.setCombinedRegister(r1, r2, 0);
      assert.strictEqual(cpu.getCombinedRegister(r1, r2), 0);

      pop.exec(cpu, memory);
      assert.strictEqual(cpu.getCombinedRegister(r1, r2), HLVal);
    }

    testR16("BC", 0xc5, 0xc1);
    testR16("DE", 0xd5, 0xd1);
    testR16("HL", 0xe5, 0xe1);
  });
});

describe("rotations", function() {
  it("should correctly rotate A left", function() {
    const cpu = createCPU();
    const memory = createMemory(new Uint8Array());
    const opRLCA = new instruction.OpRLCA(0x00);
    assert.strictEqual(cpu.getReg(0x7), 0);
    assert.strictEqual(cpu.getCarryFlag(), 0);

    // 0b1_1010_0000 rotated left is
    // 0b1_0100_0001
    cpu.setReg(0x7, 0b1010_0000);
    cpu.setCarryFlagDirect(1);
    opRLCA.exec(cpu, memory);
    assert.strictEqual(cpu.getReg(0x7), 0b0100_0001);
    assert.strictEqual(cpu.getCarryFlag(), 1);

    // 0b1_0001_0110 rotated left is
    // 0b0_0010_1101
    cpu.setReg(0x7, 0b0001_0110);
    cpu.setCarryFlagDirect(1);
    opRLCA.exec(cpu, memory);
    // assert.strictEqual(cpu.getReg(0x7), 0b0010_1101); // TODO fix this test or the code
    // assert.strictEqual(cpu.getCarryFlag(), 0);
  });

  it("should correctly rotate A right", function() {
    const cpu = createCPU();
    const memory = createMemory(new Uint8Array());
    const opRRCA = new instruction.OpRRCA(0x00);
    assert.strictEqual(cpu.getReg(0x7), 0);
    assert.strictEqual(cpu.getCarryFlag(), 0);

    // 0b1_1010_0001 rotated right is
    // 0b1_0101_0000
    cpu.setReg(0x7, 0b1010_0000);
    cpu.setCarryFlagDirect(1);
    opRRCA.exec(cpu, memory);
    assert.strictEqual(cpu.getReg(0x7), 0b0101_0000);
    assert.strictEqual(cpu.getCarryFlag(), 0);

    // 0b0_0001_0110 rotated right is
    // 0b0_0000_1011
    cpu.setReg(0x7, 0b0001_0110);
    cpu.setCarryFlagDirect(0);
    opRRCA.exec(cpu, memory);
    assert.strictEqual(cpu.getReg(0x7), 0b0000_1011);
    assert.strictEqual(cpu.getCarryFlag(), 0);
  });

  it("should correctly rotate left", function() {
    const cpu = createCPU();
    const memory = createMemory(new Uint8Array([0xcb, 0x00]));
    const opRLC = new instruction.OpRLC(0x00);
    assert.strictEqual(cpu.getCarryFlag(), 0);
    assert.strictEqual(cpu.getZeroFlag(), 0);

    // 0b1000_0000 rotated is
    // 0b0000_0001
    cpu.setReg(0x00, 0b1000_0000);
    opRLC.exec(cpu, memory);
    assert.strictEqual(cpu.getReg(0x00), 0b0000_0001);
    assert.strictEqual(cpu.getCarryFlag(), 1);
    assert.strictEqual(cpu.getZeroFlag(), 1);
    assert.strictEqual(cpu.getHalfCarryFlag(), 0);
    assert.strictEqual(cpu.getSubtractFlag(), 0);

    cpu.setReg(0x00, 0b0000_0000);
    opRLC.exec(cpu, memory);
    assert.strictEqual(cpu.getReg(0x00), 0b0000_0000);
    assert.strictEqual(cpu.getCarryFlag(), 0);
    assert.strictEqual(cpu.getZeroFlag(), 1);
    assert.strictEqual(cpu.getHalfCarryFlag(), 0);
    assert.strictEqual(cpu.getSubtractFlag(), 0);

    // 0b0111_1111 rotated is
    // 0b1111_1110
    cpu.setReg(0x00, 0b0111_1111);
    opRLC.exec(cpu, memory);
    assert.strictEqual(cpu.getReg(0x00), 0b1111_1110);
    assert.strictEqual(cpu.getCarryFlag(), 0);
    assert.strictEqual(cpu.getZeroFlag(), 0);
    assert.strictEqual(cpu.getHalfCarryFlag(), 0);
    assert.strictEqual(cpu.getSubtractFlag(), 0);
  });
});

describe("shifts", function() {
  it("should correctly SRA", function() {
    const cpu = createCPU();
    const memory = createMemory(new Uint8Array([0xcb, 0x2f]));
    const opSRA = new instruction.OpSRA(0x00);

    cpu.setReg(CPU.A, 0);
    cpu.setCarryFlagDirect(0);
    opSRA.exec(cpu, memory);
    assert.strictEqual(cpu.getReg(CPU.A), 0);
    assert.strictEqual(cpu.getCarryFlag(), 0);
    assert.strictEqual(cpu.getSubtractFlag(), 0);
    assert.strictEqual(cpu.getHalfCarryFlag(), 0);
    assert.strictEqual(cpu.getZeroFlag(), 1);

    // 0b1_1111_1111 turns into
    // 0b1_1111_1111
    cpu.setReg(CPU.A, 0b1111_1111);
    cpu.setCarryFlagDirect(1);
    opSRA.exec(cpu, memory);
    assert.strictEqual(cpu.getReg(CPU.A), 0b1111_1111);
    assert.strictEqual(cpu.getCarryFlag(), 1);
    assert.strictEqual(cpu.getSubtractFlag(), 0);
    assert.strictEqual(cpu.getHalfCarryFlag(), 0);
    assert.strictEqual(cpu.getZeroFlag(), 0);

    // 0b1_1010_0000 turns into
    // 0b0_1101_0000
    cpu.setReg(CPU.A, 0b1010_0000);
    cpu.setCarryFlagDirect(1);
    opSRA.exec(cpu, memory);
    assert.strictEqual(cpu.getReg(CPU.A), 0b1101_0000);
    assert.strictEqual(cpu.getCarryFlag(), 0);
    assert.strictEqual(cpu.getSubtractFlag(), 0);
    assert.strictEqual(cpu.getHalfCarryFlag(), 0);
    assert.strictEqual(cpu.getZeroFlag(), 0);
  });
});

describe("bit extractions", function() {
  it("should correctly disassemble bit ops", function() {
    function getMemory(opcode: number) {
      return createMemory(new Uint8Array([0xcb, opcode]));
    }
    const opBit = new instruction.OpBit(0x00);

    let memory = getMemory(0x7c);
    assert.strictEqual(opBit.disassemble(memory), "BIT 7, H");

    memory = getMemory(0x78);
    assert.strictEqual(opBit.disassemble(memory), "BIT 7, B");

    memory = getMemory(0x59);
    assert.strictEqual(opBit.disassemble(memory), "BIT 3, C");

    memory = getMemory(0x53);
    assert.strictEqual(opBit.disassemble(memory), "BIT 2, E");

    memory = getMemory(0x66);
    assert.strictEqual(opBit.disassemble(memory), "BIT 4, (HL)");

    memory = getMemory(0x4e);
    assert.strictEqual(opBit.disassemble(memory), "BIT 1, (HL)");

    // BIT 7, H
    memory = getMemory(0x7c);
    const cpu = createCPU();
    cpu.setHL(0x8000);
    assert.strictEqual(cpu.getReg(CPU.H), 0x80);
    assert.strictEqual(cpu.getReg(CPU.L), 0x00);

    assert.strictEqual(cpu.getZeroFlag(), 0);
    opBit.execAndIncrementPC(cpu, memory);
    assert.strictEqual(cpu.getZeroFlag(), 0);

    cpu.setHL(0x8000 - 1);
    assert.strictEqual(cpu.getReg(CPU.H), 0x7f);
    assert.strictEqual(cpu.getReg(CPU.L), 0xff);
    opBit.execAndIncrementPC(cpu, memory);
    assert.strictEqual(cpu.getZeroFlag(), 1);
  });
});
