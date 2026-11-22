// Tiny stack VM for make.fun tiny-stack-vm-01 (ISA v1), written from ISA.md to match
// the reference VM (generator/subject/vm.mjs) rule for rule, traps and limits included.
// Node 22, no dependencies. SPDX-License-Identifier: MIT
import { mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const IN_DIR = process.env.MAKEFUN_INPUT_DIR ?? '/input';
const OUT_DIR = process.env.MAKEFUN_OUTPUT_DIR ?? '/output';
const enc = new TextEncoder();

function run(prog: Uint8Array, input: Uint8Array): { code: number; out: Uint8Array } {
  const n = prog.length;
  const s = new Int32Array(256);
  let sp = 0;
  const c = new Int32Array(64);
  let cp = 0;
  const m = new Int32Array(256);
  const o = new Uint8Array(65536);
  let ol = 0;
  let ip = 0;
  let pc = 0;
  let steps = 0;
  const done = (code: number) => ({ code, out: o.subarray(0, ol) });

  for (;;) {
    if (steps === 1000000) return done(10);
    if (pc < 0 || pc >= n) return done(9);
    const op = prog[pc];
    let imm: number;
    if (op === 0x01) imm = 1;
    else if (op === 0x02) imm = 4;
    else if (op >= 0x30 && op <= 0x33) imm = 2;
    else if (op <= 0x07 || (op >= 0x10 && op <= 0x22 && op !== 0x1f) || op === 0x34 || (op >= 0x40 && op <= 0x41) || (op >= 0x50 && op <= 0x53)) imm = 0;
    else return done(5);
    if (pc + imm >= n) return done(9);
    steps++;
    const nx = pc + 1 + imm;
    let pops = 0;
    let pushes = 0;
    if (op === 0x01 || op === 0x02 || op === 0x52) pushes = 1;
    else if (op === 0x04) { pops = 1; pushes = 2; }
    else if (op === 0x05) { pops = 2; pushes = 2; }
    else if (op === 0x06) { pops = 2; pushes = 3; }
    else if (op === 0x07) { pops = 3; pushes = 3; }
    else if (op === 0x17 || op === 0x1b) { pops = 1; pushes = 1; }
    else if (op >= 0x10 && op <= 0x22) { pops = 2; pushes = 1; }
    else if (op === 0x03 || op === 0x31 || op === 0x32 || op === 0x40 || op === 0x50 || op === 0x51 || op === 0x53) pops = 1;
    else if (op === 0x41) pops = 2;
    if (sp < pops) return done(2);
    if (sp - pops + pushes > 256) return done(3);
    pc = nx;
    switch (op) {
      case 0x00:
        return done(0);
      case 0x01:
        s[sp++] = (prog[nx - 1] << 24) >> 24;
        break;
      case 0x02:
        s[sp++] = prog[nx - 4] | (prog[nx - 3] << 8) | (prog[nx - 2] << 16) | (prog[nx - 1] << 24);
        break;
      case 0x03:
        sp--;
        break;
      case 0x04:
        s[sp] = s[sp - 1]; sp++;
        break;
      case 0x05: {
        const t = s[sp - 1]; s[sp - 1] = s[sp - 2]; s[sp - 2] = t;
        break;
      }
      case 0x06:
        s[sp] = s[sp - 2]; sp++;
        break;
      case 0x07: {
        const a = s[sp - 3]; s[sp - 3] = s[sp - 2]; s[sp - 2] = s[sp - 1]; s[sp - 1] = a;
        break;
      }
      case 0x17:
        s[sp - 1] = -s[sp - 1] | 0;
        break;
      case 0x1b:
        s[sp - 1] = ~s[sp - 1];
        break;
      case 0x10: case 0x11: case 0x12: case 0x13: case 0x14: case 0x15: case 0x16:
      case 0x18: case 0x19: case 0x1a: case 0x1c: case 0x1d: case 0x1e: case 0x20: case 0x21: case 0x22: {
        const b = s[sp - 1];
        const a = s[sp - 2];
        let r: number;
        if (op === 0x10) r = (a + b) | 0;
        else if (op === 0x11) r = (a - b) | 0;
        else if (op === 0x12) r = Math.imul(a, b);
        else if (op === 0x13) {
          if (b === 0) return done(4);
          r = a === -2147483648 && b === -1 ? a : (a / b) | 0;
        } else if (op === 0x14) {
          if (b === 0) return done(4);
          r = b === -1 ? 0 : (a % b) | 0;
        } else if (op === 0x15) {
          if (b === 0) return done(4);
          r = Math.floor((a >>> 0) / (b >>> 0)) | 0;
        } else if (op === 0x16) {
          if (b === 0) return done(4);
          r = ((a >>> 0) % (b >>> 0)) | 0;
        } else if (op === 0x18) r = a & b;
        else if (op === 0x19) r = a | b;
        else if (op === 0x1a) r = a ^ b;
        else if (op === 0x1c) r = a << (b & 31);
        else if (op === 0x1d) r = a >> (b & 31);
        else if (op === 0x1e) r = a >>> (b & 31);
        else if (op === 0x20) r = a === b ? 1 : 0;
        else if (op === 0x21) r = a < b ? 1 : 0;
        else r = (a >>> 0) < (b >>> 0) ? 1 : 0;
        sp -= 2;
        s[sp++] = r;
        break;
      }
      case 0x30: case 0x31: case 0x32: {
        const rel = ((prog[nx - 2] | (prog[nx - 1] << 8)) << 16) >> 16;
        if (op === 0x30) pc = nx + rel;
        else {
          const v = s[--sp];
          if ((op === 0x31) === (v === 0)) pc = nx + rel;
        }
        break;
      }
      case 0x33:
        if (cp === 64) return done(7);
        c[cp++] = nx;
        pc = prog[nx - 2] | (prog[nx - 1] << 8);
        break;
      case 0x34:
        if (cp === 0) return done(8);
        pc = c[--cp];
        break;
      case 0x40: {
        const addr = s[sp - 1];
        if (addr < 0 || addr >= 256) return done(6);
        s[sp - 1] = m[addr];
        break;
      }
      case 0x41: {
        const addr = s[sp - 1];
        const v = s[sp - 2];
        if (addr < 0 || addr >= 256) return done(6);
        sp -= 2;
        m[addr] = v;
        break;
      }
      case 0x50: {
        const bytes = enc.encode(String(s[sp - 1]));
        if (ol + bytes.length > 65536) return done(11);
        sp--;
        o.set(bytes, ol);
        ol += bytes.length;
        break;
      }
      case 0x51:
        if (ol + 1 > 65536) return done(11);
        o[ol++] = s[--sp] & 255;
        break;
      case 0x52:
        s[sp++] = ip < input.length ? input[ip++] : -1;
        break;
      case 0x53:
        return done(s[--sp] & 255);
    }
  }
}

// Answer every instance of the set in one run: /input/<id>/program.bin + input.bin
// in, /output/<id>/stdout.bin + exit.txt out.
for (const id of readdirSync(IN_DIR).sort()) {
  const r = run(
    new Uint8Array(readFileSync(join(IN_DIR, id, 'program.bin'))),
    new Uint8Array(readFileSync(join(IN_DIR, id, 'input.bin'))),
  );
  mkdirSync(join(OUT_DIR, id), { recursive: true });
  writeFileSync(join(OUT_DIR, id, 'stdout.bin'), r.out);
  writeFileSync(join(OUT_DIR, id, 'exit.txt'), `${r.code}\n`);
}
