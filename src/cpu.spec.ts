import "mocha";
import * as assert from "assert";
import { CPU } from "./cpu";
import { ControllerMock } from "./controller";

describe("flags", function () {
  it("should correctly set the zero flag", function () {
    const controller = new ControllerMock();
    const cpu = new CPU();
    cpu.setController(controller);
    assert.equal(cpu.getReg(0x6), 0);

    cpu.setZeroFlag(1);
    assert.equal(cpu.getReg(0x6), 0b1000_0000);
    cpu.setZeroFlag(0);
    assert.equal(cpu.getReg(0x6), 0);
  });

  it("should correctly set the half carry bit", function () {
    const controller = new ControllerMock();
    const cpu = new CPU();
    cpu.setController(controller);
    assert.equal(cpu.getHalfCarryFlag(), 0);

    cpu.setHalfCarryFlagAdd(0b1000, 0b0100);
    assert.equal(cpu.getHalfCarryFlag(), 0);

    cpu.setHalfCarryFlagAdd(0b1100, 0b0100);
    assert.equal(cpu.getHalfCarryFlag(), 1);
  });
});
