---
title: "Kernel Debugging II"
date: "2025-08-11"

---

# From Setup to Insight: Initial Kernel Debugging

In the first part, we saw how to prepare and connect our environment to debug the kernel with GDB. Now it’s time to take a step further: diving into the kernel’s own boot flow and starting to read what’s really happening inside.

It may seem overwhelming at first, but the idea here is that I can accompany you on this journey. If we come across something tricky or truly complex, we’ll simply push forward, little by little, until we see the light again after the storm.

In this article, you’ll see which commands to run, how to interpret their outputs, and what conclusions you can draw. The goal is that, by the end, you won’t just know how to trace the boot process, but also start feeling comfortable navigating inside the kernel.

I wish you good luck, and I hope we meet again in another article. Big hug!
![Chicharron](/images/kernel-debugging/parte2.jpg)

## Kernel Boot with GDB Attached

Kernel loaded in *QEMU*. Execution stops because it is waiting for the *GDB* connection.
```bash
root@ubuntu:~/rootfs# qemu-system-x86_64 -kernel /home/az4rvs/kernels/linux-4.4.302/arch/x86/boot/bzImage -initrd /root/
initramfs.cpio.gz -append "console=ttyS0 nokaslr" -s -S -nographic
```
- `qemu-system-x86_64`: *QEMU* binary that emulates an x86_64 architecture (64-bit PC).
- `-kernel /home/az4rvs/kernels/linux-4.4.302/arch/x86/boot/bzImage`: directly loads the Linux kernel image in bzImage format.
- `-initrd /root/initramfs.cpio.gz`: loads the `initramfs` into memory so that the kernel can mount it during boot.
- `console=ttyS0`: redirects the kernel console output to the first serial port, allowing me to view the boot process in the terminal when using `-nographic`.
- `nokaslr`: disables *KASLR*, allowing memory addresses to remain constant between reboots. This facilitates debugging.
- `-s`: It’s a shorthand for `-gdb tcp::1234`. What it does is open a *GDB* server on port 1234 of my local machine, which allows GDB to remotely connect to the kernel running in *QEMU* using: `target remote :1234`.
- `-S`: makes *QEMU* load the kernel but stop before executing any instruction. I do this to have full control right from the start.
- `-nographic`: disables the graphical window and redirects all I/O to the serial port in the terminal. I do this because I am in a headless environment.

I start *GDB* and load the `vmlinux` file as the binary to be debugged.
```bash
root@ubuntu:~# gdb /home/az4rvs/kernels/linux-4.4.302/vmlinux
GNU gdb (Ubuntu 12.1-0ubuntu1~22.04.2) 12.1
Copyright (C) 2022 Free Software Foundation, Inc.
License GPLv3+: GNU GPL version 3 or later <http://gnu.org/licenses/gpl.html>
This is free software: you are free to change and redistribute it.
There is NO WARRANTY, to the extent permitted by law.
Type "show copying" and "show warranty" for details.
This GDB was configured as "x86_64-linux-gnu".
Type "show configuration" for configuration details.
For bug reporting instructions, please see:
<https://www.gnu.org/software/gdb/bugs/>.
Find the GDB manual and other documentation resources online at:
    <http://www.gnu.org/software/gdb/documentation/>.

For help, type "help".
Type "apropos word" to search for commands related to "word"...
Reading symbols from /home/az4rvs/kernels/linux-4.4.302/vmlinux...
warning: File "/home/az4rvs/kernels/linux-4.4.302/scripts/gdb/vmlinux-gdb.py" auto-loading has been declined by your `auto-load safe-path' set to "$debugdir:$datadir/auto-load".
To enable execution of this file add
        add-auto-load-safe-path /home/az4rvs/kernels/linux-4.4.302/scripts/gdb/vmlinux-gdb.py
line to your configuration file "/root/.config/gdb/gdbinit".
To completely disable this security protection add
        set auto-load safe-path /
line to your configuration file "/root/.config/gdb/gdbinit".
For more information about this security protection see the
"Auto-loading safe path" section in the GDB manual.  E.g., run from the shell:
        info "(gdb)Auto-loading safe path"
