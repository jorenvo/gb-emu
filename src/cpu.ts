export class CPU {
  // reg indexes in regs
  static B = 0;
  static C = 1;
  static D = 2;
  static E = 3;
  static H = 4;
  static L = 5;
  static F = 6;
  static A = 7;

  SP: number;
  PC: number;

  regs: Uint8Array;
  memory: Uint8Array;

  constructor(memory: Uint8Array) {
    this.SP = 0;
    this.PC = 0;
    // from 0x0 to 0x7
    // B (0x0)          C (0x1)
    // D (0x2)          E (0x3)
    // H (0x4)          L (0x5)
    // F (flags, 0x6)   A (accumulator, 0x7)
    this.regs = new Uint8Array(new Array(8));
    this.memory = memory;
  }

  // 0b10101010
  //   ^      ^
  //  to:7 from:0
  getBits(byte: number, from: number, to: number): number {
    const length = to - from;
    const mask = (1 << (length + 1)) - 1;
    return (byte >> from) & mask;
  }

  twosComplementToNumber(x: number): number {
    const msb = x >> 7;
    if (msb === 1) {
      // don't use ~ because numbers are signed
      return -(x ^ 0xff) - 1;
    } else {
      return x;
    }
  }

  binString(x: number): string {
    let bin = x.toString(2);
    bin = bin.padStart(8, "0");
    return `0b${bin}`;
  }

  log(byte: number, msg: string) {
    console.log(`${byte}: ${msg}`);
  }

  logNotImplemented(byte: number) {
    console.log(`unknown instruction ${this.binString(byte)}`);
  }

  opLdD16ToR16(byte: number) {
    const d16Low = this.memory[this.PC++];
    const d16High = this.memory[this.PC++];
    const register = this.getBits(byte, 4, 5);
    this.regs[register] = d16High; // TODO: swap these?
    this.regs[register + 1] = d16Low;
  }

  opLdD8ToR8(byte: number) {
    const register = byte * 2;
    const d8 = this.memory[this.PC++];
    this.regs[register] = d8;
  }

  opLdR8ToA16(byte: number) {
    const register = byte * 2;
    const high = this.regs[register];
    const low = this.regs[register + 1];
    const addr = (high << 8) | low;
    this.memory[addr] = this.regs[CPU.A];

    switch (byte) {
      case 0x22:
        ++this.memory[addr];
        break;
      case 0x32:
        --this.memory[addr];
        break;
    }
  }

  opLdA16ToA(byte: number) {
    const register = byte * 2;
    const aHigh = this.regs[register];
    const aLow = this.regs[register + 1];
    this.regs[CPU.A] = this.memory[(aHigh << 8) | aLow];
  }

  opLdSPToA16(_byte: number) {
    const a16Low = this.memory[this.PC++];
    const a16High = this.memory[this.PC++];
    const a16 = (a16High << 8) | a16Low;
    this.memory[a16] = this.PC;
  }

  opDecInc16(byte: number, inc: boolean) {
    // TODO: SP will be 0x3, check if that works
    const register = byte * 2;
    const high = this.regs[register];
    const low = this.regs[register + 1];

    let r16 = (high << 8) | low;
    r16 += inc ? 1 : -1;
    this.regs[register] = r16 >> 8;
    this.regs[register + 1] = r16 & 0xff;
  }

  opInc16(byte: number) {
    this.opDecInc16(byte, true);
  }

  opDec16(byte: number) {
    this.opDecInc16(byte, false);
  }

  setZeroFlag(zeroFlag: number) {
    this.regs[CPU.F] = (this.regs[CPU.F] & 0b0111_1111) | (zeroFlag << 7);
  }

  getZeroFlag(): number {
    return (this.regs[CPU.F] & 0b0111_1111) >> 8;
  }

  setSubtractFlag(isSubtract: boolean) {
    const subFlag = isSubtract ? 1 : 0;
    this.regs[CPU.F] = (this.regs[CPU.F] & 0b1011_1111) | (subFlag << 6);
  }

  setHalfCarryFlag(a: number, b: number) {
    const halfCarryFlag = (a & 0xf) + (b & 0xf) === 0x10 ? 1 : 0;
    this.regs[CPU.F] = (this.regs[CPU.F] & 0b1101_1111) | (halfCarryFlag << 5);
  }

  setCarryFlagDirect(carryFlag: number) {
    this.regs[CPU.F] = (this.regs[CPU.F] & 0b1110_1111) | (carryFlag << 4);
  }

  setCarryFlag(a: number, b: number) {
    const carryFlag = a + b > 0xff ? 1 : 0;
    this.setCarryFlagDirect(carryFlag);
  }

  getCarryFlag(): number {
    return (this.regs[CPU.F] & 0b0001_0000) > 0 ? 1 : 0;
  }

  opInc8(byte: number) {
    const register = byte * 2;
    this.setHalfCarryFlag(this.regs[register], 1);

    this.regs[register] += 1;
    this.setZeroFlag(this.regs[register] === 0 ? 1 : 0);
    this.setSubtractFlag(false);
  }

  opDec8(byte: number) {
    const register = byte * 2;
    this.setHalfCarryFlag(this.regs[register], -1);

    this.regs[register] -= 1;
    this.setZeroFlag(this.regs[register] === 0 ? 1 : 0);
    this.setSubtractFlag(true);
  }

  opRLCA(_byte: number) {
    const msb = (this.regs[CPU.A] & 0b1000_0000) >> 7;
    this.regs[CPU.A] = (this.regs[CPU.A] << 1) & 0b1111_1110;
    this.regs[CPU.A] |= this.getCarryFlag();
    this.setCarryFlagDirect(msb);

    this.setHalfCarryFlag(0, 0);
    this.setSubtractFlag(false);
    this.setZeroFlag(0);
  }

  opRRCA(_byte: number) {
    const lsb = this.regs[CPU.A] & 1;
    this.regs[CPU.A] >>= 1;
    this.regs[CPU.A] |= this.getCarryFlag() << 7;
    this.setCarryFlagDirect(lsb);

    this.setHalfCarryFlag(0, 0);
    this.setSubtractFlag(false);
    this.setZeroFlag(0);
  }

  opRLA(_byte: number) {
    const msb = this.regs[CPU.A] >> 7;
    this.regs[CPU.A] <<= 1;
    this.regs[CPU.A] |= msb;
    this.setCarryFlagDirect(msb);

    this.setHalfCarryFlag(0, 0);
    this.setSubtractFlag(false);
    this.setZeroFlag(0);
  }

  opRRA(_byte: number) {
    const lsb = this.regs[CPU.A] & 1;
    this.regs[CPU.A] >>= 1;
    this.regs[CPU.A] |= lsb << 7;
    this.setCarryFlagDirect(lsb);

    this.setHalfCarryFlag(0, 0);
    this.setSubtractFlag(false);
    this.setZeroFlag(0);
  }

  opAddR16ToHL(byte: number) {
    const register = byte * 2;
    const r16 = (this.regs[register] << 8) | this.regs[register + 1];
    let hl = (this.regs[CPU.H] << 8) | this.regs[CPU.H];
    this.setHalfCarryFlag(r16, hl);
    this.setCarryFlag(r16, hl);
    hl += r16;
    this.setSubtractFlag(false);
  }

  opStop(byte: number) {
    this.log(byte, "TODO: stop");
  }

  opJRE(_byte: number) {
    const relativeOffset = this.regs[CPU.E];
    this.PC += this.twosComplementToNumber(relativeOffset);
  }

  opJRC(byte: number) {
    // On https://gbdev.io/gb-opcodes/optables/classic this byte is an
    // r8, but pretty sure it should be a d8.
    const relativeOffset = this.twosComplementToNumber(this.memory[this.PC++]);
    let condition = false;
    switch (byte) {
      case 0x20:
        condition = this.getZeroFlag() !== 0;
        break;
      case 0x30:
        condition = this.getCarryFlag() !== 0;
        break;
      case 0x28:
        condition = this.getZeroFlag() === 0;
        break;
      case 0x38:
        condition = this.getCarryFlag() === 0;
        break;
      default:
        this.log(byte, "JRC condition not implement");
    }

    if (condition) {
      this.PC += relativeOffset;
    }
  }

  run() {
    while (true) {
      if (this.PC >= this.memory.length) {
        console.log("Trying to read outside of memory, stopping CPU.");
        break;
      }

      const byte = this.memory[this.PC++];
      switch (byte) {
        case 0x00:
          this.log(byte, "nop");
          break;
        case 0x01:
        case 0x11:
        case 0x21:
          this.opLdD16ToR16(byte);
          break;
        case 0x02:
        case 0x12:
        case 0x22:
          this.opLdR8ToA16(byte);
          break;
        case 0x03:
        case 0x13:
          this.opInc16(byte);
          break;
        case 0x04:
        case 0x14:
          this.opInc8(byte);
          break;
        case 0x05:
        case 0x15:
          this.opDec8(byte);
          break;
        case 0x06:
        case 0x16:
          this.opLdD8ToR8(byte);
          break;
        case 0x07:
          this.opRLCA(byte);
          break;
        case 0x08:
          this.opLdSPToA16(byte);
          break;
        case 0x09:
        case 0x19:
          this.opAddR16ToHL(byte);
          break;
        case 0x0a:
        case 0x1a:
          this.opLdA16ToA(byte);
          break;
        case 0x0b:
        case 0x1b:
          this.opDec16(byte);
          break;
        case 0x0c:
        case 0x1c:
          this.opInc8(byte + 1);
          break;
        case 0x0d:
        case 0x1d:
          this.opDec8(byte + 1);
          break;
        case 0x0e:
        case 0x1e:
          this.opLdD8ToR8(byte + 1);
          break;
        case 0x0f:
          this.opRRCA(byte);
          break;
        case 0x10:
          this.opStop(byte);
          break;
        case 0x17:
          this.opRLA(byte);
          break;
        case 0x18:
          this.opJRE(byte);
          break;
        case 0x1f:
          this.opRRA(byte);
          break;
        case 0x20:
          this.opJRC(byte);
          break;
        case 0x21:
          this.logNotImplemented(byte);
          break;
        case 0x22:
          this.logNotImplemented(byte);
          break;
        case 0x23:
          this.logNotImplemented(byte);
          break;
        case 0x24:
          this.logNotImplemented(byte);
          break;
        case 0x25:
          this.logNotImplemented(byte);
          break;
        case 0x26:
          this.logNotImplemented(byte);
          break;
        case 0x27:
          this.logNotImplemented(byte);
          break;
        case 0x28:
          this.logNotImplemented(byte);
          break;
        case 0x29:
          this.logNotImplemented(byte);
          break;
        case 0x2a:
          this.logNotImplemented(byte);
          break;
        case 0x2b:
          this.logNotImplemented(byte);
          break;
        case 0x2c:
          this.logNotImplemented(byte);
          break;
        case 0x2d:
          this.logNotImplemented(byte);
          break;
        case 0x2e:
          this.logNotImplemented(byte);
          break;
        case 0x2f:
          this.logNotImplemented(byte);
          break;
        case 0x30:
          this.logNotImplemented(byte);
          break;
        case 0x31:
          this.logNotImplemented(byte);
          break;
        case 0x32:
          this.logNotImplemented(byte);
          break;
        case 0x33:
          this.logNotImplemented(byte);
          break;
        case 0x34:
          this.logNotImplemented(byte);
          break;
        case 0x35:
          this.logNotImplemented(byte);
          break;
        case 0x36:
          this.logNotImplemented(byte);
          break;
        case 0x37:
          this.logNotImplemented(byte);
          break;
        case 0x38:
          this.logNotImplemented(byte);
          break;
        case 0x39:
          this.logNotImplemented(byte);
          break;
        case 0x3a:
          this.logNotImplemented(byte);
          break;
        case 0x3b:
          this.logNotImplemented(byte);
          break;
        case 0x3c:
          this.logNotImplemented(byte);
          break;
        case 0x3d:
          this.logNotImplemented(byte);
          break;
        case 0x3e:
          this.logNotImplemented(byte);
          break;
        case 0x3f:
          this.logNotImplemented(byte);
          break;
        case 0x40:
          this.logNotImplemented(byte);
          break;
        case 0x41:
          this.logNotImplemented(byte);
          break;
        case 0x42:
          this.logNotImplemented(byte);
          break;
        case 0x43:
          this.logNotImplemented(byte);
          break;
        case 0x44:
          this.logNotImplemented(byte);
          break;
        case 0x45:
          this.logNotImplemented(byte);
          break;
        case 0x46:
          this.logNotImplemented(byte);
          break;
        case 0x47:
          this.logNotImplemented(byte);
          break;
        case 0x48:
          this.logNotImplemented(byte);
          break;
        case 0x49:
          this.logNotImplemented(byte);
          break;
        case 0x4a:
          this.logNotImplemented(byte);
          break;
        case 0x4b:
          this.logNotImplemented(byte);
          break;
        case 0x4c:
          this.logNotImplemented(byte);
          break;
        case 0x4d:
          this.logNotImplemented(byte);
          break;
        case 0x4e:
          this.logNotImplemented(byte);
          break;
        case 0x4f:
          this.logNotImplemented(byte);
          break;
        case 0x50:
          this.logNotImplemented(byte);
          break;
        case 0x51:
          this.logNotImplemented(byte);
          break;
        case 0x52:
          this.logNotImplemented(byte);
          break;
        case 0x53:
          this.logNotImplemented(byte);
          break;
        case 0x54:
          this.logNotImplemented(byte);
          break;
        case 0x55:
          this.logNotImplemented(byte);
          break;
        case 0x56:
          this.logNotImplemented(byte);
          break;
        case 0x57:
          this.logNotImplemented(byte);
          break;
        case 0x58:
          this.logNotImplemented(byte);
          break;
        case 0x59:
          this.logNotImplemented(byte);
          break;
        case 0x5a:
          this.logNotImplemented(byte);
          break;
        case 0x5b:
          this.logNotImplemented(byte);
          break;
        case 0x5c:
          this.logNotImplemented(byte);
          break;
        case 0x5d:
          this.logNotImplemented(byte);
          break;
        case 0x5e:
          this.logNotImplemented(byte);
          break;
        case 0x5f:
          this.logNotImplemented(byte);
          break;
        case 0x60:
          this.logNotImplemented(byte);
          break;
        case 0x61:
          this.logNotImplemented(byte);
          break;
        case 0x62:
          this.logNotImplemented(byte);
          break;
        case 0x63:
          this.logNotImplemented(byte);
          break;
        case 0x64:
          this.logNotImplemented(byte);
          break;
        case 0x65:
          this.logNotImplemented(byte);
          break;
        case 0x66:
          this.logNotImplemented(byte);
          break;
        case 0x67:
          this.logNotImplemented(byte);
          break;
        case 0x68:
          this.logNotImplemented(byte);
          break;
        case 0x69:
          this.logNotImplemented(byte);
          break;
        case 0x6a:
          this.logNotImplemented(byte);
          break;
        case 0x6b:
          this.logNotImplemented(byte);
          break;
        case 0x6c:
          this.logNotImplemented(byte);
          break;
        case 0x6d:
          this.logNotImplemented(byte);
          break;
        case 0x6e:
          this.logNotImplemented(byte);
          break;
        case 0x6f:
          this.logNotImplemented(byte);
          break;
        case 0x70:
          this.logNotImplemented(byte);
          break;
        case 0x71:
          this.logNotImplemented(byte);
          break;
        case 0x72:
          this.logNotImplemented(byte);
          break;
        case 0x73:
          this.logNotImplemented(byte);
          break;
        case 0x74:
          this.logNotImplemented(byte);
          break;
        case 0x75:
          this.logNotImplemented(byte);
          break;
        case 0x76:
          this.logNotImplemented(byte);
          break;
        case 0x77:
          this.logNotImplemented(byte);
          break;
        case 0x78:
          this.logNotImplemented(byte);
          break;
        case 0x79:
          this.logNotImplemented(byte);
          break;
        case 0x7a:
          this.logNotImplemented(byte);
          break;
        case 0x7b:
          this.logNotImplemented(byte);
          break;
        case 0x7c:
          this.logNotImplemented(byte);
          break;
        case 0x7d:
          this.logNotImplemented(byte);
          break;
        case 0x7e:
          this.logNotImplemented(byte);
          break;
        case 0x7f:
          this.logNotImplemented(byte);
          break;
        case 0x80:
          this.logNotImplemented(byte);
          break;
        case 0x81:
          this.logNotImplemented(byte);
          break;
        case 0x82:
          this.logNotImplemented(byte);
          break;
        case 0x83:
          this.logNotImplemented(byte);
          break;
        case 0x84:
          this.logNotImplemented(byte);
          break;
        case 0x85:
          this.logNotImplemented(byte);
          break;
        case 0x86:
          this.logNotImplemented(byte);
          break;
        case 0x87:
          this.logNotImplemented(byte);
          break;
        case 0x88:
          this.logNotImplemented(byte);
          break;
        case 0x89:
          this.logNotImplemented(byte);
          break;
        case 0x8a:
          this.logNotImplemented(byte);
          break;
        case 0x8b:
          this.logNotImplemented(byte);
          break;
        case 0x8c:
          this.logNotImplemented(byte);
          break;
        case 0x8d:
          this.logNotImplemented(byte);
          break;
        case 0x8e:
          this.logNotImplemented(byte);
          break;
        case 0x8f:
          this.logNotImplemented(byte);
          break;
        case 0x90:
          this.logNotImplemented(byte);
          break;
        case 0x91:
          this.logNotImplemented(byte);
          break;
        case 0x92:
          this.logNotImplemented(byte);
          break;
        case 0x93:
          this.logNotImplemented(byte);
          break;
        case 0x94:
          this.logNotImplemented(byte);
          break;
        case 0x95:
          this.logNotImplemented(byte);
          break;
        case 0x96:
          this.logNotImplemented(byte);
          break;
        case 0x97:
          this.logNotImplemented(byte);
          break;
        case 0x98:
          this.logNotImplemented(byte);
          break;
        case 0x99:
          this.logNotImplemented(byte);
          break;
        case 0x9a:
          this.logNotImplemented(byte);
          break;
        case 0x9b:
          this.logNotImplemented(byte);
          break;
        case 0x9c:
          this.logNotImplemented(byte);
          break;
        case 0x9d:
          this.logNotImplemented(byte);
          break;
        case 0x9e:
          this.logNotImplemented(byte);
          break;
        case 0x9f:
          this.logNotImplemented(byte);
          break;
        case 0xa0:
          this.logNotImplemented(byte);
          break;
        case 0xa1:
          this.logNotImplemented(byte);
          break;
        case 0xa2:
          this.logNotImplemented(byte);
          break;
        case 0xa3:
          this.logNotImplemented(byte);
          break;
        case 0xa4:
          this.logNotImplemented(byte);
          break;
        case 0xa5:
          this.logNotImplemented(byte);
          break;
        case 0xa6:
          this.logNotImplemented(byte);
          break;
        case 0xa7:
          this.logNotImplemented(byte);
          break;
        case 0xa8:
          this.logNotImplemented(byte);
          break;
        case 0xa9:
          this.logNotImplemented(byte);
          break;
        case 0xaa:
          this.logNotImplemented(byte);
          break;
        case 0xab:
          this.logNotImplemented(byte);
          break;
        case 0xac:
          this.logNotImplemented(byte);
          break;
        case 0xad:
          this.logNotImplemented(byte);
          break;
        case 0xae:
          this.logNotImplemented(byte);
          break;
        case 0xaf:
          this.logNotImplemented(byte);
          break;
        case 0xb0:
          this.logNotImplemented(byte);
          break;
        case 0xb1:
          this.logNotImplemented(byte);
          break;
        case 0xb2:
          this.logNotImplemented(byte);
          break;
        case 0xb3:
          this.logNotImplemented(byte);
          break;
        case 0xb4:
          this.logNotImplemented(byte);
          break;
        case 0xb5:
          this.logNotImplemented(byte);
          break;
        case 0xb6:
          this.logNotImplemented(byte);
          break;
        case 0xb7:
          this.logNotImplemented(byte);
          break;
        case 0xb8:
          this.logNotImplemented(byte);
          break;
        case 0xb9:
          this.logNotImplemented(byte);
          break;
        case 0xba:
          this.logNotImplemented(byte);
          break;
        case 0xbb:
          this.logNotImplemented(byte);
          break;
        case 0xbc:
          this.logNotImplemented(byte);
          break;
        case 0xbd:
          this.logNotImplemented(byte);
          break;
        case 0xbe:
          this.logNotImplemented(byte);
          break;
        case 0xbf:
          this.logNotImplemented(byte);
          break;
        case 0xc0:
          this.logNotImplemented(byte);
          break;
        case 0xc1:
          this.logNotImplemented(byte);
          break;
        case 0xc2:
          this.logNotImplemented(byte);
          break;
        case 0xc3:
          this.logNotImplemented(byte);
          break;
        case 0xc4:
          this.logNotImplemented(byte);
          break;
        case 0xc5:
          this.logNotImplemented(byte);
          break;
        case 0xc6:
          this.logNotImplemented(byte);
          break;
        case 0xc7:
          this.logNotImplemented(byte);
          break;
        case 0xc8:
          this.logNotImplemented(byte);
          break;
        case 0xc9:
          this.logNotImplemented(byte);
          break;
        case 0xca:
          this.logNotImplemented(byte);
          break;
        case 0xcb:
          this.logNotImplemented(byte);
          break;
        case 0xcc:
          this.logNotImplemented(byte);
          break;
        case 0xcd:
          this.logNotImplemented(byte);
          break;
        case 0xce:
          this.logNotImplemented(byte);
          break;
        case 0xcf:
          this.logNotImplemented(byte);
          break;
        case 0xd0:
          this.logNotImplemented(byte);
          break;
        case 0xd1:
          this.logNotImplemented(byte);
          break;
        case 0xd2:
          this.logNotImplemented(byte);
          break;
        case 0xd3:
          this.logNotImplemented(byte);
          break;
        case 0xd4:
          this.logNotImplemented(byte);
          break;
        case 0xd5:
          this.logNotImplemented(byte);
          break;
        case 0xd6:
          this.logNotImplemented(byte);
          break;
        case 0xd7:
          this.logNotImplemented(byte);
          break;
        case 0xd8:
          this.logNotImplemented(byte);
          break;
        case 0xd9:
          this.logNotImplemented(byte);
          break;
        case 0xda:
          this.logNotImplemented(byte);
          break;
        case 0xdb:
          this.logNotImplemented(byte);
          break;
        case 0xdc:
          this.logNotImplemented(byte);
          break;
        case 0xdd:
          this.logNotImplemented(byte);
          break;
        case 0xde:
          this.logNotImplemented(byte);
          break;
        case 0xdf:
          this.logNotImplemented(byte);
          break;
        case 0xe0:
          this.logNotImplemented(byte);
          break;
        case 0xe1:
          this.logNotImplemented(byte);
          break;
        case 0xe2:
          this.logNotImplemented(byte);
          break;
        case 0xe3:
          this.logNotImplemented(byte);
          break;
        case 0xe4:
          this.logNotImplemented(byte);
          break;
        case 0xe5:
          this.logNotImplemented(byte);
          break;
        case 0xe6:
          this.logNotImplemented(byte);
          break;
        case 0xe7:
          this.logNotImplemented(byte);
          break;
        case 0xe8:
          this.logNotImplemented(byte);
          break;
        case 0xe9:
          this.logNotImplemented(byte);
          break;
        case 0xea:
          this.logNotImplemented(byte);
          break;
        case 0xeb:
          this.logNotImplemented(byte);
          break;
        case 0xec:
          this.logNotImplemented(byte);
          break;
        case 0xed:
          this.logNotImplemented(byte);
          break;
        case 0xee:
          this.logNotImplemented(byte);
          break;
        case 0xef:
          this.logNotImplemented(byte);
          break;
        case 0xf0:
          this.logNotImplemented(byte);
          break;
        case 0xf1:
          this.logNotImplemented(byte);
          break;
        case 0xf2:
          this.logNotImplemented(byte);
          break;
        case 0xf3:
          this.logNotImplemented(byte);
          break;
        case 0xf4:
          this.logNotImplemented(byte);
          break;
        case 0xf5:
          this.logNotImplemented(byte);
          break;
        case 0xf6:
          this.logNotImplemented(byte);
          break;
        case 0xf7:
          this.logNotImplemented(byte);
          break;
        case 0xf8:
          this.logNotImplemented(byte);
          break;
        case 0xf9:
          this.logNotImplemented(byte);
          break;
        case 0xfa:
          this.logNotImplemented(byte);
          break;
        case 0xfb:
          this.logNotImplemented(byte);
          break;
        case 0xfc:
          this.logNotImplemented(byte);
          break;
        case 0xfd:
          this.logNotImplemented(byte);
          break;
        case 0xfe:
          this.logNotImplemented(byte);
          break;
        case 0xff:
          this.logNotImplemented(byte);
          break;
      }
    }
  }
}
