---
title: "Kernel Debugging I"
date: "2025-08-10"

---

# Environment Preparation - First Part
When searching for articles on how to perform Kernel Debugging in Linux, I came across very few accessible resources, and most of them could be complex for those just starting out or wanting to dive into this layer of the system, which is certainly deep. That’s why I decided to create this article, aimed at those who want to get into the world of the kernel without getting frustrated, as well as for those who wish to go deeper and solidify knowledge already acquired from the very basics.

I hope this content is useful and serves as a guide for those who want to explore and master the kernel. Big hug!
![Chicharron](/images/kernel-debugging/Image_fx.jpg)

For this lab, I’m working on a *Ubuntu Server 22.04.5 LTS* (headless) host machine, with kernel 5.15.0, where I’ll compile and run everything from scratch.
## Why Linux kernel 4.4.302?  
I chose version 4.4.302 of the Linux kernel because it belongs to the 4.4 LTS series, which was widely implemented in distributions such as *Ubuntu 16.04.6*. This particular version is interesting because it includes historical vulnerabilities like *CVE-2016-5195* (*Dirty Cow*), which will allow me to analyze the system’s behavior under real exploitation conditions.

## Preparing my toolchain

What you should always keep in mind whenever you’re going to do kernel debugging is that you must have your complete toolchain. If any version incompatibility shows up with one of the tools, simply adjust (by upgrading or downgrading) the version accordingly. The one that most often causes issues is _gcc_, especially when trying to compile or debug an old kernel.

```bash
az4rvs@ubuntu:~$ sudo apt update && sudo apt upgrade -y
az4rvs@ubuntu:~$ sudo apt install -y make binutils flex bison
az4rvs@ubuntu:~$ sudo apt install -y qemu-system-x86
az4rvs@ubuntu:~$ sudo apt install -y gdb-multiarch
az4rvs@ubuntu:~$ sudo apt install -y gcc g++
az4rvs@ubuntu:~$ sudo apt install -y libc6-dev
az4rvs@ubuntu:~$ sudo apt install -y bc
```

- `make`: compiles the kernel and other programs.
- `binutils`: includes *ld*, *as*, and other utilities for linking and assembling code.
- `flex` and `bison`: generate lexical and syntax analyzers, necessary for parts of the kernel.
- `qemu-system-x86`: emulates the CPU and hardware to run the kernel.
- `gdb-multiarch`: debugger that can connect to kernels of different architectures.
- `bc`: precision calculator for operations and conversions during debugging.
- `libc6-dev`: contains the header files and libraries needed to compile *C* programs that use the standard C library. Without them, the compilation would fail with “file not found” errors for the headers or with undefined symbols at linking time.
- I install `GCC` and `G++` to be able to compile the kernel and other tools that require C or C++. GCC handles C code, and G++ handles C++.

## Kernel source code download
To begin the analysis, I download from the official kernel.org servers the compressed file containing the **Linux kernel source code**, version 4.4.302.
```bash
root@ubuntu:/home/az4rvs/kernels# wget https://cdn.kernel.org/pub/linux/kernel/v4.x/linux-4.4.302.tar.xz
```
- `wget`: tool for downloading files from the internet non-interactively.

I extract and unpack the file to access the source code.
```bash
root@ubuntu:/home/az4rvs/kernels# tar -xf linux-4.4.302.tar.xz
```
- `tar`: tool used to pack and unpack `.tar` files.
- `-x`: `extract`. Tells `tar` to extract the contents of the file.
- `-f`: `file`. Tells `tar` that what follows is the name of the file from which the contents will be extracted.

## Kernel configuration

