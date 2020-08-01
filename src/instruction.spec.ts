import "mocha";
import * as assert from "assert";
import { CPU } from "./cpu";
import * as instruction from "./instruction";

describe("OpLdD16ToR16", function() {
  it("should correctly load", function() {
    const cpu = new CPU(new Uint8Array([0x21, 0x20, 0x21]));
    cpu.SP = 0;

    const ld = new instruction.OpLdD16ToR16(cpu);
    assert.equal(cpu.SP, 3);

    assert.equal("LD HL, $0x2021", ld.disassemble());

    assert.equal(cpu.HL, 0);
    ld.exec();
    assert.equal(cpu.HL, 0x2021);
  });
});
