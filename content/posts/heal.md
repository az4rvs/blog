---
title: "Heal - HTB"
date: "2025-07-29"
views: 0

---
![Pawned](/images/HTB/Pasted_image_20250729093152.png)
Heal is a medium difficulty Linux machine that contains two interesting subdomains: `api.heal.htb` and `take-survey.heal.htb`. Through the first one, I find a Local File Inclusion (LFI) vulnerability in the `filename` parameter, which allows me to access sensitive system files, such as configuration files containing credentials. Using the credentials obtained via LFI, I crack them and log in as *Ralph*, an administrator, to the LimeSurvey panel, where I exploit a known vulnerability to upload a malicious plugin and achieve remote code execution. After gaining a shell as the *www-data* user, I proceed to perform a lateral privilege escalation to the user *ron*. For the vertical privilege escalation, I discover that a Consul service is running as root, so I use an exploit to complete the escalation.

--------

## Reconnaissance

Before starting with **active reconnaissance**, I create a directory structure to keep the files and results organized.
![order](/images/HTB/Pasted_image_20250725131238.png)
```zsh
mkdir -p Heal/{scanning,exploits,data/credentials}
tree
```

Then I perform a **ping** to the machine's IP to confirm that there is connectivity.
![ping](/images/HTB/Pasted_image_20250725131848.png)
```zsh
ping -c 1 10.10.11.46
```
A **TTL** value of 63 suggests that the remote system is likely running Linux, as Linux systems typically use an initial TTL of 64. The observed value being one less indicates that the packet has passed through a single network hop (such as a router or intermediary device), which is common in virtualized environments or when connecting via VPN.

I perform a scan with *Nmap* to see which ports are open.
![nmap](/images/HTB/Pasted_image_20250725131938.png)
- `-p-`: scans the entire range of TCP ports (from 1 to 65535). 
- `–-open`: reports only the open ports, omitting the filtered or closed ones.
- `-sS`: Performs a stealthy SYN scan.
- `–-min-rate 5000`: Sets a minimum rate of 5000 packets per second, speeding up the scan.
- `-n`: To avoid DNS resolution. It prevents wasting time querying hostnames.
- `-Pn`: Skips the ping check. Assumes the host is up.
- `-oN`: Saves the scan output in normal format.

```zsh
nmap -p- --open -sS --min-rate 5000 -n -Pn 10.10.11.46 -oN firstScan
```

I perform a more thorough scan on the open ports.
![nmap2](/images/HTB/Pasted_image_20250725132040.png)
- `-p22,80`: specifies the ports to scan. 
- `-sC`: runs Nmap's default scripts.
- `-sV`: performs version detection on the discovered services.
- `-oN`: saves the results in a readable format.

```zsh
nmap -p22,80 -sCV 10.10.11.46 -oN targets
```

I see that the web server performs a redirection to a **domain name**, `heal.htb`, which suggests that the server is using **Name-Based Virtual Hosting**. Therefore, I proceed to edit the `/etc/hosts` and associate this domain with the **victim machine's IP**.
![hosts](/images/HTB/Pasted_image_20250725132113.png)

I see what **technologies** are running in the background, but for now, nothing interesting.
![whatweb](/images/HTB/Pasted_image_20250725132228.png)
```zsh
whatweb http://10.10.11.46
```

I proceed to check the website.
![website](/images/HTB/Pasted_image_20250725140049.png)

I intercept the request with **Burp Suite** to inspect the contents of the request.
![burpsuite1](/images/HTB/Pasted_image_20250725140114.png)
I discover a new subdomain, so I add it to `/etc/hosts` to continue with the enumeration.

At the top of the page, there's a button called **Survey** which, when clicked, redirects me to the subdomain `take-survey.heal.htb`.
![url](/images/HTB/Pasted_image_20250725161429.png)

I add this subdomain to `/etc/hosts`.
![hosts2](/images/HTB/Pasted_image_20250725161508.png)

Once the subdomain has been added to the `/etc/hosts` file so it can resolve correctly, I reload the page.
![reload](/images/HTB/Pasted_image_20250725161535.png)

Although the initial **redirection** takes me to `take-survey.heal.htb/index.php/552933?lang=en`, I manually access `take-survey.heal.htb` to inspect whether there is any relevant content in this **base path**.
![redirection](/images/HTB/Pasted_image_20250726005127.png)
And I find this potential user who is an *Administrator*. This leads me to think that there is an **admin panel** on the site where I could log in as *Ralph*.

And indeed, such an admin panel exists; however, I won’t use it for now and will continue with the enumeration.
![panel](/images/HTB/Pasted_image_20250726005347.png)

I access the subdomain `api.heal.htb`.
![newsubdomain](/images/HTB/Pasted_image_20250725161955.png)
I see the Rails framework. The versions of Rails and Ruby (the language Rails is written in) are clearly visible, which could be beneficial for finding potential exploits.

## Exploitation

