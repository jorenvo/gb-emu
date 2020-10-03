import { CPU } from "./cpu.js";
import { Memory } from "./memory.js";
import * as utils from "./utils.js";

export abstract class Instruction {
  protected address: number;
  executions: number;

  constructor(address: number) {
    this.address = address;
    this.executions = 0;
  }

  getStringForR8(n: number) {
    switch (n) {
      case 0:
        return "B";
      case 1:
        return "C";
      case 2:
        return "D";
      case 3:
        return "E";
      case 4:
        return "H";
      case 5:
        return "L";
      case 6:
        return "F";
      case 7:
        return "A";
      default:
        throw new Error(`Register ${n} doesn't exist.`);
    }
  }

  getStringForR16(n: number) {
    switch (n) {
      case 0:
        return "BC";
      case 1:
        return "DE";
      case 2:
        return "HL";
      case 3:
        return "SP";
      case 3:
        return "AF";
      default:
        throw new Error(`Register ${n} doesn't exist.`);
    }
  }

  execAndIncrementPC(cpu: CPU, memory: Memory) {
    const originalPC = cpu.PC;
    this.exec(cpu, memory);

    if (originalPC === cpu.PC) {
      cpu.PC += this.size();
    }

    this.executions++;
  }

  getAddress() {
    return this.address;
  }

  getByte(memory: Memory) {
    return memory.getByte(this.address);
  }

  getNext8Bits(memory: Memory) {
    return memory.getByte(this.address + 1);
  }

  getNext16Bits(memory: Memory) {
    // Loads the next 16 bits (little-endian)
    const low = memory.getByte(this.address + 1);
    const high = memory.getByte(this.address + 2);
    return (high << 8) | low;
  }

  abstract size(): number;
  abstract exec(cpu: CPU, memory: Memory): void;
  abstract disassemble(memory: Memory): string;
}

export class NotImplemented extends Instruction {
  size() {
    return 0;
  }

  exec(_cpu: CPU, memory: Memory) {
    utils.log(
      this.address,
      `Executing not implemented instruction with opcode ${memory.getByte(
        this.address
      )}`
    );
  }

  disassemble(memory: Memory) {
    return `NIP ${this.getByte(memory)}`;
  }
}

export class OpNop extends Instruction {
  size() {
    return 1;
  }

  exec(_cpu: CPU, _memory: Memory) {}

  disassemble(_memory: Memory) {
    return "NOP";
  }
}

export class OpUnknown extends Instruction {
  constructor(address: number) {
    super(address);
    console.log(`Unknown instruction at ${utils.hexString(address, 16)}`);
  }

  size() {
    return 1;
  }

  exec(_cpu: CPU, _memory: Memory) {}

  disassemble(_memory: Memory) {
    return "UNK";
  }
}

export class OpLdD16ToR16 extends Instruction {
  size() {
    return 3;
  }

  exec(cpu: CPU, memory: Memory) {
    const d16 = this.getNext16Bits(memory);

    if (this.getByte(memory) === 0x31) {
      cpu.SP = d16;
    } else {
      const register = utils.getBits(this.getByte(memory), 4, 5) * 2;
      cpu.regs[register] = d16 >> 8;
      cpu.regs[register + 1] = d16 & 0xff;
    }
  }

  disassemble(memory: Memory) {
    let reg;
    switch (this.getByte(memory) >> 4) {
      case 0x0:
        reg = "BC";
        break;
      case 0x1:
        reg = "DE";
        break;
      case 0x2:
        reg = "HL";
        break;
      case 0x3:
        reg = "SP";
        break;
      default:
        throw new Error("Unknown register!");
    }

    const d16Hex = utils.hexString(this.getNext16Bits(memory), 16);
    return `LD ${reg}, $${d16Hex}`;
  }
}

// autogenerated classes start here
// LD (HL), d8
// LD A, d8
export class OpLdD8ToR8 extends Instruction {
  size() {
    return 2;
  }

  private getRegister(memory: Memory) {
    const byte = this.getByte(memory);
    let reg = (byte >> 4) * 2;
    if ((byte & 0xf) === 0xe) {
      ++reg;
    }

    return reg;
  }

  private isHL(memory: Memory) {
    return this.getByte(memory) === 0x36;
  }

