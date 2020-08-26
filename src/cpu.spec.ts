import "mocha";
import * as assert from "assert";
import { CPU } from "./cpu";

describe("flags", function () {
  it("should correctly set the zero flag", function () {
    const cpu = new CPU(new Map());
    assert.equal(cpu.regs[0x6], 0);

    cpu.setZeroFlag(1);
    assert.equal(cpu.regs[0x6], 0b1000_0000);
    cpu.setZeroFlag(0);
    assert.equal(cpu.regs[0x6], 0);
  });
});
