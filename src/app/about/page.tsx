import Image from "next/image";
import { Code, Shield, Terminal, Network, Cpu, Cloud, Lock, Zap, Binary, GitBranch } from "lucide-react";

export const metadata = {
  title: "About — José Melgarejo",
};

export default function AboutPage() {
  return (
    <main>
      <div className="max-w-2xl mx-auto px-6 -mt-10">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-10 items-start">
          <section className="lg:col-span-2">
            <h2 className="text-2xl md:text-3xl font-semibold text-gray-100 mb-3">
              Who are you, really?
            </h2>

            <p className="text-gray-300 mb-6 leading-relaxed text-lg">
Hello, person behind the screen. Sometimes known as az4rvs, but my friends call me Melgarejo. For as long as I can remember, I've been obsessed with the hidden, the secret and that's exactly the kind of thing I try to share here. When I'm not tracing something back to its origin or essence, I'm drifting in the limbo. I hope you enjoy these readings. Be safe, stranger!
            </p>

            <h3 className="text-lg font-medium text-gray-100 mb-4">
              Skills &amp; Expertise
            </h3>

            <ul className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-gray-300">
              <li className="flex items-center space-x-2">
                <Code size={18} className="text-purple-400" />
                <span>Python &amp; C</span>
              </li>
              <li className="flex items-center space-x-2">
                <Binary size={18} className="text-purple-400" />
                <span>Reverse Engineering</span>
              </li>
              <li className="flex items-center space-x-2">
                <Shield size={18} className="text-purple-400" />
                <span>Malware Analysis</span>
              </li>
              <li className="flex items-center space-x-2">
                <Lock size={18} className="text-purple-400" />
                <span>Privilege Escalation (Win/Linux)</span>
              </li>
              <li className="flex items-center space-x-2">
                <Cpu size={18} className="text-purple-400" />
                <span>Kernel Debugging &amp; Exploitation</span>
              </li>
              <li className="flex items-center space-x-2">
                <Terminal size={18} className="text-purple-400" />
                <span>Scripting (Bash, PowerShell)</span>
              </li>
              <li className="flex items-center space-x-2">
                <Zap size={18} className="text-purple-400" />
                <span>Red Teaming</span>
              </li>
              <li className="flex items-center space-x-2">
                <Cloud size={18} className="text-purple-400" />
                <span>AWS &amp; Infrastructure</span>
              </li>
              <li className="flex items-center space-x-2">
                <Network size={18} className="text-purple-400" />
                <span>Advanced Networking</span>
              </li>
              <li className="flex items-center space-x-2">
                <GitBranch size={18} className="text-purple-400" />
                <span>System Configuration</span>
              </li>
            </ul>
          </section>

          <aside className="flex justify-center lg:justify-end lg:items-start">
            <div className="w-48 h-48 relative rounded-full overflow-hidden">
              <Image
                src="/images/me.jpg"
                alt="Photo of José Melgarejo"
                fill
                sizes="(max-width: 768px) 192px, 192px"
                style={{
                    objectFit: "cover",
                    objectPosition: "center",
                    borderRadius: "50%"
                }}
                priority
                />
            </div>
          </aside>
        </div>
      </div>
    </main>
  );
}
