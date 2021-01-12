import "mocha";
import * as assert from "assert";
import { CPU } from "./cpu";
import { ControllerMock } from "./controller";

describe("flags", function () {
  it("should correctly set the zero flag", function () {
    const controller = new ControllerMock();
    const cpu = new CPU();
    cpu.setController(controller);
    assert.strictEqual(cpu.getReg(0x6), 0);

    cpu.setZeroFlag(1);
    assert.strictEqual(cpu.getReg(0x6), 0b1000_0000);
    cpu.setZeroFlag(0);
    assert.strictEqual(cpu.getReg(0x6), 0);
  });

  it("should correctly set the half carry bit", function () {
    const controller = new ControllerMock();
    const cpu = new CPU();
    cpu.setController(controller);
    assert.strictEqual(cpu.getHalfCarryFlag(), 0);

    cpu.setHalfCarryFlagAdd(0b1000, 0b0100);
    assert.strictEqual(cpu.getHalfCarryFlag(), 0);

    cpu.setHalfCarryFlagAdd(0b1100, 0b0100);
    assert.strictEqual(cpu.getHalfCarryFlag(), 1);
  });

  it("should correctly rotate large values", function () {
    const controller = new ControllerMock();
    const cpu = new CPU();
    cpu.setController(controller);
    assert.strictEqual(cpu.getCarryFlag(), 0);

    const res = cpu.rotateLeft(0b1111_1111);
    assert.strictEqual(res, 0b1111_1110);
    assert.strictEqual(cpu.getCarryFlag(), 1);
  });
});
