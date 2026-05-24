// Highly interactive MIPS Simulator and Interpreter for educational use inside the UI.

export const REG_NAMES = [
  "$zero", "$at", "$v0", "$v1", "$a0", "$a1", "$a2", "$a3",
  "$t0", "$t1", "$t2", "$t3", "$t4", "$t5", "$t6", "$t7",
  "$s0", "$s1", "$s2", "$s3", "$s4", "$s5", "$s6", "$s7",
  "$t8", "$t9", "$k0", "$k1", "$gp", "$sp", "$fp", "$ra"
];

export const REG_MAP: Record<string, number> = {};
REG_NAMES.forEach((name, idx) => {
  REG_MAP[name] = idx;
});

// Provide common MIPS register aliases
const REGISTER_ALIASES: Record<string, string> = {
  "$0": "$zero",
  "$2": "$v0", "$3": "$v1",
  "$4": "$a0", "$5": "$a1", "$6": "$a2", "$7": "$a3",
  "$8": "$t0", "$9": "$t1", "$10": "$t2", "$11": "$t3", "$12": "$t4", "$13": "$t5", "$14": "$t6", "$15": "$t7",
  "$16": "$s0", "$17": "$s1", "$18": "$s2", "$19": "$s3", "$20": "$s4", "$21": "$s5", "$22": "$s6", "$23": "$s7",
  "$24": "$t8", "$25": "$t9",
  "$28": "$gp", "$29": "$sp", "$30": "$fp", "$31": "$ra"
};

export interface MipsInstruction {
  address: number;
  lineNum: number; // 0-indexed line number in the assembly editor
  originalText: string;
  op: string; // e.g. "lw", "addi"
  args: string[];
}

export interface SimulatorState {
  registers: number[];
  hi: number;
  lo: number;
  pc: number; // Current instruction address (0x00400000 + index * 4)
  isRunning: boolean;
  isTerminated: boolean;
  exitCode: number;
  consoleOut: string;
  heapPointer: number; // Starts at 0x10040000
  stackPointer: number; // Starts at 0x7ffffffc
  memory: Record<number, number>; // Dynamic byte-addressable memory (address -> byte 0..255)
  cycleCount: number;
  maxCycles: number;
}

export class MipsSimulator {
  public instructions: MipsInstruction[] = [];
  public labels: Record<string, number> = {}; // label_name -> address
  public state: SimulatorState;

  // Track map of address -> instruction index for quick lookups
  private instructionAddressMap: Record<number, number> = {};

  constructor(maxCycles: number = 20000) {
    this.state = this.resetState(maxCycles);
  }

  // Generate a pristine starting machine state
  private resetState(maxCycles: number): SimulatorState {
    const defaultRegisters = new Array(32).fill(0);
    const stackStart = 0x7ffffffc;
    defaultRegisters[29] = stackStart; // $sp
    defaultRegisters[28] = 0x10008000; // $gp

    return {
      registers: defaultRegisters,
      hi: 0,
      lo: 0,
      pc: 0x00400000,
      isRunning: false,
      isTerminated: false,
      exitCode: 0,
      consoleOut: "",
      heapPointer: 0x10040000,
      stackPointer: stackStart,
      memory: {},
      cycleCount: 0,
      maxCycles,
    };
  }

