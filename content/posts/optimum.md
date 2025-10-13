---
title: "Optimum - HTB"
date: "2025-07-12"
views: 0

---
![Pawned](/images/HTB/Pasted_image_20250720150035.png)

Optimum is an easy difficulty Windows machine where an RCE vulnerability in HttpFileServer 2.3 is exploited to gain initial access. Once inside the machine as an unprivileged user, I use the tool Sherlock to find unpatched vulnerabilities and take advantage of one of them to escalate privileges. Through the MS16-032 vulnerability found, I manage to escalate privileges to SYSTEM.

----

## Reconnaissance

Before starting with **active reconnaissance**, I create a directory structure to keep the files and results organized.
![order](/images/HTB/Pasted_image_20250720150440.png)
```zsh
mkdir -p Optimum/{scanning,exploits,data/credentials} 
tree
```

Then I perform a **ping** to the machine's IP to confirm that there is connectivity.
![ping](/images/HTB/Pasted_image_20250720150532.png)
```zsh
ping -c 1 10.10.10.8
```
A **TTL** value of 127 suggests that the remote system is likely running Windows, as Windows systems typically use an initial TTL of 128. The observed value being one less indicates that the packet has passed through a single network hop (such as a router or intermediary device), which is common in virtualized environments or when connecting via VPN.

I perform a scan with *Nmap* to see which ports are open.
![nmap](/images/HTB/Pasted_image_20250720161458.png)
- `-p-`: scans the entire range of TCP ports (from 1 to 65535). 
- `–-open`: reports only the open ports, omitting the filtered or closed ones.
- `-sS`: Performs a stealthy SYN scan.
- `–-min-rate 5000`: Sets a minimum rate of 5000 packets per second, speeding up the scan.
- `-n`: To avoid DNS resolution. It prevents wasting time querying hostnames.
- `-Pn`: Skips the ping check. Assumes the host is up.
- `-oN`: Saves the scan output in normal format.

```zsh
nmap -p- --open -sS --min-rate 5000 -n -Pn 10.10.10.8 -oN firstScan
```

I perform a more thorough scan on the open port.
![nmap](/images/HTB/Pasted_image_20250720161827.png)
- `-p80`: specifies the port to scan. 
- `-sC`: runs Nmap's default scripts.
- `-sV`: performs version detection on the discovered services.
- `-oN`: saves the results in a readable format.

```zsh
nmap -p80 -sCV 10.10.10.8 -oN targets
```

I see what **technologies** are running in the background, but for now, nothing interesting, except for the HttpFileServer (HFS) version 2.3, which will be useful to know.
![whatweb](/images/HTB/Pasted_image_20250720155356.png)

I proceed to check the website.
![website](/images/HTB/Pasted_image_20250720155441.png)

## Exploitation

I investigate whether this version of the software (**HFS**) has any **vulnerabilities**.
![research](/images/HTB/Pasted_image_20250720155653.png)

Apparently, this version uses the **null byte** (**%00**) to bypass filters and achieve remote code execution (**RCE**). Below, I’ll explain why this is possible:

The **null byte** represents the end of a string, so the trick lies in including the null byte before the scripting block `{.exec|...}`. The **filter** only evaluates up to the null byte, since it interprets it as the end of the string. However, the **HFS** engine processes the entire input, including the malicious part placed after the null byte. This works because in some cases, the **filters** are improperly implemented.

![nullbyte](/images/HTB/Pasted_image_20250720155821.png)

I intercept the request.
![burpsuite](/images/HTB/Pasted_image_20250720160549.png)

I research the scripting engine commands of Rejetto HFS.
![research](/images/HTB/Pasted_image_20250720160536.png)

**Rejetto HttpFileServer** includes its own **scripting** mechanism, which allows internal **commands** to be executed within its system using special blocks that follow this **structure**: `{. command | argument .}`

I use the `exec` command because it allows me to **execute** instructions directly on the server’s operating system.

![research](/images/HTB/Pasted_image_20250720160948.png)

I launch the following **payload**: `%00{.exec|ping 10.10.16.5.}`. I'm trying to ping my attacker's machine. To verify whether the command executes successfully, I start listening on the `tun0` network interface, this will allow me to capture incoming **ICMP** packets, which are exactly what a **ping** generates. If I see ICMP requests coming from the victim machine, that indicates the **RCE** was successful.
![payload](/images/HTB/Pasted_image_20250720161110.png)

RCE successful.
![rce](/images/HTB/Pasted_image_20250720161130.png)

## User Access

Once the **RCE** is confirmed, I need to try to obtain an interactive **shell** that allows me to interact more comfortably with the victim machine, instead of executing individual commands through **Burp Suite**. This time, I’ll be using a script from **Nishang**, which will allow me to establish a **reverse shell** from **Windows**, that is, make the victim machine connect back to my attacker machine (where I’ll be listening with **Netcat** on port 443) via **PowerShell**.
![attack](/images/HTB/Pasted_image_20250721020037.png)