  exec(cpu: CPU, memory: Memory) {
    const register = this.getRegister(memory);
    const d8 = this.getNext8Bits(memory);
    if (this.isHL(memory)) {
      memory.setByte(cpu.getHL(), d8);
    } else {
      cpu.regs[register] = d8;
    }
  }

  disassemble(memory: Memory) {
    const d8 = this.getNext8Bits(memory);

    let dest = "(HL)";
    if (!this.isHL(memory)) {
      dest = this.getStringForR8(this.getRegister(memory));
    }

    return `LD ${dest}, $${utils.hexString(d8, 8)}`;
  }
}

export class OpLdR8ToA16 extends Instruction {
  size() {
    return 1;
  }

  exec(cpu: CPU, memory: Memory) {
    let register = 0;
    switch (this.getByte(memory)) {
      case 0x02:
        register = 0;
        break;
      case 0x12:
        register = 2;
        break;
      case 0x22:
      case 0x32:
      case 0x70:
      case 0x71:
      case 0x72:
      case 0x73:
      case 0x74:
      case 0x75:
      case 0x77:
        register = 4;
        break;
    }
    const high = cpu.regs[register];
    const low = cpu.regs[register + 1];
    let addr = (high << 8) | low;
    memory.setByte(addr, cpu.regs[memory.getByte(this.address & 0b1111)]);

    switch (this.getByte(memory)) {
      case 0x22:
        cpu.setHL(cpu.getHL() + 1);
        break;
      case 0x32:
        cpu.setHL(cpu.getHL() - 1);
        break;
    }
  }

  disassemble(memory: Memory) {
    let dest = "";
    const byte = this.getByte(memory);
    switch (byte) {
      case 0x02:
        dest = "BC";
        break;
      case 0x12:
        dest = "DE";
        break;
      case 0x22:
        dest = "HL+";
        break;
      case 0x32:
        dest = "HL-";
        break;
      case 0x70:
      case 0x71:
      case 0x72:
      case 0x73:
      case 0x74:
      case 0x75:
      case 0x77:
        dest = "HL";
        break;
      default:
        utils.log(
          byte,
          `unknown opLdR8ToA16 at ${utils.hexString(this.address, 16)}`
        );
    }

    let src = "A";
    if (byte >> 4 === 7) {
      const reg = byte & 0b1111;
      src = this.getStringForR8(reg);
    }

    return `LD (${dest}), ${src}`;
  }
}

export class OpLdA16ToA extends Instruction {
  size() {
    return 1;
  }

  exec(cpu: CPU, memory: Memory) {
    const register = this.getByte(memory) * 2;
    const aHigh = cpu.regs[register];
    const aLow = cpu.regs[register + 1];
    let addr = (aHigh << 8) | aLow;
    cpu.regs[CPU.A] = memory.getByte(addr);

    switch (this.getByte(memory)) {
      case 0x2a:
        cpu.setHL(cpu.getHL() + 1);
        break;
      case 0x3a:
        cpu.setHL(cpu.getHL() - 1);
        break;
    }
  }

  disassemble(memory: Memory) {
    let src = "";
    switch (this.getByte(memory)) {
      case 0x0a:
        src = "BC";
        break;
      case 0x1a:
        src = "DE";
        break;
      case 0x2a:
        src = "HL+";
        break;
      case 0x3a:
        src = "HL-";
        break;
      default:
        utils.log(this.getByte(memory), "unknown OpLdA16ToA");
    }

    return `LD A, (${src})`;
  }
}

export class OpLdAtoAddrC extends Instruction {
  size() {
    return 1;
  }

  exec(cpu: CPU, memory: Memory) {
    memory.setByte(cpu.regs[CPU.C], cpu.regs[CPU.A]);
  }

  disassemble(_memory: Memory) {
    return "LD ($0xff00+C), A";
  }
}

export class OpLdSPToA16 extends Instruction {
  size() {
    return 3;
  }

  exec(cpu: CPU, memory: Memory) {
    const a16 = this.getNext16Bits(memory);

    // TODO: this order is correct, should we always store LSB before MSB?
    memory.setByte(a16, cpu.SP & 0xff);
    memory.setByte(a16 + 1, cpu.SP >> 8);
  }

  disassemble(memory: Memory) {
    return `LD $${utils.hexString(this.getNext16Bits(memory), 16)}, SP`;
  }
}

export class OpLdhA8 extends Instruction {
  size() {
    return 2;
  }

