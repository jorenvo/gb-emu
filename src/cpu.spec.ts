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
