---
title: "SpookyPass"
date: "2025-07-19"
views: 0

---
![Pawned](/images/reversing/Pasted_image_20250719031739.png)

This challenge consists of obtaining the password required to execute the `pass` binary. In this analysis, I prioritized precision and efficiency, which is why I used a basic (yet sometimes very powerful) static analysis technique: the use of the `strings` command to extract information directly from the binary. It is worth mentioning that there are multiple alternative approaches to solve it, using tools such as **Ghidra**, **radare2**, or **ltrace**.

----

I use the `file` command to obtain information about the binary, such as its architecture, linking type, and whether or not it has been _stripped_.
![file](/images/reversing/Pasted_image_20250719030744.png)
I see that it is a 64-bit ELF binary and that it is **not stripped**. This means I can see function and variable names, which makes the analysis easier.

I run the script and enter a random password to observe the behavior of the binary.
![script](/images/reversing/Pasted_image_20250719031129.png)

I run a `strings` command to extract the **printable** text strings.
![strings](/images/reversing/Pasted_image_20250719031342.png)
And I see a string that catches my attention, which appears right after "password".

I enter the string I found.
![Pawned](/images/reversing/Pasted_image_20250719031656.png)
Salsa!