  // Load and assemble raw assembly source text
  public load(code: string) {
    this.instructions = [];
    this.labels = {};
    const maxCycles = this.state.maxCycles;
    this.state = this.resetState(maxCycles);
    this.instructionAddressMap = {};

    const lines = code.split("\n");
    let currentSegment: "text" | "data" = "text"; // default segment

    let dataAddr = 0x10010000;
    let textAddr = 0x00400000;

    // First Pass: Scan labels and establish memory locations
    for (let i = 0; i < lines.length; i++) {
       let line = lines[i].trim();

       // Strip away comments
       const commentIndex = line.indexOf("#");
       if (commentIndex !== -1) {
         line = line.substring(0, commentIndex).trim();
       }

       if (!line) continue;

       // Segment directives
       if (line === ".data") {
         currentSegment = "data";
         continue;
       }
       if (line === ".text") {
         currentSegment = "text";
         continue;
       }

       // Parse label if exists (e.g. "label_name:")
       const labelMatch = line.match(/^([a-zA-Z_0-9\.]+)\s*:\s*(.*)$/);
       let instructionPart = line;

       if (labelMatch) {
         const labelName = labelMatch[1];
         instructionPart = labelMatch[2].trim();

         if (currentSegment === "data") {
           this.labels[labelName] = dataAddr;
         } else {
           this.labels[labelName] = textAddr;
         }
       }

       if (currentSegment === "data" && instructionPart) {
         // Parse data directive types
         const dataMatch = instructionPart.match(/^\.([a-z]+)\s+(.*)$/);
         if (dataMatch) {
           const directive = dataMatch[1];
           const valueStr = dataMatch[2].trim();

           if (directive === "asciiz" || directive === "ascii") {
             // Strings matching e.g. "Hello World"
             const strMatch = valueStr.match(/"(.*)"/);
             const content = strMatch ? strMatch[1] : valueStr;
             
             // Escape support sequence representation
             const unescaped = content
               .replace(/\\n/g, "\n")
               .replace(/\\t/g, "\t")
               .replace(/\\"/g, '"');

             for (let c = 0; c < unescaped.length; c++) {
               this.state.memory[dataAddr++] = unescaped.charCodeAt(c);
             }
             if (directive === "asciiz") {
               this.state.memory[dataAddr++] = 0; // null terminator
             }
           } else if (directive === "word") {
             // Words e.g. "10", "Dog_makeSound", "Animal_vtable"
             const items = valueStr.split(",").map(x => x.trim());
             
             // Align data address to 4-byte boundaries
             while (dataAddr % 4 !== 0) {
               dataAddr++;
             }

             items.forEach(item => {
               // Record item as placeholder if label reference; resolved in second pass
               const numVal = parseInt(item, 10);
               if (isNaN(numVal)) {
                 // Label temporary marker; resolved in second pass
                 this.writeWord(dataAddr, 0); // resolved later
                 // Cache label name in a special layout mapper
                 (this as any)._labelFixups = (this as any)._labelFixups || [];
                 (this as any)._labelFixups.push({ addr: dataAddr, labelName: item });
               } else {
                 this.writeWord(dataAddr, numVal);
               }
               dataAddr += 4;
             });
           }
         }
       } else if (currentSegment === "text" && instructionPart) {
         // Count instructions to align text PC only if starting with an alphabetic opcode
         if (/^[a-zA-Z]+/.test(instructionPart)) {
           textAddr += 4;
         }
       }
    }

    // Resolve static labels in data segments (Fixups)
    const fixups = (this as any)._labelFixups || [];
    fixups.forEach((fix: any) => {
      const resolved = this.labels[fix.labelName] !== undefined ? this.labels[fix.labelName] : 0;
      this.writeWord(fix.addr, resolved);
    });
    delete (this as any)._labelFixups;

    // Second Pass: Parse instructions
    textAddr = 0x00400000;
    currentSegment = "text";

    for (let i = 0; i < lines.length; i++) {
      let line = lines[i].trim();
      const commentIndex = line.indexOf("#");
      if (commentIndex !== -1) {
        line = line.substring(0, commentIndex).trim();
      }
      if (!line) continue;

      if (line === ".data") {
        currentSegment = "data";
        continue;
      }
      if (line === ".text") {
        currentSegment = "text";
        continue;
      }

      const labelMatch = line.match(/^([a-zA-Z_0-9\.]+)\s*:\s*(.*)$/);
      let instructionPart = line;
      if (labelMatch) {
         instructionPart = labelMatch[2].trim();
      }

      if (currentSegment === "text" && instructionPart) {
         // Extract operation name and arguments
         const opMatch = instructionPart.match(/^([a-zA-Z]+)\s*(.*)$/);
         if (opMatch) {
           const op = opMatch[1].toLowerCase();
           const rawArgs = opMatch[2].split(",");
           const args = rawArgs
             .map((arg) => arg.trim())
             .filter((arg) => arg.length > 0);

           const instIndex = this.instructions.length;
           const instructionObj: MipsInstruction = {
             address: textAddr,
             lineNum: i,
             originalText: lines[i],
             op,
             args,
           };
           this.instructions.push(instructionObj);
           this.instructionAddressMap[textAddr] = instIndex;
           textAddr += 4;
         }
      }
    }

    // Set PC to "main" address if available, or first instruction
    if (this.labels["main"] !== undefined) {
      this.state.pc = this.labels["main"];
    } else if (this.instructions.length > 0) {
      this.state.pc = this.instructions[0].address;
    }
    
    this.state.isRunning = false;
  }

  // Write a 32-bit integer to block address
  public writeWord(addr: number, value: number) {
    this.state.memory[addr] = value & 0xff;
    this.state.memory[addr + 1] = (value >> 8) & 0xff;
    this.state.memory[addr + 2] = (value >> 16) & 0xff;
    this.state.memory[addr + 3] = (value >> 24) & 0xff;
  }

  // Read a 32-bit signed integer from block address
  public readWord(addr: number): number {
    const b0 = this.state.memory[addr] || 0;
    const b1 = this.state.memory[addr + 1] || 0;
    const b2 = this.state.memory[addr + 2] || 0;
    const b3 = this.state.memory[addr + 3] || 0;
    // Assemble bytes signed
    let val = b0 | (b1 << 8) | (b2 << 16) | (b3 << 24);
    return val;
  }

  // Read a single character byte from memory address
  public readByte(addr: number): number {
    return this.state.memory[addr] || 0;
  }

  // Write a single character byte to memory address
  public writeByte(addr: number, val: number) {
    this.state.memory[addr] = val & 0xff;
  }

  // Resolve register operand index or string alias to standard register file index
  private getRegIndex(regName: string): number {
    const cleaned = regName.trim();
    if (REGISTER_ALIASES[cleaned]) {
      return REG_MAP[REGISTER_ALIASES[cleaned]];
    }
    if (REG_MAP[cleaned] !== undefined) {
      return REG_MAP[cleaned];
    }
    // Remove general dollar sign index e.g. $16
    const dollarVal = cleaned.startsWith("$") ? cleaned.substring(1) : cleaned;
    const numericIndex = parseInt(dollarVal, 10);
    if (!isNaN(numericIndex) && numericIndex >= 0 && numericIndex < 32) {
      return numericIndex;
    }
    return -1;
  }

  // Resolve numerical value or register value, can handle label lookup or offset parenthesis parsing e.g. "4($s0)"
  private resolveOperand(opStr: string): number {
    const cleaned = opStr.trim();

    // Check if it matches label name offset syntax
    if (this.labels[cleaned] !== undefined) {
      return this.labels[cleaned];
    }

    // Check if it is offset registry notation, e.g., "4($s0)" or "-4($fp)"
    const parenthesized = cleaned.match(/^([+-]?\d+)\s*\(([^)]+)\)$/);
    if (parenthesized) {
      const offset = parseInt(parenthesized[1], 10);
      const regName = parenthesized[2];
      const regIdx = this.getRegIndex(regName);
      const baseAddr = regIdx !== -1 ? this.state.registers[regIdx] : 0;
      return baseAddr + offset;
    }

    // Direct registry reference inside offsets e.g. "($s0)"
    const simpleParen = cleaned.match(/^\(([^)]+)\)$/);
    if (simpleParen) {
      const regName = simpleParen[1];
      const regIdx = this.getRegIndex(regName);
      return regIdx !== -1 ? this.state.registers[regIdx] : 0;
    }