  _getAddr(memory: Memory) {
    return this.getNext8Bits(memory);
  }

  exec(cpu: CPU, memory: Memory) {
    const lowAddr = this._getAddr(memory);
    memory.setByte(0xff00 | lowAddr, cpu.regs[CPU.A]);
  }

  disassemble(memory: Memory) {
    return `LDH ($0xff00+$${utils.hexString(this._getAddr(memory))}), A`;
  }
}

export class OpLdR8ToR8 extends Instruction {
  size() {
    return 1;
  }

  _getSrcReg(memory: Memory) {
    return utils.getBits(this.getByte(memory), 0, 2);
  }

  _getDestReg(memory: Memory) {
    return utils.getBits(this.getByte(memory), 3, 5);
  }

  exec(cpu: CPU, memory: Memory) {
    const srcReg = this._getSrcReg(memory);
    const destReg = this._getDestReg(memory);

    if (srcReg === 6) {
      cpu.regs[destReg] = memory.getByte(cpu.getHL());
    } else if (destReg === 6) {
      memory.setByte(cpu.getHL(), cpu.regs[srcReg]);
    } else {
      cpu.regs[destReg] = cpu.regs[srcReg];
    }
  }

  disassemble(memory: Memory) {
    const srcReg = this._getSrcReg(memory);
    const destReg = this._getDestReg(memory);

    let src = this.getStringForR8(srcReg);
    let dest = this.getStringForR8(destReg);

    if (srcReg === 6) {
      src = "(HL)";
    } else if (destReg === 6) {
      dest = "(HL)";
    }

    return `LD ${dest}, ${src}`;
  }
}

export abstract class OpDecInc16 extends Instruction {
  size() {
    return 1;
  }

  do(cpu: CPU, memory: Memory, inc: boolean) {
    // TODO: SP will be 0x3, check if that works
    const register = (this.getByte(memory) >> 4) * 2;
    const high = cpu.regs[register];
    const low = cpu.regs[register + 1];

    let r16 = (high << 8) | low;
    r16 += inc ? 1 : -1;
    cpu.regs[register] = r16 >> 8;
    cpu.regs[register + 1] = r16 & 0xff;
  }
}

export class OpInc16 extends OpDecInc16 {
  exec(cpu: CPU, memory: Memory) {
    if (this.getByte(memory) === 0x33) {
      ++cpu.SP;
      // TODO set flags
    } else {
      super.do(cpu, memory, true);
    }
  }

  disassemble(memory: Memory) {
    const reg = this.getStringForR16(this.getByte(memory) >> 4);
    return `INC ${reg}`;
  }
}

export class OpDec16 extends OpDecInc16 {
  exec(cpu: CPU, memory: Memory) {
    super.do(cpu, memory, false); // TODO no special case for SP like in Inc?
  }

  disassemble(memory: Memory) {
    const reg = this.getStringForR16(this.getByte(memory) >> 4);
    return `DEC ${reg}`;
  }
}

export class OpInc8 extends Instruction {
  size() {
    return 1;
  }

  _getReg(memory: Memory) {
    const opcode = this.getByte(memory);
    switch (opcode) {
      case 0x04:
        return 0;
      case 0x14:
        return 2;
      case 0x24:
        return 4;
      case 0x0c:
        return 1;
      case 0x1c:
        return 3;
      case 0x2c:
        return 5;
      case 0x3c:
        return 7;
      default:
        throw new Error(`Unknown register for opcode ${opcode}`);
    }
  }

  exec(cpu: CPU, memory: Memory) {
    if (this.getByte(memory) === 0x34) {
      let addr = cpu.getHL();
      cpu.setHalfCarryFlagAdd(memory.getByte(addr), 1);
      memory.setByte(addr, memory.getByte(addr) + 1);
      cpu.setZeroFlag(memory.getByte(addr) === 0 ? 1 : 0);
    } else {
      const register = this._getReg(memory);
      cpu.setHalfCarryFlagAdd(cpu.regs[register], 1);
      cpu.regs[register] += 1;
      cpu.setZeroFlag(cpu.regs[register] === 0 ? 1 : 0);
    }

    cpu.setSubtractFlag(0);
  }

  disassemble(memory: Memory) {
    let reg = "";
    if (this.getByte(memory) === 0x34) {
      reg = "(HL)";
    } else {
      reg = this.getStringForR8(this._getReg(memory));
    }

    return `INC ${reg}`;
  }
}