I generate the base **configuration file** (`.config`), which is important for **compiling** the kernel. This file defines which functionalities, drivers, and features will be included in the kernel during compilation.
```bash
root@ubuntu:/home/az4rvs/kernels/linux-4.4.302# make defconfig
  HOSTCC  scripts/basic/fixdep
  HOSTCC  scripts/kconfig/conf.o
  SHIPPED scripts/kconfig/zconf.tab.c
  SHIPPED scripts/kconfig/zconf.lex.c
  SHIPPED scripts/kconfig/zconf.hash.c
  HOSTCC  scripts/kconfig/zconf.tab.o
  HOSTLD  scripts/kconfig/conf
*** Default configuration is based on 'x86_64_defconfig'
#
# configuration written to .config
#
```
- `make`: tool that interprets the Makefile and executes the defined tasks to compile the software.
- `defconfig`: indicates to load a default configuration, generally optimized for standard use.

**What is the `.config` file?**  
It is the **base configuration file**, containing all the kernel configuration options enabled or disabled. It defines things such as which modules are compiled, which subsystems are enabled, and which debugging options are activated. It is a key component before starting the compilation.

In my case, I plan to use *GDB* for **Kernel Debugging**, so I need to manually enable certain options in the `.config` file, including:
	CONFIG_DEBUG_KERNEL=y
	CONFIG_DEBUG_INFO=y
	# CONFIG_DEBUG_INFO_REDUCED is not set
	CONFIG_FRAME_POINTER=y
	CONFIG_KALLSYMS=y
	CONFIG_KALLSYMS_ALL=y
	CONFIG_GDB_SCRIPTS=y

These settings allow me to include symbolic debugging information, preserve frame pointers, and generate full symbols so that *GDB* can properly interpret the kernel.

Something I want to mention is that without enabling the `CONFIG_DEBUG_INFO` option, *GDB* will not be able to access the kernel’s symbols or internal structures; it would only display **hexadecimal addresses**, making kernel analysis practically useless.

At first, when opening the `.config` file, it’s very likely that certain options such as `CONFIG_DEBUG_INFO_REDUCED` or `CONFIG_GDB_SCRIPTS` won’t appear. This is normal, since the kernel doesn’t generate them until the internal dependencies are resolved.

What you can do is first enable the options that do appear, then run `make olddefconfig`. This forces the configuration system to regenerate the file and add the new related options. From there, you’ll be able to find and configure the options that were missing.
```bash
root@ubuntu:/home/az4rvs/kernels/linux-4.4.302# make olddefconfig
scripts/kconfig/conf  --olddefconfig Kconfig
#
# configuration written to .config
#
```

![Options](/images/kernel-debugging/Pasted_image_20250806164209.png)

## Kernel compilation

I compile the kernel using **2 execution threads** (since this machine only has 2 cores), generating the binaries needed for analysis and emulation.
```bash
root@ubuntu:/home/az4rvs/kernels/linux-4.4.302# make -j2
```
- `make`: tool used to compile the Linux kernel.
- `-j`: allows parallel compilation, using multiple CPU cores to speed up the process.

This will **generate**:
	`vmlinux`: for use with *GDB*.
	`arch/x86/boot/bzImage`: for booting with *QEMU*.

## Creating the root filesystem (rootfs)
Once the kernel is compiled, I need to prepare a *minimal root filesystem*, which will be mounted as the root during boot. This will allow me to **run commands** inside the virtualized environment, interact with the system, and perform analysis from user space.

**What is the rootfs?**  
It is the filesystem that the kernel mounts as its root right after booting. It contains:  
- The `init` program or `initramfs/init`,  
- Basic libraries,  
- System tools (such as *sh*, *mount*, *busybox*, etc.),  
- And anything else I want to exist inside the user environment.

I want to clarify that a *minimal rootfs* refers to a **simplified version** of the root filesystem that contains only what is necessary to start the system and run basic commands from a shell. Unlike much larger and more complete root filesystems, such as a full Ubuntu installation that includes the entire desktop environment, a minimal rootfs is **ideal for debugging**.

I create the directory that will serve as the *minimal root filesystem* that the kernel will mount during boot. This directory will contain the essentials, to later package it into an image that the kernel will load when booting in *QEMU*.
```bash
root@ubuntu:/home/az4rvs/kernels/linux-4.4.302# mkdir -p ~/rootfs
root@ubuntu:/home/az4rvs/kernels/linux-4.4.302# cd ~/rootfs
root@ubuntu:~/rootfs#
```
- `mkdir`: creates directories in Linux.
- `-p`: `parents`. Ensures that if intermediate directories in the path do not exist, they are created automatically, and if the directory already exists, no error is shown.
- `~/rootfs`: indicates that the `rootfs` directory will be created inside the current user’s home directory (`~`).