(gdb)
```

By running `target remote :1234`, I’m telling *GDB* to connect to a remote target that is listening on TCP port 1234 on the local machine.
```gdb
(gdb) target remote :1234
Remote debugging using :1234
0x000000000000fff0 in exception_stacks ()
```

Let’s remember that I opened port 1234 by using the `-s` flag when running *QEMU*. What this does is open a *TCP* server on port 1234 of the local machine. That server implements the *GDB Remote Serial Protocol (RSP)*, a packet-based *ASCII* protocol.

This way, when I run `target remote :1234` in *GDB*, the debugger connects to that server and establishes a direct communication channel with the virtualized CPU. Through this channel, *GDB* can read and write registers, inspect memory, set breakpoints, and control the execution of the kernel. In other words, I have absolute control over the kernel’s execution.


![Diagrama](/images/kernel-debugging/Pasted_image_20250816013440.png)

## Exploring the kernel binary

I run `info target`.
```gdb
(gdb) info target
Symbols from "/home/az4rvs/kernels/linux-4.4.302/vmlinux".
Remote target using gdb-specific protocol:
        `/home/az4rvs/kernels/linux-4.4.302/vmlinux', file type elf64-x86-64.
warning: Cannot find section for the entry point of /home/az4rvs/kernels/linux-4.4.302/vmlinux.
        Entry point: 0x1000000
        0xffffffff81000000 - 0xffffffff818f9ba1 is .text
        0xffffffff818f9ba4 - 0xffffffff818f9bc8 is .notes
        0xffffffff818f9bd0 - 0xffffffff818fbc20 is __ex_table
        0xffffffff81a00000 - 0xffffffff81d235f0 is .rodata
        0xffffffff81d235f0 - 0xffffffff81d2b120 is __bug_table
        0xffffffff81d2b120 - 0xffffffff81d2e4f8 is .pci_fixup
        0xffffffff81d2e4f8 - 0xffffffff81d2e588 is .builtin_fw
        0xffffffff81d2e588 - 0xffffffff81d2e600 is .tracedata
        0xffffffff81d2e600 - 0xffffffff81d42580 is __ksymtab
        0xffffffff81d42580 - 0xffffffff81d50cf0 is __ksymtab_gpl
        0xffffffff81d50cf0 - 0xffffffff81d7ace3 is __ksymtab_strings
        0xffffffff81d7ace8 - 0xffffffff81d7eca8 is __param
        0xffffffff81d7eca8 - 0xffffffff81d7f000 is __modver
        0xffffffff81e00000 - 0xffffffff81f24bc0 is .data
        0xffffffff81f25000 - 0xffffffff81f26000 is .vvar
        0x0000000000000000 - 0x000000000001a718 is .data..percpu
        0xffffffff81f41000 - 0xffffffff81fa67d2 is .init.text
        0xffffffff81fa67d2 - 0xffffffff81fa6aca is .altinstr_aux
        0xffffffff81fa8000 - 0xffffffff82034600 is .init.data
        0xffffffff82034600 - 0xffffffff82034618 is .x86_cpu_dev.init
        0xffffffff82034618 - 0xffffffff8203cbf4 is .altinstructions
        0xffffffff8203cbf4 - 0xffffffff8203ee74 is .altinstr_replacement
        0xffffffff8203ee78 - 0xffffffff8203ef40 is .iommu_table
        0xffffffff8203ef40 - 0xffffffff8203ef50 is .apicdrivers
        0xffffffff8203ef50 - 0xffffffff82041271 is .exit.text
        0xffffffff82042000 - 0xffffffff8204a000 is .smp_locks
        0xffffffff8204a000 - 0xffffffff8204b000 is .data_nosave
        0xffffffff8204b000 - 0xffffffff82126000 is .bss
        0xffffffff82126000 - 0xffffffff8214c000 is .brk
        While running this, GDB does not access memory from...
Local exec file:
        `/home/az4rvs/kernels/linux-4.4.302/vmlinux', file type elf64-x86-64.