export class OpDec8 extends Instruction {
  size() {
    return 1;
  }

  _getReg(memory: Memory) {
    const opcode = this.getByte(memory);
    switch (opcode) {
      case 0x05:
        return 0;
      case 0x15:
        return 2;
      case 0x25:
        return 4;
      case 0x0d:
        return 1;
      case 0x1d:
        return 3;
      case 0x2d:
        return 5;
      case 0x3d:
        return 7;
      default:
        throw new Error(`Unknown register for opcode ${opcode}`);
    }
  }

  exec(cpu: CPU, memory: Memory) {
    if (this.getByte(memory) === 0x35) {
      let addr = cpu.getHL();
      cpu.setHalfCarryFlagAdd(memory.getByte(addr), -1);
      memory.setByte(addr, memory.getByte(addr) - 1);
      cpu.setZeroFlag(memory.getByte(addr) === 0 ? 1 : 0);
    } else {
      const register = this._getReg(memory);
      cpu.setHalfCarryFlagAdd(cpu.regs[register], -1);
      cpu.regs[register] -= 1;
      cpu.setZeroFlag(cpu.regs[register] === 0 ? 1 : 0);
    }

    cpu.setSubtractFlag(1);
  }

  disassemble(memory: Memory) {
    let reg = "";
    if (this.getByte(memory) === 0x35) {
      reg = "(HL)";
    } else {
      reg = this.getStringForR8(this._getReg(memory));
    }

    return `DEC ${reg}`;
  }
}

export class OpRLCA extends Instruction {
  size() {
    return 1;
  }

  exec(cpu: CPU, memory: Memory) {
    const [carryBit, rotatedReg] = cpu.rotateLeftCarry(
      cpu.getCarryFlag(),
      cpu.regs[CPU.A]
    );
    cpu.regs[CPU.A] = rotatedReg;
    cpu.setCarryFlagDirect(carryBit);

    cpu.setHalfCarryFlagAdd(0, 0);
    cpu.setSubtractFlag(0);
    cpu.setZeroFlag(cpu.regs[CPU.A] === 0 ? 1 : 0);
  }

  disassemble(_memory: Memory) {
    return "RLCA";
  }
}

export class OpRRCA extends Instruction {
  size() {
    return 1;
  }

  exec(cpu: CPU, memory: Memory) {
    const lsb = cpu.regs[CPU.A] & 1;
    cpu.regs[CPU.A] >>= 1;
    cpu.regs[CPU.A] |= cpu.getCarryFlag() << 7;
    cpu.setCarryFlagDirect(lsb);

    cpu.setHalfCarryFlagAdd(0, 0);
    cpu.setSubtractFlag(0);
    cpu.setZeroFlag(cpu.regs[CPU.A] === 0 ? 1 : 0);
  }

  disassemble(_memory: Memory) {
    return "RRCA";
  }
}

export class OpRLA extends Instruction {
  size() {
    return 1;
  }

  exec(cpu: CPU, _memory: Memory) {
    cpu.regs[CPU.A] = cpu.rotateLeft(cpu.regs[CPU.A]);
    cpu.setCarryFlagDirect(cpu.regs[CPU.A] >> 7);

    cpu.setHalfCarryFlagAdd(0, 0);
    cpu.setSubtractFlag(0);
    cpu.setZeroFlag(cpu.regs[CPU.A] === 0 ? 1 : 0);
  }

  disassemble(_memory: Memory) {
    return "RLA";
  }
}

export class OpRL extends Instruction {
  size() {
    return 2;
  }

  _getReg(memory: Memory) {
    return this.getNext8Bits(memory) & 0xf;
  }

  exec(cpu: CPU, memory: Memory) {
    const register = this._getReg(memory);
    let value = 0;
    if (register === 6) {
      value = cpu.rotateLeft(cpu.getHL());
      cpu.setHL(value);
    } else {
      value = cpu.rotateLeft(cpu.regs[register]);
      cpu.regs[register] = value;
    }

    cpu.setCarryFlagDirect(value >> 7);
    cpu.setHalfCarryFlagAdd(0, 0);
    cpu.setSubtractFlag(0);
    cpu.setZeroFlag(value === 0 ? 1 : 0);
  }