When registering on LimeSurvey, I have the option to fill out my résumé and export it as a PDF. Naturally, I’m going to export it and intercept it with **Burp Suite**.
![burpsuite2](/images/HTB/Pasted_image_20250725162856.png)

I click **Forward**, which allows me to resume the flow of the request, either letting it pass as is or sending a modified version. In this case, I simply let it through just as I intercepted it, to see where it leads me.

![burpsuite3](/images/HTB/Pasted_image_20250725162909.png)

I find a manipulable parameter: `filename`.
![burpsuite4](/images/HTB/Pasted_image_20250725162923.png)

I send the request to the **Repeater** to manipulate it manually.
![burpsuite5](/images/HTB/Pasted_image_20250725164127.png)

I suspect a **Path Traversal vulnerability**, so I attempt to read a sensitive system file (`/etc/passwd`) to verify if **arbitrary file reading** is possible.
![burpsuite6](/images/HTB/Pasted_image_20250725164350.png)

For now, I identify two interesting users on the system. To view everything more clearly, I download the `/etc/passwd` file to my local machine.
![chicha](/images/HTB/Pasted_image_20250725164935.png)
- `-k`: ignore **SSL** certificate errors. This applies to domains using **HTTPS**, but since this case uses **HTTP**, it could be skipped, though it's just habit.
- `-H "Authorization: Bearer <token\>"`: add an HTTP `Authorization` header with a **JWT** (JSON Web Token).
- `-o`: save the output of the request to a file named as you specify.

```zsh
curl -k -H "Authorization: Bearer eyJhbGci0iJIUzI1NiJ9.eyJ1c2VyX2lkIjoyfQ.73dLFyR_K1A7yY9uDP6xu7H1p_c7DlFQEoN1g-LFFMQ" "http://api.heal.htb/download?filename=/etc/passwd" -o users
```

I filter for the users who have a **shell**.
![filter](/images/HTB/Pasted_image_20250725165520.png)
- `grep sh$ users`: search for lines that end with **sh** in the `users` file.
- `awk`: it allows you to read line by line and apply different types of operations.
- `-F`: it tells **awk** that the field separator is the `:` character.
- `{print $1}`: it prints the first field.
- `sponge users`: it overwrites the `users` file without losing data.

```zsh
grep sh$ users | awk -F: '{print $1}' | sponge users
```

Investigating the structure of Rails, the **database configuration** file is usually located at `config/database.yml`, so I proceed to view its contents to see if I find anything interesting.
![burpsuite7](/images/HTB/Pasted_image_20250726010354.png)

The file revealed that the application uses **SQLite** in the development environment, specifically at `storage/development.sqlite3`. This means the database is stored locally in a file, so I proceed to inspect its contents with the goal of obtaining credentials or password hashes.

![burpsuite8](/images/HTB/Pasted_image_20250726010450.png)

The file is in **SQLite format**, so I download it to my local machine to inspect it using **sqlite3**.

![format](/images/HTB/Pasted_image_20250726010718.png)
- `-k`: ignore **SSL** certificate errors. This applies to domains using **HTTPS**, but since this case uses **HTTP**, it could be skipped, though it's just habit.
- `-H "Authorization: Bearer <token\>"`: add an HTTP `Authorization` header with a **JWT** (JSON Web Token).
- `-o`: save the output of the request to a file named as you specify.

```zsh
curl -k -H "Authorization: Bearer eyJhbGci0iJIUzI1NiJ9.eyJ1c2VyX2lkIjoyfQ.73dLFyR_K1A7yY9uDP6xu7H1p_c7DlFQEoN1g-LFFMQ" "http://api.heal.htb/download?filename=../../storage/development.sqlite3" -o output
```

I use **sqlite3** to inspect the contents of the file.
![output](/images/HTB/Pasted_image_20250726010850.png)

Since I'm targeting the user *Ralph*, I save his hash with the goal of performing a **brute-force attack** on it to crack it and discover the original password.
![hash](/images/HTB/Pasted_image_20250726013530.png)

I use **John the Ripper** to crack the hash and obtain the password in plain text.
![bruteforce](/images/HTB/Pasted_image_20250726013511.png)
-  `--wordlist`: specifies the wordlist to be used for the brute-force attack.

```zsh
john --wordlist=/usr/share/wordlists/rockyou.txt hash
```

Once the password is obtained in **plain text**, I attempt to log in to the **admin panel** I had found earlier.
![panel](/images/HTB/Pasted_image_20250726013704.png)

## Initial Access

This is what I see upon logging into the page.
![page](/images/HTB/Pasted_image_20250726015842.png)

I also see the LimeSurvey version.
![version](/images/HTB/Pasted_image_20250726015857.png)

I investigate whether there is any known **exploit** for this specific version.
![research](/images/HTB/Pasted_image_20250726014023.png)

![clone](/images/HTB/Pasted_image_20250726014122.png)