warning: Cannot find section for the entry point of /home/az4rvs/kernels/linux-4.4.302/vmlinux.
        Entry point: 0x1000000
        0xffffffff81000000 - 0xffffffff818f9ba1 is .text
        0xffffffff818f9ba4 - 0xffffffff818f9bc8 is .notes
        0xffffffff818f9bd0 - 0xffffffff818fbc20 is __ex_table
        0xffffffff81a00000 - 0xffffffff81d235f0 is .rodata
        0xffffffff81d235f0 - 0xffffffff81d2b120 is __bug_table
        0xffffffff81d2b120 - 0xffffffff81d2e4f8 is .pci_fixup
        0xffffffff81d2e4f8 - 0xffffffff81d2e588 is .builtin_fw
        0xffffffff81d2e588 - 0xffffffff81d2e600 is .tracedata
        0xffffffff81d2e600 - 0xffffffff81d42580 is __ksymtab
        0xffffffff81d42580 - 0xffffffff81d50cf0 is __ksymtab_gpl
        0xffffffff81d50cf0 - 0xffffffff81d7ace3 is __ksymtab_strings
        0xffffffff81d7ace8 - 0xffffffff81d7eca8 is __param
        0xffffffff81d7eca8 - 0xffffffff81d7f000 is __modver
        0xffffffff81e00000 - 0xffffffff81f24bc0 is .data
        0xffffffff81f25000 - 0xffffffff81f26000 is .vvar
        0x0000000000000000 - 0x000000000001a718 is .data..percpu
        0xffffffff81f41000 - 0xffffffff81fa67d2 is .init.text
        0xffffffff81fa67d2 - 0xffffffff81fa6aca is .altinstr_aux
        0xffffffff81fa8000 - 0xffffffff82034600 is .init.data
        0xffffffff82034600 - 0xffffffff82034618 is .x86_cpu_dev.init
        0xffffffff82034618 - 0xffffffff8203cbf4 is .altinstructions
        0xffffffff8203cbf4 - 0xffffffff8203ee74 is .altinstr_replacement
        0xffffffff8203ee78 - 0xffffffff8203ef40 is .iommu_table
        0xffffffff8203ef40 - 0xffffffff8203ef50 is .apicdrivers
        0xffffffff8203ef50 - 0xffffffff82041271 is .exit.text
        0xffffffff82042000 - 0xffffffff8204a000 is .smp_locks
        0xffffffff8204a000 - 0xffffffff8204b000 is .data_nosave
        0xffffffff8204b000 - 0xffffffff82126000 is .bss
        0xffffffff82126000 - 0xffffffff8214c000 is .brk
```

- The **double listing** you see is not an error or anything like that. This double listing shows the remote program running and the local file with symbols. This is important because if they don’t match, it means I’m debugging a different binary than the one running in *QEMU*. However, that’s not the case here, since everything matches as it should.
- The **warning** appears because the *ELF* entry point (`0x1000000`) does not match any section currently loaded in memory. This happens because, when the Linux kernel boots, it relocates its code and data to higher memory addresses (for example, the `.text` section is loaded at `0xffffffff81000000`). *GDB* detects that the address specified as the *ELF* entry point (`0x1000000`) is not part of the sections mapped in memory (the actual first `.text` section is at `0xffffffff81000000`), so it issues the warning. This behavior is completely normal; it’s not an error or anything like that. To complement the explanation, relocations are performed to avoid conflicts with other programs or the firmware, since the original *ELF* address (`0x1000000`) could overlap with areas used by the *bootloader*, *BIOS*, etc. They are also done to optimize *virtual mapping*, as the kernel is usually mapped into the higher part of the virtual address space.

I want to include an analogy to make this part very clear, which is really harmless, but for some reason, I want everyone to understand it well:  
Imagine that the kernel is a prefabricated building:

- The *ELF* is the original blueprint, with all the rooms and hallways placed at “theoretical” coordinates (`0x1000000`, `0x2000000`, etc.).
- The machine’s *real memory* is the land, which already has other buildings (bootloader, BIOS, firmware stack).
- Before inhabiting it, you must move the building to a safe, higher plot so that it doesn’t collide with anything already in place. That would be the relocation.

```gdb
0xffffffff81000000 - 0xffffffff818f9ba1 is .text
0xffffffff81a00000 - 0xffffffff81d235f0 is .rodata
0xffffffff81e00000 - 0xffffffff81f24bc0 is .data
0x0000000000000000 - 0x000000000001a718 is .data..percpu
0xffffffff81f41000 - 0xffffffff81fa67d2 is .init.text
0xffffffff81fa8000 - 0xffffffff82034600 is .init.data
0xffffffff8204b000 - 0xffffffff82126000 is .bss
```
- *.text*: executable code of the kernel, this is where `start_kernel` and most functions are located.
- *.rodata*: constant data and read-only tables.
- *.data*: initialized global variables. This is useful for the kernel’s state.
- *.data..percpu*: section where the kernel stores data that is private to each CPU. These are global variables but not shared; instead, they are replicated once for each processor. This is key to understanding how the kernel manages multiple cores.
- *.init.text*: kernel initialization executable code (functions used only during boot, such as `start_kernel`, `rest_init`).
- *.init.data*: data and variables used only by the `.init.text` code.
- *.bss*: uninitialized global variables (filled with 0). Allows monitoring of internal structures that change dynamically.

**So... What’s the point of running info target?**  
Before setting breakpoints or inspecting variables in the kernel, I need to understand how each section is mapped in memory. For this, I run `info target` in *GDB*, since it provides a complete map of the loaded sections and their *real addresses*. With this information, I can safely set *breakpoints* in actually loaded code, avoiding common mistakes such as trying to stop execution in the `.init.text` section after it has been freed. It also allows me to interpret the location of variables and structures, distinguishing between initialized data, uninitialized data, or read-only constants, and to anticipate any unexpected behavior, ensuring that every observed address and every placed breakpoint corresponds to valid and executable memory at runtime.

> Although in practice `info target` already provides all the necessary information, some debuggers also run `info files` to compare the ELF on disk with the state loaded in memory. In this case, both show the same, so I focus on `info target`.


I run `info functions start_kernel` to list all functions matching `start_kernel` in the symbols loaded from `vmlinux`. This not only gives me the exact address of the kernel’s entry point in C, but also allows me to distinguish between the different variants with similar names, avoiding confusion when setting breakpoints.
```gdb
(gdb) info functions start_kernel
All functions matching regular expression "start_kernel":

