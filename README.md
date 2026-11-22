# tiny-stack-vm

A tiny stack VM for make.fun's tiny-stack-vm-01 ISA (32-bit wrapping integers,
256-value stack, 64-deep call stack, 256 words of memory, ten traps, step and
output limits). One run answers all 40 instances: `node main.ts` reads
`/input/<id>/program.bin` + `input.bin`, writes `/output/<id>/stdout.bin` +
`exit.txt`. Implements the reference VM's rules exactly, including the edge
cases the house baseline gets wrong.