I download the compressed file containing the **BusyBox** version 1.36 source code from its official server.
```bash
root@ubuntu:~/rootfs# cd ..
root@ubuntu:~# wget https://busybox.net/downloads/busybox-1.36.1.tar.bz2
--2025-08-22 17:20:17--  https://busybox.net/downloads/busybox-1.36.1.tar.bz2
Resolving busybox.net (busybox.net)... 140.211.167.122
Connecting to busybox.net (busybox.net)|140.211.167.122|:443... connected.
HTTP request sent, awaiting response... 200 OK
Length: 2525473 (2.4M) [application/x-bzip2]
Saving to: ‘busybox-1.36.1.tar.bz2’

busybox-1.36.1.tar.bz2        100%[=================================================>]   2.41M  2.25MB/s    in 1.1s

2025-08-22 17:20:26 (2.25 MB/s) - ‘busybox-1.36.1.tar.bz2’ saved [2525473/2525473]

root@ubuntu:~# ls
busybox-1.36.1.tar.bz2  rootfs
```
I download it to the `/root` directory because it is a temporary workspace where I will prepare and compile *BusyBox*. Once compiled, I run `make install` targeting `rootfs`, so the essential files are copied inside `/rootfs`. This way, I keep everything organized, separating the build environment and the *minimal root filesystem*.

I decompress and extract the contents of the compressed file.
```bash
root@ubuntu:~# tar -xjf busybox-1.36.1.tar.bz2
root@ubuntu:~# ls
busybox-1.36.1  busybox-1.36.1.tar.bz2  rootfs
root@ubuntu:~# rm -rf busybox-1.36.1.tar.bz2
root@ubuntu:~# ls
busybox-1.36.1  rootfs
```
- `tar`: tool for packing and unpacking files and directories in Linux.
- `-x`: extract files from the compressed archive.
- `-j`: indicates that the file is compressed with bzip2, so a decompressor must be used.
- `-f`: specifies that the name of the file to be processed follows.

I generate a **base configuration file** for compilation. This `.config` file defines which applets (commands) and features will be compiled and included in the final binary.
```bash
root@ubuntu:~/busybox-1.36.1# make defconfig
```
- `make`: tool that interprets the Makefile and executes the defined tasks to compile the software.
- `defconfig`: indicates to load a default configuration, generally optimized for standard use.


I modify the `.config` configuration file of *BusyBox* to enable the `CONFIG_STATIC` option. Enabling this option means that BusyBox will be compiled as a *static binary*, which I do to ensure that it includes all the necessary libraries within the same executable, avoiding external dependencies. This guarantees that it will work correctly in a minimal rootfs.

This time, instead of manually editing the file, I use the `sed` command for a change.
```bash
root@ubuntu:~/busybox-1.36.1# sed -i 's/# CONFIG_STATIC is not set/CONFIG_STATIC=y/' .config
```
- `sed`: command-line text editing tool that allows searching and replacing text in files.
- `-i`: indicates that the modification should be made in-place (directly in the file, without creating a copy).

This time, after modifying the `.config`, I do not run `make olddefconfig` again because *BusyBox* handles configuration differently, and doing so could overwrite the changes I made. Therefore, I proceed directly with the compilation.

I compile *BusyBox* using two CPU cores in parallel.
```bash
root@ubuntu:~/busybox-1.36.1# make -j2
```
- `make`: tool used to compile the Linux kernel.
- `-j`: allows parallel compilation, using multiple CPU cores to speed up the process.

I install the compiled *BusyBox* files into the `/root/rootfs` directory, which serves as the minimal root filesystem for the kernel.
```bash
root@ubuntu:~/busybox-1.36.1# make CONFIG_PREFIX=/root/rootfs install
```

