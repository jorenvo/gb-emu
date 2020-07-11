import "mocha";
import * as assert from "assert";
import { CPU } from "./cpu";

describe("getBits", function() {
  it("should correctly extract bits", function() {
    const cpu = new CPU(new Uint8Array([]));
    const byte = 0b01101010;
    assert.equal(cpu.getBits(byte, 6, 6), 0b1);
    assert.equal(cpu.getBits(byte, 5, 7), 0b011);
    assert.equal(cpu.getBits(byte, 2, 4), 0b010);
    assert.equal(cpu.getBits(byte, 0, 1), 0b10);
    assert.equal(cpu.getBits(byte, 0, 7), byte);
  });
});

describe("flags", function() {
  it("should correctly set the zero flag", function() {
    const cpu = new CPU(new Uint8Array([]));
    assert.equal(cpu.regs[0x6], 0);

    cpu.setZeroFlag(1);
    assert.equal(cpu.regs[0x6], 0b1000_0000);
    cpu.setZeroFlag(0);
    assert.equal(cpu.regs[0x6], 0);
  });
});

describe("rotations", function() {
  it("should correctly rotate left", function() {
    const cpu = new CPU(new Uint8Array([]));
    assert.equal(cpu.regs[0x7], 0);
    assert.equal(cpu.getCarryFlag(), 0);

    // 0b1_1010_0000 rotated left is
    // 0b1_0100_0001
    cpu.regs[0x7] = 0b1010_0000;
    cpu.setCarryFlagDirect(1);
    cpu.opRLCA(0);
    assert.equal(cpu.regs[0x7], 0b0100_0001);
    assert.equal(cpu.getCarryFlag(), 1);

    // 0b1_0001_0110 rotated left is
    // 0b0_0010_1101
    cpu.regs[0x7] = 0b0001_0110;
    cpu.setCarryFlagDirect(1);
    cpu.opRLCA(0);
    assert.equal(cpu.regs[0x7], 0b0010_1101);
    assert.equal(cpu.getCarryFlag(), 0);
  });
});

describe("rotations", function() {
  it("should correctly rotate right", function() {
    const cpu = new CPU(new Uint8Array([]));
    assert.equal(cpu.regs[0x7], 0);
    assert.equal(cpu.getCarryFlag(), 0);

    // 0b1_1010_0000 rotated right is
    // 0b0_1101_0000
    cpu.regs[0x7] = 0b1010_0000;
    cpu.setCarryFlagDirect(1);
    cpu.opRRCA(0);
    assert.equal(cpu.regs[0x7], 0b1101_0000);
    assert.equal(cpu.getCarryFlag(), 0);

    // 0b0_0001_0111 rotated right is
    // 0b1_0000_1011
    cpu.regs[0x7] = 0b0001_0111;
    cpu.setCarryFlagDirect(0);
    cpu.opRRCA(0);
    assert.equal(cpu.regs[0x7], 0b0000_1011);
    assert.equal(cpu.getCarryFlag(), 1);
  });
});

describe("2s complement", function() {
  it("should correctly convert 2s complement", function() {
    const cpu = new CPU(new Uint8Array([]));
    assert.equal(cpu.twosComplementToNumber(0b0000_0000), 0);
    assert.equal(cpu.twosComplementToNumber(0b0000_0001), 1);
    assert.equal(cpu.twosComplementToNumber(0b0000_0010), 2);
    assert.equal(cpu.twosComplementToNumber(0b0111_1110), 126);
    assert.equal(cpu.twosComplementToNumber(0b0111_1111), 127);
    assert.equal(cpu.twosComplementToNumber(0b1000_0000), -128);
    assert.equal(cpu.twosComplementToNumber(0b1000_0001), -127);
    assert.equal(cpu.twosComplementToNumber(0b1000_0010), -126);
    assert.equal(cpu.twosComplementToNumber(0b1111_1110), -2);
    assert.equal(cpu.twosComplementToNumber(0b1111_1111), -1);
  });
});
