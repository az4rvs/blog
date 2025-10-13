---
title: "Bbbloat"
date: "2025-07-20"
views: 0

---
![Resolved](/images/reversing/Pasted_image_20250721033445.png)

This **reversing** challenge features a numeric validation. When executing the **binary**, the program asks me to enter a "favorite" number. The value I input is stored in a variable (`local_48`), which is then compared against an embedded **constant** (*0x86187*). If the entered value matches the decimal equivalent of that constant, the program continues its execution without issue; otherwise, it displays an error message and exits. What I did was perform a static analysis with Ghidra and search for the string *"What's my favorite number?"*, since I knew that this string would lead me to the **function** where all the **logic** was located.

--------

I download the binary.
![binary](/images/reversing/Pasted_image_20250720120958.png)
When running the `file` command on the binary, two characteristics caught my attention:
- It’s an **executable**, so I will grant it execution permissions.
- It’s **stripped**, which means I’ll go for a deeper analysis directly with **Ghidra**, this time I won’t use basic tools.

I run the binary to analyze its behavior.
![run](/images/reversing/Pasted_image_20250720125138.png)

I analyze the binary with Ghidra.
![ghidra](/images/reversing/Pasted_image_20250720124000.png)
I search for the string that appears when running the binary: "What's my favorite number?"

By double-clicking, Ghidra takes me to the **memory address** of the function that uses the string.
![address](/images/reversing/Pasted_image_20250720124812.png)
I see that the string has a cross-reference (XREF), which indicates that the string is used within the function `FUN_00101307`, specifically at address `0x001013cb`.

When decompiling the function `FUN_00101307`, a **conditional** caught my attention, it performs certain operations. The condition compares the contents of the variable `local_48` (which apparently stores the value I input via keyboard) with a constant hexadecimal value (*0x86187*). This value seems to be the one I’m looking for, since, if the condition is met, the execution flow continues and a series of instructions are executed; otherwise, the message *"Sorry, that's not it!"* is displayed, as seen in the console output. On the left side, you can see the assembly instruction responsible for this comparison: **CMP**.
![decompile](/images/reversing/Pasted_image_20250720125039.png)

I convert the value to **decimal**.
![decimal](/images/reversing/Pasted_image_20250720125148.png)

I try with the value obtained.
![value](/images/reversing/Pasted_image_20250720125206.png)
Salsa!