I create the essential directories inside the *minimal root filesystem* that *BusyBox* will use during system boot.
```bash
root@ubuntu:~/rootfs# mkdir -p proc sys dev etc tmp
root@ubuntu:~/rootfs# ls
bin  dev  etc  linuxrc  proc  sbin  sys  tmp  usr
```
- *proc*: mount point for the proc filesystem. Provides information about processes and the system.
- *sys*: mount point for the sysfs filesystem. Provides information about the kernel and devices.
- *dev*: directory for special devices, such as consoles and terminals.
- *etc*: contains configuration files.
- *tmp*: space for runtime temporary files.

I create special device nodes inside the `/dev` directory of the _minimal root filesystem_.
```bash
root@ubuntu:~/rootfs# mknod dev/console c 5 1
root@ubuntu:~/rootfs# mknod dev/null c 1 3
```
- `mknod`: command in Unix/Linux systems used to create special device nodes in the filesystem.
- `c`: character device. A special type of file that allows communication with devices that transmit data character by character, such as a keyboard, a terminal, or a console.
- `first number`: major number. Identifies the driver or type of device.
- `second number`: minor number. Identifies a specific device handled by that driver.

**Basic syntax**: `mknod [name_of_node] [type] [major_number] [minor_number]`

This is essential for the system to function properly, especially where full control over input and output is required. I will explain it with an analogy to make it more digestible:
Imagine your system is an office and the devices are special doors that allow communication with different areas.

`/dev/console` is like the main reception door, where all important information arrives and where you can communicate directly with the system. It is the primary contact point for critical messages and commands during boot.

`/dev/null` is like a magical trash can that absorbs any document you give it without anyone ever reading it. If you throw something there, it simply disappears forever.

These nodes allow the system to interact with its environment and properly handle the input and output of data essential for its operation. Without `/dev/console`, there would be no console to receive or display critical system messages; you wouldn’t be able to see or enter commands, leaving the system inaccessible via the console. Without `/dev/null`, you couldn’t redirect outputs or errors to a “sink” to discard them. This can cause some processes or scripts to fail because they expect to be able to discard data or control input and output flows correctly.

I create the `init` file without an extension, because in traditional Linux and Unix systems, the *kernel* looks for an executable named exactly `init`, located at the root of the filesystem, to start the root user process. This file sets up a functional and controlled environment that allows the minimal system to boot correctly, facilitates console interaction, and enables analysis with tools like *GDB*.
```sh
#!/bin/sh
mount -t proc none /proc # Mount the proc filesystem on /proc
mount -t sysfs none /sys # Mount the sysfs filesystem on /sys
mount -t devtmpfs none /dev # Mount devtmpfs on /dev for dynamic devices
mkdir -p /dev/pts # Create directory for pseudo-terminals
mount -t devpts none /dev/pts # Mount devpts for virtual terminal support

# Check if the standard input is a terminal
echo "Checking if stdin is a tty..."
if [ -t 0 ]; then
	echo "stdin is a tty"
else
	echo "stdin is not a tty"
fi

echo "Welcome"
exec setsid /bin/sh </dev/ttyS0 >/dev/ttyS0 2>&1 # Run interactive shell on serial console ttyS0
```

I would like to mention a few points that I consider important for a deep understanding:

- When manually creating the `/dev/pts` directory before mounting `devtmpfs` on `/dev` (which I do inside `init`), this change is lost because the mount overwrites the previous contents of `/dev`. Therefore, the **solution** I use is to create `/dev/pts` within the script, immediately after mounting `devtmpfs`; this way, there is no problem when `devpts` is mounted.

- I am using `/dev/ttyS0` instead of `/dev/console` because `/dev/ttyS0` is the serial console interface, which facilitates remote connection and precise debugging with _GDB_ or any similar tool. On the other hand, `/dev/console` is the system’s main console, which could actually work as well; however, to avoid any issues, I prefer to use the standard way to communicate with the kernel and the system without a graphical interface (remember, I am not using a graphical interface). In another article, I might use `/dev/console` to see what appears and find interesting solutions to potential issues that may exist.