  disassemble(memory: Memory) {
    const reg = this._getReg(memory);
    let regString = "(HL)";
    if (reg !== 6) {
      regString = this.getStringForR8(reg);
    }

    return `RL ${regString}`;
  }
}

export class OpRRA extends Instruction {
  size() {
    return 1;
  }

  exec(cpu: CPU, _memory: Memory) {
    const lsb = cpu.regs[CPU.A] & 1;
    cpu.regs[CPU.A] >>= 1;
    cpu.regs[CPU.A] |= lsb << 7;
    cpu.setCarryFlagDirect(lsb);

    cpu.setHalfCarryFlagAdd(0, 0);
    cpu.setSubtractFlag(0);
    cpu.setZeroFlag(0);
  }

  disassemble(_memory: Memory) {
    return "RRA";
  }
}

export class OpAddR16ToHL extends Instruction {
  size() {
    return 1;
  }

  _getReg(memory: Memory) {
    return (this.getByte(memory) >> 4) * 2;
  }

  exec(cpu: CPU, memory: Memory) {
    const register = this._getReg(memory);
    const r16 = cpu.getCombinedRegister(register, register + 1);
    let hl = cpu.getHL();
    cpu.setHalfCarryFlagAdd(r16, hl);
    cpu.setCarryFlagAdd(r16, hl);
    cpu.setHL(hl + r16);
    cpu.setSubtractFlag(0);
  }

  disassemble(memory: Memory) {
    const reg = this.getStringForR16(this._getReg(memory));
    return `ADD HL, ${reg}`;
  }
}

export class OpStop extends Instruction {
  size() {
    return 1;
  }

  exec(_cpu: CPU, memory: Memory) {
    utils.log(this.getByte(memory), "TODO: stop");
  }

  disassemble(_memory: Memory) {
    return "STOP";
  }
}

export class OpJR extends Instruction {
  size() {
    return 2;
  }

  private getRelativeOffset(memory: Memory) {
    return utils.twosComplementToNumber(this.getNext8Bits(memory));
  }

  exec(cpu: CPU, memory: Memory) {
    cpu.PC += this.size() + this.getRelativeOffset(memory);
  }

  disassemble(memory: Memory) {
    return `JR $${utils.hexString(this.getRelativeOffset(memory))}`;
  }
}

export class OpJRC extends Instruction {
  size() {
    return 2;
  }

  private getRelativeOffset(memory: Memory) {
    return utils.twosComplementToNumber(this.getNext8Bits(memory));
  }

  exec(cpu: CPU, memory: Memory) {
    let condition = false;
    switch (this.getByte(memory)) {
      case 0x20:
        condition = cpu.getZeroFlag() !== 0;
        break;
      case 0x30:
        condition = cpu.getCarryFlag() !== 0;
        break;
      case 0x28:
        condition = cpu.getZeroFlag() === 0;
        break;
      case 0x38:
        condition = cpu.getCarryFlag() === 0;
        break;
      default:
        utils.log(this.getByte(memory), "JRC condition not implement");
    }

    if (condition) {
      cpu.PC += this.size() + this.getRelativeOffset(memory);
    }
  }

  disassemble(memory: Memory) {
    let condition = "";
    switch (this.getByte(memory)) {
      case 0x20:
        condition = "NZ";
        break;
      case 0x30:
        condition = "NC";
        break;
      case 0x28:
        condition = "Z";
        break;
      case 0x38:
        condition = "C";
        break;
      default:
        condition = "UNS";
        break;
    }
    return `JR ${condition}, $${utils.hexString(
      this.getRelativeOffset(memory)
    )}`;
  }
}

export class OpCPL extends Instruction {
  size() {
    return 1;
  }

  exec(cpu: CPU, _memory: Memory) {
    cpu.regs[CPU.A] ^= 0xff;
    cpu.setZeroFlag(1);
    cpu.setSubtractFlag(1);
  }

  disassemble(_memory: Memory) {
    return "CPL";
  }
}

export class OpXorR8 extends Instruction {
  size() {
    return 1;
  }

  private isHL(memory: Memory) {
    return this.getByte(memory) === 0x7e;
  }

  private getReg(memory: Memory) {
    return this.getByte(memory) & 0b111;
  }