File arch/x86/kernel/head64.c:
142:    void x86_64_start_kernel(char *);

File init/main.c:
499:    void start_kernel(void);
```

- `void x86_64_start_kernel(char *)`: acts as the bridge between the assembly boot and the C code, preparing the minimal environment before jumping to the kernel.
- `void start_kernel(void)`: it is the true entry point of the kernel in C; from here begins the initialization of memory, processes, the scheduler, devices, and all subsystems.

## First checkpoint: start_kernel

I set a breakpoint at `start_kernel` because it allows me to inspect the initial state of the system right before critical subsystems such as memory, the scheduler, and devices are configured. This way, I get a clean and organized view of the kernel’s boot, avoiding getting “lost” in the earlier call flow that belongs solely to environment preparation.
```gdb
(gdb) break start_kernel
Breakpoint 1 at 0xffffffff81f419de: file init/main.c, line 509.
```

I run `continue` to let the kernel keep running until it reaches the breakpoint I set at `start_kernel`.
```gdb
(gdb) continue
Continuing.

Breakpoint 1, start_kernel () at init/main.c:509
509             set_task_stack_end_magic(&init_task);
```
The debugger confirms that execution has stopped at line 509 of the file `init/main.c`, showing me the first instruction that will be executed inside this function.

I run `list` to view the source code around the line where the kernel stopped. Although I already know I’m inside `start_kernel`, listing the code helps visually confirm the debugger’s position and makes it easier to follow the execution flow, while also providing some context about what’s going on.
```gdb
(gdb) list
504             /*
505              * Need to run as early as possible, to initialize the
506              * lockdep hash:
507              */
508             lockdep_init();
509             set_task_stack_end_magic(&init_task);
510             smp_setup_processor_id();
511             debug_objects_early_init();
512
513             /*
```

## Analyzing the execution flow

I run `bt` (backtrace) to obtain the call trace that brought the kernel to the `start_kernel` function. This allows me to confirm that the boot flow followed the expected path for the x86_64 architecture; that’s why it’s always interesting to run a backtrace at this stage of debugging.
```gdb
(gdb) bt
#0  start_kernel () at init/main.c:509
#1  0xffffffff81f41286 in x86_64_start_reservations (real_mode_data=<optimized out>) at arch/x86/kernel/head64.c:196
#2  0xffffffff81f41386 in x86_64_start_kernel (real_mode_data=0x13db0 <thermal_state+48> <error: Cannot access memory at address 0x13db0>)
    at arch/x86/kernel/head64.c:185
#3  0x0000000000000000 in ?? ()
```

I see registers such as `rip`, which points to the current instruction in `start_kernel`; `rsp`/`rbp`, which show the stack address of the initial thread; `cr0`/`cr3`, which confirm that paging is already enabled; and SIMD registers (`xmm0`–`xmm15`), which I trim a bit to reduce reading noise.
```gdb
(gdb) info registers
rax            0x0                 0
rbx            0x81f48e0000101117  -9082478417847250665
rcx            0x40                64
rdx            0xffffffff82013dc0  -2113847872
rsi            0x9f000             651264
rdi            0x0                 0
rbp            0xffffffff81e03fc0  0xffffffff81e03fc0 <init_thread_union+16320>
rsp            0xffffffff81e03fb8  0xffffffff81e03fb8 <init_thread_union+16312>
r8             0x0                 0
r9             0x81f4000000000000  -9082634548499447808
r10            0x2461f26           38149926
r11            0x0                 0
r12            0x81f48e0000101117  -9082478417847250665
r13            0x13db0             81328
r14            0x0                 0
r15            0x0                 0
rip            0xffffffff81f419de  0xffffffff81f419de <start_kernel>
eflags         0x82                [ IOPL=0 SF ]
cs             0x10                16
ss             0x0                 0
ds             0x0                 0
es             0x0                 0
fs             0x0                 0
gs             0x0                 0
fs_base        0x0                 0
gs_base        0xffffffff81f26000  -2114822144
k_gs_base      0x0                 0
cr0            0x80050033          [ PG AM WP NE ET MP PE ]
cr2            0xffff880000013db0  -131941395251792
cr3            0x1faa000           [ PDBR=8106 PCID=0 ]
cr4            0x30                [ PAE PSE ]
cr8            0x0                 0
efer           0xd01               [ NXE LMA LME SCE ]
xmm0           {v4_float = {0x0, 0x0, 0x0, 0x0}, v2_double = {0x0, 0x0}, v16_int8 = {0x0 <repeats 16 times>}, v8_int16 = {0x0, 0x0, 0x0, 0x0, 0x0, 0x0, 0x0, 0x0}, v4_int32 = {0x0, 0x0, 0x0, 0x0}, v2_int64 = {0x0, 0x0}, uint128 = 0x0}
xmm1           {v4_float = {0x0, 0x0, 0x0, 0x0}, v2_double = {0x0, 0x0}, v16_int8 = {0x0 <repeats 16 times>}, v8_int16 = {0x0, 0x0, 0x0, 0x0, 0x0, 0x0, 0x0, 0x0}, v4_int32 = {0x0, 0x0, 0x0, 0x0}, v2_int64 = {0x0, 0x0}, uint128 = 0x0}
xmm2           {v4_float = {0x0, 0x0, 0x0, 0x0}, v2_double = {0x0, 0x0}, v16_int8 = {0x0 <repeats 16 times>}, v8_int16 = {0x0, 0x0, 0x0, 0x0, 0x0, 0x0, 0x0, 0x0}, v4_int32 = {0x0, 0x0, 0x0, 0x0}, v2_int64 = {0x0, 0x0}, uint128 = 0x0}
...
```

I run `info locals` to inspect the local variables of `start_kernel`. In this case, `command_line` and `after_dashes` appear, but both are shown as `<optimized out>`. This happens because the kernel is compiled with optimizations, which makes certain variables unavailable at debugging time. I decided to keep optimizations enabled because they reflect a real-world scenario: production kernels are almost always compiled with them. Therefore, this behavior is not an error but a normal condition in a realistic debugging analysis.
```gdb
(gdb) info locals
command_line = <optimized out>
after_dashes = <optimized out>
```

## Inspecting the stack

I run `x/10gx $rsp` to examine the memory contents starting from the stack pointer (`$rsp`), displaying 10 words (each 8 bytes) around that address. I also run `x/20gx $rsp` so you can see the difference in the output.
```gdb
(gdb) x/10gx $rsp
0xffffffff81e03fb8 <init_thread_union+16312>:   0xffffffff81f41286      0xffffffff81e03fe8
0xffffffff81e03fc8 <init_thread_union+16328>:   0xffffffff81f41386      0x0000000000000000
0xffffffff81e03fd8 <init_thread_union+16344>:   0x0000000000000000      0x0000000000000000
0xffffffff81e03fe8 <init_thread_union+16360>:   0x0000000000000000      0x0000000000000000
0xffffffff81e03ff8 <init_thread_union+16376>:   0x0000000000000000      0x00010102464c457f
(gdb) x/20gx $rsp
0xffffffff81e03fb8 <init_thread_union+16312>:   0xffffffff81f41286      0xffffffff81e03fe8
0xffffffff81e03fc8 <init_thread_union+16328>:   0xffffffff81f41386      0x0000000000000000
0xffffffff81e03fd8 <init_thread_union+16344>:   0x0000000000000000      0x0000000000000000
0xffffffff81e03fe8 <init_thread_union+16360>:   0x0000000000000000      0x0000000000000000
0xffffffff81e03ff8 <init_thread_union+16376>:   0x0000000000000000      0x00010102464c457f
0xffffffff81e04008 <raw_data+8>:        0x0000000000000000      0x00000001003e0003
0xffffffff81e04018 <raw_data+24>:       0x0000000000000000      0x0000000000000040
0xffffffff81e04028 <raw_data+40>:       0x0000000000000d10      0x0038004000000000
0xffffffff81e04038 <raw_data+56>:       0x0010001100400004      0x0000000500000001
0xffffffff81e04048 <raw_data+72>:       0x0000000000000000      0x0000000000000000
```

When running `x/10gx $rsp`, I examine the first ten positions of the stack, which correspond to the frame of the current function (`start_kernel`). With `x/20gx $rsp`, I expand the view and, in addition to that frame, I start to see addresses and data that go beyond the scope of the current function, delving into adjacent areas of kernel memory. To explain it with an analogy: it’s like looking inside a tower of stacked boxes from above. With the first command, I open only the top box, which contains the current function. With the second command, I look deeper and can also see the next box, or even empty spaces that are not yet in use.

## From the entry point to the target function

Now, let’s suppose you dive straight into analyzing the kernel and already know which function you want to analyze. The most professional approach is to first anchor yourself in a safe place and then move down to the target function (in this case, `setup_arch`). Obviously, I don’t mean that if you’re going to do a quick debugging session or a focused analysis you can’t set the breakpoint directly in `setup_arch`. Of course, you can. However, setting the breakpoint first in `start_kernel` and then in `setup_arch` gives you complete traceability, in other words, a more organized map of the boot process. In this case, I’m doing it this way for pedagogical clarity. So, with that said, let’s continue.

With the idea now clarified, I move on to defining the breakpoints.
```gdb
(gdb) b start_kernel
Breakpoint 1 at 0xffffffff81f419de: file init/main.c, line 509.
(gdb) b setup_arch
Breakpoint 2 at 0xffffffff81f44642: file arch/x86/kernel/setup.c, line 851.
```

I run `c` to continue the kernel’s execution until one of the breakpoints I’ve set is reached.
```gdb
(gdb) c
Continuing.

Breakpoint 1, start_kernel () at init/main.c:509
509             set_task_stack_end_magic(&init_task);
(gdb) c
Continuing.

Breakpoint 2, setup_arch (cmdline_p=0xffffffff81e03f98 <init_thread_union+16280>) at arch/x86/kernel/setup.c:851
851             memblock_reserve(__pa_symbol(_text),
```
The first `c` stopped execution at `start_kernel`, right at line 509 of the file `init/main.c`, confirming that the initial breakpoint was reached successfully. Running `c` again, execution continued until it hit the second breakpoint, located in `setup_arch`. At this point, the debugger shows that we are at line 851 of `arch/x86/kernel/setup.c`, where the call to `memblock_reserve` takes place. This confirms that the boot trace followed the expected flow: from `start_kernel` to `setup_arch`.

I run `list` to view the source code around the point where the debugger is stopped, inside the `setup_arch` function. I do this twice to show that if I run the `list` command again, it moves forward and displays the following lines.
```gdb
(gdb) list
846      * Note: On x86_64, fixmaps are ready for use even before this is called.
847      */
848
849     void __init setup_arch(char **cmdline_p)
850     {
851             memblock_reserve(__pa_symbol(_text),
852                              (unsigned long)__bss_stop - (unsigned long)_text);
853
854             /*
855              * Make sure page 0 is always reserved because on systems with
(gdb) list
856              * L1TF its contents can be leaked to user processes.
857              */
858             memblock_reserve(0, PAGE_SIZE);
859
860             early_reserve_initrd();
861
862             /*
863              * At this point everything still needed from the boot loader
864              * or BIOS or kernel text should be early reserved or marked not
865              * RAM in e820. All other memory is free game.
```
The first `list` shows me the initial lines of the `setup_arch` function, specifically from the declaration up to the first call to `memblock_reserve`, which reserves the memory space occupied by the kernel’s text section (from `_text` to `__bss_stop`).

The second `list` moves forward showing more lines, where a second call to `memblock_reserve` can be seen to reserve page 0 (a security measure against vulnerabilities like _L1TF_), followed by the call to `early_reserve_initrd`. With this brief analysis, I can see how `setup_arch` takes care of reserving critical memory ranges for the kernel very early on, ensuring they cannot be misused.

Since I saw that the function responsible for reserving memory regions during boot is `memblock_reserve`, I decide to set a breakpoint there. It’s undeniable that this function sparks curiosity.
```gdb
(gdb) break memblock_reserve
Breakpoint 3 at 0xffffffff81fa5a6f: file mm/memblock.c, line 711.
```

I run the `c` command to continue the kernel’s execution until it reaches the next breakpoint (`memblock_reserve`).
```gdb
(gdb) c
Continuing.

Breakpoint 3, memblock_reserve (base=16777216, size=17981440) at mm/memblock.c:711
711             memblock_dbg("memblock_reserve: [%#016llx-%#016llx] flags %#02lx %pF\n",
```
The debugger halts right at the first call to `memblock_reserve`. I can see that the function receives two arguments (`base=16777216` and `size=17981440`) and that we are at line 711 of the file `mm/memblock.c`. This confirms that memory reservation has already started, which will allow me to inspect in detail how the kernel handles the initial memory mapping.

Now I run `info args` to inspect the arguments of the function where execution is currently stopped.
```gdb
(gdb) info args
base = 16777216
size = 17981440
```
The debugger shows me `base = 16777216` and `size = 17981440`. This confirms that I’m indeed looking at the parameters passed to the `memblock_reserve` function during its first call.

What I can also do is print the arguments in hexadecimal format.
```gdb
(gdb) p/x base
$1 = 0x1000000
(gdb) p/x size
$2 = 0x1126000
```
At first sight it may seem useless, but it’s quite the opposite: this is the format in which memory addresses are usually represented in the kernel. This notation makes it easier to understand and correlate the information with the memory maps that the kernel handles during boot.

Next, I run the `list` command to display the source code surrounding the `memblock_reserve` function, allowing me to get some extra context on what’s happening there.
```gdb
(gdb) list
706                                                        int nid,
707                                                        unsigned long flags)
708     {
709             struct memblock_type *type = &memblock.reserved;
710
711             memblock_dbg("memblock_reserve: [%#016llx-%#016llx] flags %#02lx %pF\n",
712                          (unsigned long long)base,
713                          (unsigned long long)base + size - 1,
714                          flags, (void *)_RET_IP_);
```
What I can see is that `memblock_reserve` takes the parameters and prepares the call to `memblock_dbg` (line 711), which prints debug information about the memory reservation.

I run the `bt` (backtrace) command to display the call stack that led me to `memblock_reserve`.
```gdb
(gdb) bt
#0  memblock_reserve (base=16777216, size=17981440) at mm/memblock.c:711
#1  0xffffffff81f4467d in setup_arch (cmdline_p=0xffffffff81e03f98 <init_thread_union+16280>) at arch/x86/kernel/setup.c:851
#2  0xffffffff81f41a5d in start_kernel () at init/main.c:530
#3  0xffffffff81f41286 in x86_64_start_reservations (real_mode_data=<optimized out>) at arch/x86/kernel/head64.c:196
#4  0xffffffff81f41386 in x86_64_start_kernel (real_mode_data=0x13db0 <thermal_state+48> <error: Cannot access memory at address 0x13db0>)
    at arch/x86/kernel/head64.c:185
#5  0x0000000000000000 in ?? ()
```
I do this to get a hierarchical view of the execution flow. It allows me to confirm not only where the debugger stopped, but also how it got there. This way, I obtain a clear map of the kernel initialization process and the relationships between critical boot functions.

Interpretation of the output: **Frame #5 → #4 → #3 → #2 → #1 → #0**.  
The call stack is read from the bottom up: the kernel began executing very low-level boot routines, then progressively climbed into increasingly "higher" functions until finally reaching the memory reservation stage.

- *Frame #5: 0x0000000000000000 in ?? ()*  
	When you see `??()` in the backtrace, it means that GDB cannot display the function name because, at that stage of the boot process, the kernel is still executing very early Assembly routines (such as those in `head_64.S`) that don’t have debugging symbols. To put it more simply: there isn’t enough information loaded yet to map addresses to functions, which is why it shows up as empty.

- *Frame #4: x86_64_start_kernel*  
	The kernel first boots with ASM routines that put the CPU into long mode (64-bit). Once ready, control is transferred to the first C function: `x86_64_start_kernel`. What happens here is preparing the minimal environment needed to call “higher-level” functions: adjusting registers and stack pointers, finishing the setup of 64-bit protected mode, ensuring that the initial memory already contains the necessary structures, and passing control to `x86_64_start_reservations`.

- *Frame #3: x86_64_start_reservations*  
	After executing `x86_64_start_kernel`, the flow jumps to `x86_64_start_reservations` because that is the next natural stage of the boot process in C. There’s a reason for this: before continuing with the full kernel initialization (`start_kernel`), it is necessary to reserve critical memory and validate basic boot structures. This function ensures that the initial reservations (such as the kernel area in memory) are set aside before proceeding.

- *Frame #2: start_kernel*  
	After completing the initial reservations in `x86_64_start_reservations`, the flow moves to `start_kernel` (which is the heart of the boot process) because once it’s ensured that critical memory is reserved, the kernel can start initializing the rest of its infrastructure: scheduler, virtual memory, interrupts, devices, etc.

- *Frame #1: setup_arch*  
	One of the first tasks of `start_kernel` is to invoke `setup_arch` because the kernel still knows nothing about the platform it’s running on (CPU, memory, devices), and `setup_arch` is responsible for initializing everything architecture-dependent: physical memory, e820 table, CPUs, early drivers, etc.

- *Frame #0: memblock_reserve*  
	After entering `setup_arch`, the flow jumps to `memblock_reserve` because `setup_arch` needs to reserve critical memory during boot. The debugger stops here since the breakpoint I set is in this function.

I run `info frame` to inspect in detail the state of the current stack frame, that is, which function is executing, with what arguments, and where it will return when finished.
```gdb
(gdb) info frame
Stack level 0, frame at 0xffffffff81e03f38:
 rip = 0xffffffff81fa5a6f in memblock_reserve (mm/memblock.c:711); saved rip = 0xffffffff81f4467d
 called by frame at 0xffffffff81e03f98
 source language c.
 Arglist at 0xffffffff81e03f28, args: base=16777216, size=17981440
 Locals at 0xffffffff81e03f28, Previous frame's sp is 0xffffffff81e03f38
 Saved registers:
  rip at 0xffffffff81e03f30
```
The output tells me that I am in the `memblock_reserve` function (line 711 of `mm/memblock.c`), which was called from `setup_arch`. I can see the arguments used to reserve memory (`base=16MB`, `size=17MB`), the return address where execution will continue (`setup_arch`), and the frame’s location on the stack with the saved registers. In short: the kernel is reserving a critical memory block, and afterwards it will return to the normal flow in `setup_arch`.

I run `finish` to go to the end of the `memblock_reserve` function.
```gdb
(gdb) finish
Run till exit from #0  memblock_reserve (base=16777216, size=17981440) at mm/memblock.c:711
setup_arch (cmdline_p=0xffffffff81e03f98 <init_thread_union+16280>) at arch/x86/kernel/setup.c:858
858             memblock_reserve(0, PAGE_SIZE);
Value returned is $8 = 0
```
From the output I get, I can see that upon finishing, `memblock_reserve` returns to its caller `setup_arch`, thus confirming the natural execution flow during boot.

Now that we understand how the kernel boot unfolds and how to inspect its flow with GDB, we will move on to locating and exploiting the Dirty COW vulnerability (CVE-2016-5195) in our vulnerable kernel. Here come the chicharrones (the juicy part), comrades!