    // Standard immediate integer number
    const val = parseInt(cleaned, 10);
    if (!isNaN(val)) return val;

    return 0;
  }

  // Perform single step of simulated clock cycles
  public step(): boolean {
    if (this.state.isTerminated) return false;

    // Retrieve instruction matching current PC address
    const instIndex = this.instructionAddressMap[this.state.pc];
    if (instIndex === undefined || instIndex < 0 || instIndex >= this.instructions.length) {
      this.state.isTerminated = true;
      this.state.consoleOut += "\n[Simulator Info: Program Counter PC ran out of instruction domain. Execution terminated.]\n";
      return false;
    }

    const inst = this.instructions[instIndex];
    this.state.cycleCount++;

    if (this.state.cycleCount >= this.state.maxCycles) {
      this.state.isTerminated = true;
      this.state.consoleOut += `\n[Simulator Error: Cycle count exceeded limit of ${this.state.maxCycles} (possible infinite loop in assembly code or method overriding mismatch).]\n`;
      return false;
    }

    // Advance PC default fallback
    let nextPc = this.state.pc + 4;
    const { op, args } = inst;

    try {
      switch (op) {
        case "li": {
          // li rd, imm
          const rd = this.getRegIndex(args[0]);
          const imm = this.resolveOperand(args[1]);
          if (rd > 0) this.state.registers[rd] = imm;
          break;
        }
        case "la": {
          // la rd, label
          const rd = this.getRegIndex(args[0]);
          const label = args[1];
          if (rd > 0) {
            this.state.registers[rd] = this.labels[label] !== undefined ? this.labels[label] : 0;
          }
          break;
        }
        case "move": {
          // move rd, rs
          const rd = this.getRegIndex(args[0]);
          const rs = this.getRegIndex(args[1]);
          if (rd > 0 && rs !== -1) {
            this.state.registers[rd] = this.state.registers[rs];
          }
          break;
        }
        case "add":
        case "addu": {
          // add rd, rs, rt (or move/arg-like arithmetic mapping and immediate support)
          const rd = this.getRegIndex(args[0]);
          const rs = this.getRegIndex(args[1]);
          const rt = this.getRegIndex(args[2]);
          if (rd > 0) {
            const valS = rs !== -1 ? this.state.registers[rs] : 0;
            const valT = rt !== -1 ? this.state.registers[rt] : 0;
            this.state.registers[rd] = (valS + valT) | 0; // force 32-bit signed
          }
          break;
        }
        case "addi":
        case "addiu": {
          // addi rt, rs, imm
          const rt = this.getRegIndex(args[0]);
          const rs = this.getRegIndex(args[1]);
          const imm = this.resolveOperand(args[2]);
          if (rt > 0 && rs !== -1) {
            this.state.registers[rt] = (this.state.registers[rs] + imm) | 0;
          }
          break;
        }
        case "sub":
        case "subu": {
          // sub rd, rs, rt
          const rd = this.getRegIndex(args[0]);
          const rs = this.getRegIndex(args[1]);
          const rt = this.getRegIndex(args[2]);
          if (rd > 0 && rs !== -1 && rt !== -1) {
            this.state.registers[rd] = (this.state.registers[rs] - this.state.registers[rt]) | 0;
          }
          break;
        }
        case "mul": {
          // mul rd, rs, rt
          const rd = this.getRegIndex(args[0]);
          const rs = this.getRegIndex(args[1]);
          const rt = this.getRegIndex(args[2]);
          if (rd > 0 && rs !== -1 && rt !== -1) {
            this.state.registers[rd] = (this.state.registers[rs] * this.state.registers[rt]) | 0;
          }
          break;
        }
        case "div": {
          // div rs, rt
          const rs = this.getRegIndex(args[1] ? args[0] : "$v0"); // support various div syntaxes
          const rt = this.getRegIndex(args[1] ? args[1] : args[0]);
          if (rs !== -1 && rt !== -1) {
            const divisor = this.state.registers[rt];
            if (divisor === 0) {
              this.state.consoleOut += "\n[Simulator Warning: Division by zero is detected!]\n";
              this.state.lo = 0;
              this.state.hi = 0;
            } else {
              const dividend = this.state.registers[rs];
              this.state.lo = (dividend / divisor) | 0;
              this.state.hi = dividend % divisor;
            }
          }
          break;
        }
        case "lw": {
          // lw rt, offset(rs) or lw rt, label
          const rt = this.getRegIndex(args[0]);
          const operandText = args[1];
          const targetAddress = this.resolveOperand(operandText);
          if (rt > 0) {
            this.state.registers[rt] = this.readWord(targetAddress);
          }
          break;
        }
        case "sw": {
          // sw rt, offset(rs) or sw rt, label
          const rt = this.getRegIndex(args[0]);
          const operandText = args[1];
          const targetAddress = this.resolveOperand(operandText);
          const val = rt !== -1 ? this.state.registers[rt] : 0;
          this.writeWord(targetAddress, val);
          break;
        }
        case "lb": {
          // lb rt, offset(rs)
          const rt = this.getRegIndex(args[0]);
          const targetAddress = this.resolveOperand(args[1]);
          if (rt > 0) {
            this.state.registers[rt] = this.readByte(targetAddress);
          }
          break;
        }
        case "sb": {
          // sb rt, offset(rs)
          const rt = this.getRegIndex(args[0]);
          const targetAddress = this.resolveOperand(args[1]);
          const val = rt !== -1 ? this.state.registers[rt] : 0;
          this.writeByte(targetAddress, val & 0xff);
          break;
        }
        case "and": {
          const rd = this.getRegIndex(args[0]);
          const rs = this.getRegIndex(args[1]);
          const rt = this.getRegIndex(args[2]);
          if (rd > 0) this.state.registers[rd] = this.state.registers[rs] & this.state.registers[rt];
          break;
        }
        case "andi": {
          const rt = this.getRegIndex(args[0]);
          const rs = this.getRegIndex(args[1]);
          const imm = this.resolveOperand(args[2]);
          if (rt > 0) this.state.registers[rt] = this.state.registers[rs] & imm;
          break;
        }
        case "or": {
          const rd = this.getRegIndex(args[0]);
          const rs = this.getRegIndex(args[1]);
          const rt = this.getRegIndex(args[2]);
          if (rd > 0) this.state.registers[rd] = this.state.registers[rs] | this.state.registers[rt];
          break;
        }
        case "ori": {
          const rt = this.getRegIndex(args[0]);
          const rs = this.getRegIndex(args[1]);
          const imm = this.resolveOperand(args[2]);
          if (rt > 0) this.state.registers[rt] = this.state.registers[rs] | imm;
          break;
        }
        case "mflo": {
          const rd = this.getRegIndex(args[0]);
          if (rd > 0) this.state.registers[rd] = this.state.lo;
          break;
        }
        case "mfhi": {
          const rd = this.getRegIndex(args[0]);
          if (rd > 0) this.state.registers[rd] = this.state.hi;
          break;
        }
        case "sll": {
          const rd = this.getRegIndex(args[0]);
          const rt = this.getRegIndex(args[1]);
          const sa = parseInt(args[2], 10) || 0;
          if (rd > 0) this.state.registers[rd] = this.state.registers[rt] << sa;
          break;
        }
        case "srl": {
          const rd = this.getRegIndex(args[0]);
          const rt = this.getRegIndex(args[1]);
          const sa = parseInt(args[2], 10) || 0;
          if (rd > 0) this.state.registers[rd] = this.state.registers[rt] >>> sa;
          break;
        }
        case "j": {
          const target = args[0];
          const resolved = this.labels[target];
          if (resolved !== undefined) nextPc = resolved;
          break;
        }
        case "jal": {
          const target = args[0];
          const resolved = this.labels[target];
          this.state.registers[31] = this.state.pc + 4; // record back $ra
          if (resolved !== undefined) nextPc = resolved;
          break;
        }
        case "jalr": {
          // jalr rd, rs or jalr rs (defaults rd to $ra = 31)
          const rs = this.getRegIndex(args[1] ? args[1] : args[0]);
          const rd = args[1] ? this.getRegIndex(args[0]) : 31;
          const target = this.state.registers[rs];
          if (rd > 0) this.state.registers[rd] = this.state.pc + 4;
          nextPc = target;
          break;
        }
        case "jr": {
          const rs = this.getRegIndex(args[0]);
          if (rs !== -1) {
            nextPc = this.state.registers[rs];
          }
          break;
        }
        case "beq": {
          const rs = this.getRegIndex(args[0]);
          const rt = this.getRegIndex(args[1]);
          const label = args[2];
          const valS = this.state.registers[rs];
          const valT = this.state.registers[rt];
          if (valS === valT) {
            nextPc = this.labels[label] !== undefined ? this.labels[label] : nextPc;
          }
          break;
        }
        case "bne": {
          const rs = this.getRegIndex(args[0]);
          const rt = this.getRegIndex(args[1]);
          const label = args[2];
          const valS = this.state.registers[rs];
          const valT = this.state.registers[rt];
          if (valS !== valT) {
            nextPc = this.labels[label] !== undefined ? this.labels[label] : nextPc;
          }
          break;
        }
        case "blez": {
          const rs = this.getRegIndex(args[0]);
          const label = args[1];
          if (this.state.registers[rs] <= 0) {
            nextPc = this.labels[label] !== undefined ? this.labels[label] : nextPc;
          }
          break;
        }
        case "bgtz": {
          const rs = this.getRegIndex(args[0]);
          const label = args[1];
          if (this.state.registers[rs] > 0) {
            nextPc = this.labels[label] !== undefined ? this.labels[label] : nextPc;
          }
          break;
        }
        case "bltz": {
          const rs = this.getRegIndex(args[0]);
          const label = args[1];
          if (this.state.registers[rs] < 0) {
            nextPc = this.labels[label] !== undefined ? this.labels[label] : nextPc;
          }
          break;
        }
        case "bgez": {
          const rs = this.getRegIndex(args[0]);
          const label = args[1];
          if (this.state.registers[rs] >= 0) {
            nextPc = this.labels[label] !== undefined ? this.labels[label] : nextPc;
          }
          break;
        }
        case "beqz": {
          // pseudo branch
          const rs = this.getRegIndex(args[0]);
          const label = args[1];
          if (this.state.registers[rs] === 0) {
            nextPc = this.labels[label] !== undefined ? this.labels[label] : nextPc;
          }
          break;
        }
        case "bnez": {
          // pseudo branch
          const rs = this.getRegIndex(args[0]);
          const label = args[1];
          if (this.state.registers[rs] !== 0) {
            nextPc = this.labels[label] !== undefined ? this.labels[label] : nextPc;
          }
          break;
        }
        case "syscall": {
          const service = this.state.registers[2]; // $v0
          if (service === 1) {
            // print_int
            const arg = this.state.registers[4]; // $a0
            this.state.consoleOut += arg.toString();
          } else if (service === 4) {
             // print_string
             let addr = this.state.registers[4]; // $a0
             let output = "";
             let safeLimit = 1000;
             while (safeLimit-- > 0) {
               const b = this.readByte(addr++);
               if (b === 0) break;
               output += String.fromCharCode(b);
             }
             this.state.consoleOut += output;
          } else if (service === 9) {
             // sbrk pointer allocation
             const sizeBytes = this.state.registers[4]; // $a0
             const originalHeap = this.state.heapPointer;
             
             // Guarantee alignment
             const alignedSize = (sizeBytes + 3) & ~3;
             this.state.registers[2] = originalHeap; // return base in $v0
             this.state.heapPointer += alignedSize;
          } else if (service === 10 || service === 17) {
             // exit
             this.state.isTerminated = true;
             this.state.exitCode = service === 17 ? this.state.registers[4] : 0;
             this.state.consoleOut += `\n\n-- Program exited with code ${this.state.exitCode} --`;
          } else {
             console.warn("Unrecognized simulator system service: " + service);
          }
          break;
        }
        default:
          console.warn("MIPS Instruction op is currently UNIMPLEMENTED or custom-ignored in simulation: " + op);
          break;
      }
    } catch (e: any) {
       this.state.consoleOut += `\n[Simulator Exception evaluating line ${inst.lineNum + 1}: ${inst.op} -> ${e.message}]\n`;
       this.state.isTerminated = true;
    }

    // Assign final registers safety limits
    this.state.registers[0] = 0; // $zero is always 0
    this.state.pc = nextPc;

    return !this.state.isTerminated;
  }

  // Fast runs until exiting or manual suspension
  public run() {
    this.state.isRunning = true;
    let iterations = 0;
    while (this.state.isRunning && !this.state.isTerminated && iterations++ < 50000) {
      this.step();
    }
    this.state.isRunning = false;
  }
}
