---
title: "Quantum Scrambler"
date: "2025-07-21"

---
![Resolved](/images/reversing/Pasted_image_20250725125300.png)

The **source code** of a program that encodes any input provided to it is given to me. When I open a TCP connection to port 63779 on the `verbal-sleep.picoctf.net` server, I receive the **encoded flag**. To understand the encoding, I create a test file and pass it through the program, which allows me to identify certain patterns in the encoded text. Then, I write a Python script that extracts the first and last index of each sublist within the encoded structure. Finally, I use this logic to decode and recover the flag.

-------

I open a **TCP connection** to port 63779 of the `server verbal-sleep.picoctf.net` to obtain the **encoded flag**.
![nc](/images/reversing/Pasted_image_20250725121903.png)

**Source code** of the program responsible for **encoding** the flag.
![code](/images/reversing/Pasted_image_20250725122007.png)

I create a **test file** to detect possible **patterns** in the **encoding** that I may take advantage of.
![patterns](/images/reversing/Pasted_image_20250725122316.png)
Apparently, the encoded characters always correspond to the first and last values of each sublist.

I create a Python script that captures the first and last values of each sublist in order to decode.
![decode](/images/reversing/Pasted_image_20250725125037.png)

I decode the flag.
![flag](/images/reversing/Pasted_image_20250725125224.png)
Salsa!