  exec(cpu: CPU, memory: Memory) {
    if (this.isHL(memory)) {
      cpu.regs[CPU.A] ^= cpu.getHL();
    } else {
      const register = this.getReg(memory);
      cpu.regs[CPU.A] ^= cpu.regs[register];
    }
    cpu.setZeroFlag(cpu.regs[CPU.A] === 0 ? 1 : 0);
    cpu.setSubtractFlag(0);
    cpu.setCarryFlagDirect(0);
    cpu.setHalfCarryFlagAdd(0, 0);
  }

  disassemble(memory: Memory) {
    let reg = "(HL)";
    if (!this.isHL(memory)) {
      reg = this.getStringForR8(this.getReg(memory));
    }

    return `XOR ${reg}`;
  }
}

export class OpCall extends Instruction {
  size() {
    return 3;
  }

  exec(cpu: CPU, memory: Memory) {
    const nextPC = cpu.PC + this.size();
    memory.setByte(--cpu.SP, nextPC >> 8);
    memory.setByte(--cpu.SP, nextPC & 0xff);
    console.log(`Should return to ${nextPC}`);
    cpu.PC = this.getNext16Bits(memory);
  }

  disassemble(memory: Memory) {
    let addr = this.getNext16Bits(memory);
    return `CALL $${utils.hexString(addr, 16)}`;
  }
}

export class OpCallIfZero extends OpCall {
  exec(cpu: CPU, memory: Memory) {
    if (cpu.getZeroFlag()) {
      super.exec(cpu, memory);
    }
  }

  disassemble(memory: Memory) {
    let addr = this.getNext16Bits(memory);
    return `CALL Z, $${utils.hexString(addr, 16)}`;
  }
}

export class OpRet extends Instruction {
  size() {
    return 1;
  }

  exec(cpu: CPU, memory: Memory) {
    const low = memory.getByte(cpu.SP++);
    const high = memory.getByte(cpu.SP++);
    cpu.PC = (high << 8) | low;
    console.log(`Returning to ${cpu.PC} (${high} ${low})`);
  }

  disassemble(_memory: Memory) {
    return "RET";
  }
}

export class OpPush extends Instruction {
  size() {
    return 1;
  }

  _getR16(memory: Memory) {
    return utils.getBits(this.getByte(memory), 3, 5);
  }

  exec(cpu: CPU, memory: Memory) {
    let low = 0;
    let high = 0;
    if (this.getByte(memory) === 0xf5) {
      high = cpu.regs[CPU.A];
      low = cpu.regs[CPU.F];
    } else {
      const register = this._getR16(memory);
      high = cpu.regs[register];
      low = cpu.regs[register + 1];
    }

    memory.setByte(--cpu.SP, high);
    memory.setByte(--cpu.SP, low);
  }

  disassemble(memory: Memory) {
    const r16 = this.getStringForR16(this._getR16(memory));
    return `PUSH ${r16}`;
  }
}

export class OpPop extends Instruction {
  size() {
    return 1;
  }

  _getR16(memory: Memory) {
    return utils.getBits(this.getByte(memory), 3, 5);
  }

  exec(cpu: CPU, memory: Memory) {
    if (this.getByte(memory) === 0xf1) {
      cpu.regs[CPU.F] = memory.getByte(cpu.SP++);
      cpu.regs[CPU.A] = memory.getByte(cpu.SP++);
    } else {
      const register = this._getR16(memory);
      cpu.regs[register + 1] = memory.getByte(cpu.SP++);
      cpu.regs[register] = memory.getByte(cpu.SP++);
    }
  }

  disassemble(memory: Memory) {
    const r16 = this.getStringForR16(this._getR16(memory));
    return `POP ${r16}`;
  }
}

export class OpBit extends Instruction {
  size() {
    return 2;
  }

  // E: 3
  // H: 4
  //        7 6 5 4 3 2 1 0
  // 0x63 0b0 1 1 0 0 0 1 1  BIT 4, E
  // 0x64 0b0 1 1 0 0 1 0 0  BIT 4, H
  // 0x73 0b0 1 1 1 0 0 1 1  BIT 6, E
  // 0x74 0b0 1 1 1 0 1 0 0  BIT 6, H
  // ----------------------
  // 0x6b 0b0 1 1 0 1 0 1 1  BIT 5, E
  // 0x6c 0b0 1 1 0 1 1 0 0  BIT 5, H
  // 0x7b 0b0 1 1 1 1 0 1 1  BIT 7, E
  // 0x7c 0b0 1 1 1 1 1 0 0  BIT 7, H
  private getReg(memory: Memory) {
    return utils.getBits(this.getNext16Bits(memory), 0, 2);
  }