![attack](/images/HTB/Pasted_image_20250721020314.png)

I specify the **IP address** of my attacker machine and the **port** on which I’ll be **listening**.
![modify](/images/HTB/Pasted_image_20250721020515.png)

I start an **HTTP server** on my machine to serve the script.
![server](/images/HTB/Pasted_image_20250721020536.png)

I start listening before executing the command on the victim machine.
![listener](/images/HTB/Pasted_image_20250721021435.png)

I perform **URL encoding** on the malicious command I’m going to execute on the victim machine, in order to avoid issues with **special characters**. Once the request is sent, I observe that the **HTTP server** I started receives a request with a 200 status code, which indicates that the file was successfully requested and transmitted by the victim.
![burpsuite](/images/HTB/Pasted_image_20250721021340.png)

I obtain the interactive shell.
![shell](/images/HTB/Pasted_image_20250721021515.png)

## Privilege Escalation

Once I gain access as the unprivileged user _kostas_, I execute the `systeminfo` command on the victim machine. This command allows me to retrieve detailed information about the operating system.

![info](/images/HTB/Pasted_image_20250721021702.png)

![info](/images/HTB/Pasted_image_20250721021714.png)

With this information, I search for possible local **vulnerabilities** that I could **exploit** to **escalate privileges**. I’ll be using the script `Sherlock.ps1`. This script analyzes the installed **Hotfixes** and compares them against a **database** of known local Windows vulnerabilities. If any of the **patches** are not installed, `Sherlock.ps1` will **flag** them as potential privilege escalation paths, allowing me to identify available exploits to escalate from user to administrator.

If I wanted to do this **manually** instead of relying on a script, I would need to use the operating system’s name and version to search for known vulnerabilities. Then, I would need to research which KBs patch those vulnerabilities and check whether they are installed. If any of the required patches are not installed, that would indicate a potential privilege escalation vector.

I check which functions the script contains.
![functions](/images/HTB/Pasted_image_20250721022532.png)

I specify the function I will use.
![specify](/images/HTB/Pasted_image_20250721022624.png)

I download and execute the script directly in memory.

**What does it mean to download and execute the script directly in memory?**    
It means that the script is not saved to the victim machine's **hard drive**, but instead downloaded from a server and executed instantly in **RAM**, without leaving a physical file.  
Simply put, it’s like wanting to read a book, normally, you’d have to print it first (save it to disk) and then read it. But in this case, it’s as if someone reads the book aloud to me without leaving any physical copy. That way, I get all the information, but there’s no evidence that the book was ever with me.

![attack](/images/HTB/Pasted_image_20250721023031.png)

This is possible because the **HTTP server** I launched is still running, so it continues serving the files available in the `/exploits` directory.
![server](/images/HTB/Pasted_image_20250721025326.png)

I find these potential **attack vectors**. After briefly analyzing each one, I go for the first, as it seems the most promising. In these cases, if the one you choose doesn’t work, you’ll have to try the next one. However, to avoid this kind of trial and error and save time, I perform a preliminary analysis to see which one best fits the information I have and what I want to achieve.
![vectors](/images/HTB/Pasted_image_20250721023143.png)

![research](/images/HTB/Pasted_image_20250721023537.png)

I will be using the script **Invoke-MS16032.ps1**, from the **Empire** repository on GitHub. This script exploits a local vulnerability present on the victim machine, due to the system lacking the corresponding patch. This makes it a viable candidate for privilege escalation.

Once again, I will execute this script **directly in memory using PowerShell**, without writing any files to disk, which reduces the chances of being detected by antivirus or EDR solutions.

![script](/images/HTB/Pasted_image_20250721024450.png)

I take a look at the functions contained in the script.
![functions](/images/HTB/Pasted_image_20250721024939.png)

I notice that the usage example for the script contains a typo that prevents it from working. I just need to type the function name exactly as shown in the output of the previous command: `Invoke-MS16032`.
![script](/images/HTB/Pasted_image_20250721024956.png)

I add the oneliner at the end of the script. The oneliner goes at the end because the `-Command` parameter specifies which command I want to run after the **MS16032** vulnerability has been exploited. Therefore, it is accurate to state that whatever is specified in the `-Command` parameter will be executed with **SYSTEM** privileges.
![script](/images/HTB/Pasted_image_20250721025228.png)

I start listening on port 443 before downloading and executing the script `Invoke-MS16032.ps1` on the victim machine. Through this listener, I will receive the reverse shell with elevated privileges.
![listen](/images/HTB/Pasted_image_20250721030141.png)

I download and execute the `Invoke-MS16032.ps1` script directly in memory on the victim machine, in order to obtain a reverse shell as the user `NT AUTHORITY\SYSTEM`.
![execute](/images/HTB/Pasted_image_20250721030519.png)
Chicharrón!

