- I am using `exec setsid /bin/sh` to create a new session and make the shell the session leader, improving terminal control. Redirecting to `/dev/ttyS0` ensures that all input and output are channeled through the serial console. Simply using `exec /bin/sh` can leave the shell without a proper terminal, making interaction difficult and causing errors. Let’s say that using `exec setsid /bin/sh` is more suitable for *debugging* work.

I give execution permissions to my script.
```bash
root@ubuntu:~/rootfs# chmod +x init
root@ubuntu:~/rootfs# ls -l init
-rwxr-xr-x 1 root root 610 Aug 22 17:36 init
```

I package the entire *minimal root filesystem* I’ve prepared into a single compressed file called `initramfs.cpio.gz`.
```bash
root@ubuntu:~/rootfs# find . -print0 | cpio --null -ov --format=newc | gzip -9 > ../initramfs.cpio.gz
```
- `find .`: searches for and lists all files and directories within the current directory.
- `-print0`: prints each filename separated by a null character (`\0`) instead of a newline. I do this to avoid issues with filenames that may contain spaces or unusual characters.
- `cpio`: creates an archive file from a list of received names.
- `--null`: tells `cpio` that the filenames are separated by null characters.
- `-o`: `output`. Tells `cpio` to operate in creation mode, meaning it takes the list of files it receives and creates a `.cpio` archive with them.
- `-v`: `verbose`. Displays on the screen each file being packaged. I could skip this, but since I like to see the output, I include the flag.
- `--format=newc`: I use the "newc" format, which is the standard for initramfs in Linux kernels. This format is compatible with initramfs.
- `gzip`: compresses the output from `cpio`.
- `-9`: maximum compression level to reduce the size of the resulting file.
- `> ../initramfs.cpio.gz`: I redirect the compressed output to the file `initramfs.cpio.gz`, and I save this file one level above `/rootfs`, that is, in `/root`. I do this to prevent the generated file from ending up inside the `rootfs` I am packaging, which would create an infinite packaging loop.

## Initial boot without GDB connection
I run the kernel in *QEMU* along with the generated `initramfs` and see that the system boots correctly, with the shell operational to receive and execute commands.
```bash
root@ubuntu:~/rootfs# qemu-system-x86_64 -kernel /home/az4rvs/kernels/linux-4.4.302/arch/x86/boot/bzImage -initrd /root/initramfs.cpio.gz -append "console=ttyS0 quiet nokaslr" -nographic
[    0.036393] Spectre V2 : Spectre mitigation: LFENCE not serializing, switching to generic retpoline
Checking if stdin is a tty...
stdin is a tty
Welcome
/bin/sh: can't access tty; job control turned off
~ # ls
bin      etc      linuxrc  root     sys      usr
dev      init     proc     sbin     tmp
~ # echo "Hey, it's me, az4rvs"
Hey, it's me, az4rvs
~ # uname -a
Linux (none) 4.4.302 #1 SMP Thu Aug 21 21:14:03 UTC 2025 x86_64 GNU/Linux
```
- `qemu-system-x86_64`: *QEMU* binary that emulates an x86_64 architecture (64-bit PC).
- `-kernel /home/az4rvs/kernels/linux-4.4.302/arch/x86/boot/bzImage`: directly loads the Linux kernel image in bzImage format.
- `-initrd /root/initramfs.cpio.gz`: loads the `initramfs` into memory so  that the kernel can mount it during boot.
- `console=ttyS0`: redirects the kernel console output to the first serial port, allowing me to view the boot process in the terminal when using `-nographic`.
- `quiet`: reduces the verbosity of the kernel messages. I only use it this time to get a clean output that confirms the system booted and I obtain the operational shell; in real debugging sessions, I prefer to omit it to analyze all the boot messages.
- `nokaslr`: disables *KASLR*, allowing memory addresses to remain constant between reboots. This facilitates debugging.
- `-nographic`: disables the graphical window and redirects all I/O to the serial port in the terminal. I do this because I am in a headless environment.

In the second part, we will gut the kernel. Stay sharp. See you soon.