  private getBit(memory: Memory) {
    const byte = this.getNext8Bits(memory);
    return utils.getBits(byte, 4, 5) * 2 + utils.getBits(byte, 3, 3);
  }

  exec(cpu: CPU, memory: Memory) {
    const register = this.getReg(memory);
    const bit = this.getBit(memory);
    if (register === 0x6) {
      // (HL)
      throw new Error("Unimplemented BIT instruction");
    } else {
      return utils.getBits(cpu.regs[register], bit, bit);
    }
  }

  disassemble(memory: Memory) {
    const regNr = this.getReg(memory);
    let reg = "(HL)";
    if (regNr !== 0x6) {
      reg = this.getStringForR8(regNr);
    }
    const bit = this.getBit(memory);

    return `BIT ${bit}, ${reg}`;
  }
}

export abstract class OpCP extends Instruction {
  protected abstract getToCompare(cpu: CPU, memory: Memory): number;

  exec(cpu: CPU, memory: Memory) {
    const d8 = this.getToCompare(cpu, memory);
    cpu.setSubtractFlag(1);
    cpu.setHalfCarryFlagAdd(cpu.regs[CPU.A], d8);
    cpu.setCarryFlagAdd(cpu.regs[CPU.A], d8);
    cpu.setZeroFlag(cpu.regs[CPU.A] - d8 === 0 ? 1 : 0);
  }
}

export class OpCPD8 extends OpCP {
  size() {
    return 2;
  }

  protected getToCompare(_cpu: CPU, memory: Memory): number {
    return this.getNext8Bits(memory);
  }

  disassemble(memory: Memory) {
    const d8 = this.getNext8Bits(memory);
    return `CP $${utils.hexString(d8)}`;
  }
}

export class OpCPR8 extends OpCP {
  size() {
    return 1;
  }

  private isHL(memory: Memory) {
    return this.getByte(memory) === 0xbe;
  }

  private getReg(memory: Memory) {
    return this.getByte(memory) & 0b111;
  }

  protected getToCompare(cpu: CPU, memory: Memory): number {
    if (this.isHL(memory)) {
      return memory.getByte(cpu.getHL());
    } else {
      const reg = this.getReg(memory);
      return cpu.regs[reg];
    }
  }

  disassemble(memory: Memory) {
    if (this.isHL(memory)) {
      return "CP (HL)";
    } else {
      const reg = this.getReg(memory);
      return `CP ${this.getStringForR8(reg)}`;
    }
  }
}

export class OpLdAToA16 extends Instruction {
  size() {
    return 3;
  }

  exec(cpu: CPU, memory: Memory) {
    const addr = this.getNext16Bits(memory);
    memory.setByte(addr, cpu.regs[CPU.A]);
  }

  disassemble(memory: Memory) {
    const addr = this.getNext16Bits(memory);
    return `LD ($${utils.hexString(addr, 16)}), A`;
  }
}

export class OpLdhA8toA extends Instruction {
  size() {
    return 2;
  }

  _getAddr(memory: Memory) {
    return this.getNext8Bits(memory);
  }

  exec(cpu: CPU, memory: Memory) {
    const addr = this._getAddr(memory);
    cpu.regs[CPU.A] = memory.getByte(addr);
  }

  disassemble(memory: Memory) {
    const addr = this._getAddr(memory);
    return `LDH A, ($0xff00+$${utils.hexString(addr)})`;
  }
}

export class OpSubR8 extends Instruction {
  size() {
    return 1;
  }

  private getReg(memory: Memory) {
    const opcode = this.getByte(memory);
    return opcode & 0b111;
  }

  protected getToSubtract(cpu: CPU, memory: Memory) {
    const reg = this.getReg(memory);
    return reg === 0x6 ? memory.getByte(cpu.getHL()) : cpu.regs[reg];
  }

