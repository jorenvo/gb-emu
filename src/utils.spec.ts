import "mocha";
import * as assert from "assert";
import * as utils from "./utils";

describe("getBits", function () {
  it("should correctly extract bits", function () {
    const byte = 0b01101010;
    assert.strictEqual(utils.getBits(byte, 6, 6), 0b1);
    assert.strictEqual(utils.getBits(byte, 5, 7), 0b011);
    assert.strictEqual(utils.getBits(byte, 2, 4), 0b010);
    assert.strictEqual(utils.getBits(byte, 0, 1), 0b10);
    assert.strictEqual(utils.getBits(byte, 0, 7), byte);
  });
});

describe("2s complement", function () {
  it("should correctly convert 2s complement", function () {
    assert.strictEqual(utils.twosComplementToNumber(0b0000_0000), 0);
    assert.strictEqual(utils.twosComplementToNumber(0b0000_0001), 1);
    assert.strictEqual(utils.twosComplementToNumber(0b0000_0010), 2);
    assert.strictEqual(utils.twosComplementToNumber(0b0111_1110), 126);
    assert.strictEqual(utils.twosComplementToNumber(0b0111_1111), 127);
    assert.strictEqual(utils.twosComplementToNumber(0b1000_0000), -128);
    assert.strictEqual(utils.twosComplementToNumber(0b1000_0001), -127);
    assert.strictEqual(utils.twosComplementToNumber(0b1000_0010), -126);
    assert.strictEqual(utils.twosComplementToNumber(0b1111_1110), -2);
    assert.strictEqual(utils.twosComplementToNumber(0b1111_1111), -1);
  });
});
