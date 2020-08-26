import "mocha";
import * as assert from "assert";
import * as instruction from "./instruction";
import { CPU } from "./cpu";
import { Memory } from "./memory";

describe("OpLdD16ToR16", function () {
  it("should correctly load", function () {
    const ld = new instruction.OpLdD16ToR16(0x00);
    const memory = new Memory(new Uint8Array([0x21, 0x20, 0x21]));
    const cpu = new CPU(new Map([[0x00, ld]]));

    cpu.SP = 0;
    assert.equal(cpu.SP, 0);

    assert.equal("LD HL, $0x2021", ld.disassemble(memory));

    assert.equal(cpu.HL, 0);
    ld.exec(cpu, memory);
    assert.equal(cpu.HL, 0x2021);
  });
});

describe("OpLdD8ToR8", function () {
  it("should correctly disassemble", function () {
    const ld = new instruction.OpLdD8ToR8(0x00);
    const memory = new Memory(new Uint8Array([0x16, 0x34]));
    assert.equal("LD D, $0x34", ld.disassemble(memory));

    memory.bytes = new Uint8Array([0x36, 0x34]);
    assert.equal("LD (HL), $0x34", ld.disassemble(memory));
  });
});

describe("rotations", function () {
  it("should correctly rotate left", function () {
    const memory = new Memory(new Uint8Array());
    const cpu = new CPU(new Map());
    const opRLCA = new instruction.OpRLCA(0x00);
    assert.equal(cpu.regs[0x7], 0);
    assert.equal(cpu.getCarryFlag(), 0);

    // 0b1_1010_0000 rotated left is
    // 0b1_0100_0001
    cpu.regs[0x7] = 0b1010_0000;
    cpu.setCarryFlagDirect(1);
    opRLCA.exec(cpu, memory);
    assert.equal(cpu.regs[0x7], 0b0100_0001);
    assert.equal(cpu.getCarryFlag(), 1);

    // 0b1_0001_0110 rotated left is
    // 0b0_0010_1101
    cpu.regs[0x7] = 0b0001_0110;
    cpu.setCarryFlagDirect(1);
    opRLCA.exec(cpu, memory);
    assert.equal(cpu.regs[0x7], 0b0010_1101);
    assert.equal(cpu.getCarryFlag(), 0);
  });

  it("should correctly rotate right", function () {
    const memory = new Memory(new Uint8Array());
    const cpu = new CPU(new Map());
    const opRRCA = new instruction.OpRRCA(0x00);
    assert.equal(cpu.regs[0x7], 0);
    assert.equal(cpu.getCarryFlag(), 0);

    // 0b1_1010_0000 rotated right is
    // 0b0_1101_0000
    cpu.regs[0x7] = 0b1010_0000;
    cpu.setCarryFlagDirect(1);
    opRRCA.exec(cpu, memory);
    assert.equal(cpu.regs[0x7], 0b1101_0000);
    assert.equal(cpu.getCarryFlag(), 0);

    // 0b0_0001_0111 rotated right is
    // 0b1_0000_1011
    cpu.regs[0x7] = 0b0001_0111;
    cpu.setCarryFlagDirect(0);
    opRRCA.exec(cpu, memory);
    assert.equal(cpu.regs[0x7], 0b0000_1011);
    assert.equal(cpu.getCarryFlag(), 1);
  });
});