  exec(cpu: CPU, memory: Memory) {
    const toSub = this.getToSubtract(cpu, memory);
    cpu.setHalfCarryFlagSubtract(cpu.regs[CPU.A], toSub);
    cpu.setCarryFlagSubtract(cpu.regs[CPU.A], toSub);
    cpu.regs[CPU.A] = utils.wrapping8BitSub(cpu.regs[CPU.A], toSub);
    cpu.setZeroFlag(cpu.regs[CPU.A] === 0 ? 1 : 0);
    cpu.setSubtractFlag(1);
  }

  disassemble(memory: Memory) {
    const regNr = this.getReg(memory);
    let reg = "(HL)";
    if (regNr !== 0x6) {
      reg = this.getStringForR8(regNr);
    }
    return `SUB ${reg}`;
  }
}

export class OpSubCarryR8 extends OpSubR8 {
  protected getToSubtract(cpu: CPU, memory: Memory) {
    return super.getToSubtract(cpu, memory) + cpu.getCarryFlag();
  }

  disassemble(memory: Memory) {
    return super.disassemble(memory).replace("SUB", "SDC");
  }
}

export class OpAddR8 extends Instruction {
  size() {
    return 1;
  }

  private getReg(memory: Memory) {
    const opcode = this.getByte(memory);
    return opcode & 0b111;
  }

  protected getToAdd(cpu: CPU, memory: Memory) {
    const reg = this.getReg(memory);
    return reg === 0x6 ? memory.getByte(cpu.getHL()) : cpu.regs[reg];
  }

  exec(cpu: CPU, memory: Memory) {
    const toAdd = this.getToAdd(cpu, memory);
    cpu.setHalfCarryFlagAdd(cpu.regs[CPU.A], toAdd);
    cpu.setCarryFlagAdd(cpu.regs[CPU.A], toAdd);
    cpu.regs[CPU.A] = utils.wrapping8BitAdd(cpu.regs[CPU.A], toAdd);
    cpu.setZeroFlag(cpu.regs[CPU.A] === 0 ? 1 : 0);
    cpu.setSubtractFlag(0);
  }

  disassemble(memory: Memory) {
    const regNr = this.getReg(memory);
    let reg = "(HL)";
    if (regNr !== 0x6) {
      reg = this.getStringForR8(regNr);
    }
    return `ADD ${reg}`;
  }
}

export class OpAddCarryR8 extends OpAddR8 {
  protected getToAdd(cpu: CPU, memory: Memory) {
    return super.getToAdd(cpu, memory) + cpu.getCarryFlag();
  }

  disassemble(memory: Memory) {
    return super.disassemble(memory).replace("ADD", "ADC");
  }
}

export class OpAddCarryD8 extends Instruction {
  size() {
    return 2;
  }

  _getToAdd(memory: Memory) {
    return this.getNext8Bits(memory);
  }

  exec(cpu: CPU, memory: Memory) {
    const toAdd = utils.wrapping8BitAdd(
      this._getToAdd(memory),
      cpu.getCarryFlag()
    );
    cpu.setHalfCarryFlagAdd(cpu.regs[CPU.A], toAdd);
    cpu.setCarryFlagAdd(cpu.regs[CPU.A], toAdd);
    cpu.regs[CPU.A] = utils.wrapping8BitAdd(cpu.regs[CPU.A], toAdd);
    cpu.setZeroFlag(cpu.regs[CPU.A] === 0 ? 1 : 0);
    cpu.setSubtractFlag(0);
  }

  disassemble(memory: Memory) {
    const toAdd = this._getToAdd(memory);
    return `ADC A, $${utils.hexString(toAdd)}`;
  }
}

export class OpAndR8 extends Instruction {
  size() {
    return 1;
  }

  private getReg(memory: Memory) {
    const opcode = this.getByte(memory);
    return opcode & 0xf;
  }

  exec(cpu: CPU, memory: Memory) {
    const reg = this.getReg(memory);
    const toAnd = reg === 0x6 ? memory.getByte(cpu.getHL()) : cpu.regs[reg];
    cpu.regs[CPU.A] &= toAnd;
    cpu.setZeroFlag(cpu.regs[CPU.A] === 0 ? 1 : 0);
    cpu.setSubtractFlag(0);
    cpu.setHalfCarryFlagDirect(1);
    cpu.setCarryFlagDirect(0);
  }

  disassemble(memory: Memory) {
    const regNr = this.getReg(memory);
    let reg = "(HL)";
    if (regNr !== 0x6) {
      reg = this.getStringForR8(regNr);
    }
    return `AND ${reg}`;
  }
}