I modify the `revshell.php` file with the IP address of my attacking machine and the port I’ll be listening on to receive the shell.
![modify](/images/HTB/Pasted_image_20250726024401.png)

I compress the files.
![compress](/images/HTB/Pasted_image_20250726021737.png)

I start listening on port 443.
![listening](/images/HTB/Pasted_image_20250726014733.png)

From the panel, I navigate to the Plugins section.
![plugins](/images/HTB/Pasted_image_20250726015925.png)

I install the new "plugin".
![install](/images/HTB/Pasted_image_20250726021429.png)

![install2](/images/HTB/Pasted_image_20250726021447.png)

![install3](/images/HTB/Pasted_image_20250726023437.png)

I activate the plugin.
![activate](/images/HTB/Pasted_image_20250726023408.png)

This is the path to my reverse shell.
![path](/images/HTB/Pasted_image_20250726021903.png)

I access the **path** where my **reverse shell is located** so that it executes and establishes a reverse connection with my machine, which is listening on port 443.
![url](/images/HTB/Pasted_image_20250726024534.png)

I gain access as the *www-data* user (red area).
![access](/images/HTB/Pasted_image_20250726025032.png)

Before proceeding, I perform **TTY treatment** (green area) to work comfortably.

![treatment](/images/HTB/Pasted_image_20250726025217.png)

## User Access

Once access is obtained, I navigate to the `limesurvey` directory, where the application is installed. I’m searching for possible configuration files or credentials that could allow me to continue escalating privileges.

![looking](/images/HTB/Pasted_image_20250729090208.png)

I search for files named `config.php` in the current directory and its subdirectories.

```zsh
find . | grep config.php
```

I view the contents of the file.
![view](/images/HTB/Pasted_image_20250729090340.png)

And I find a password. Since there is a possibility of **password reuse**, I try the following.

I perform an **SSH brute-force attack** against `heal.htb`, testing all the users from the `users.txt` file with the obtained password.
![bruteforce2](/images/HTB/Pasted_image_20250729090821.png)
```zsh
nxc ssh heal.htb -u users.txt -p 'AdmiDi0_pA$$w0rd'
```

Since I obtained a valid login for the user *ron*, I connect via **SSH**.
![ssh](/images/HTB/Pasted_image_20250729090913.png)

## Privilege Escalation

I list the running processes that belong to the root user.
![processes](/images/HTB/Pasted_image_20250729091156.png)
I find a program that catches my attention, it is running as root on localhost: `/usr/local/bin/consul`.

```zsh
ps aux | grep "root"
```

I investigate Consul’s default ports.
![research2](/images/HTB/Pasted_image_20250729091253.png)

I list the network connections.
![network](/images/HTB/Pasted_image_20250729204640.png)
And I come across port **8500**, which matches the default port that Consul uses to expose its **HTTP API**.

- `-t`: show TCP connections.
- `-u`: show UDP connections.
- `-l`: shows listening ports.
- `-n`: shows addresses/ports in numeric format.
- `-p`: shows the process and its PID.

```zsh
ss -tulnp
```

I make an **HTTP request** to the Consul service exposed on port 8500 to verify if it's accessible and analyze the response.
![curl](/images/HTB/Pasted_image_20250729091413.png)
```zsh
curl localhost:8500 -v
```

This confirms that the service is running locally, as it responds with an **HTTP 301** (Moved Permanently) redirecting to `/ui/`, which is typical of Consul’s web interface.

However, since the service is only accessible from **localhost**, I use **SSH port forwarding** to expose it on my local machine.

This creates an **SSH tunnel** that allows me to access port 8500 of the victim machine from my own attacking machine. This way, I can interact with Consul’s web interface from my browser.

![tunnel](/images/HTB/Pasted_image_20250729091645.png)
```zsh
ssh -L 8500:127.0.0.1:8500 ron@heal.htb
```

I open my browser and go to `http://localhost:8500`.
![browser](/images/HTB/Pasted_image_20250729091731.png)
I see the version of Consul that is running on the system.

I investigate whether this version of Consul has any known vulnerabilities.
![research](/images/HTB/Pasted_image_20250729091811.png)

The exploit allows **remote command execution** (RCE) through Consul’s API by abusing the `/v1/agent/service/register` **endpoint**. By registering a service with a malicious `check` field, I manage to obtain a reverse shell.
![exploit](/images/HTB/Pasted_image_20250729092106.png)

I obtain the necessary **ACL token** to authenticate and execute the exploit against the service.
![token](/images/HTB/Pasted_image_20250729092635.png)

I extract the token from `/var/lib/consul/checkpoint-signature` and use it to authenticate and execute the exploit.
![token](/images/HTB/Pasted_image_20250729092656.png)

I execute the exploit.
![execute](/images/HTB/Pasted_image_20250730173516.png)

I obtain the reverse shell as root.
![root](/images/HTB/Pasted_image_20250729092910.png)

![chicharron](/images/HTB/Pasted_image_20250729093046.png)
Chicharrón!

















