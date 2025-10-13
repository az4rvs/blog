import React from 'react';
import Link from 'next/link';

interface Certificate {
  title: string;
  pdf: string;
  thumbnail: string;
}

const certificates: Certificate[] = [
  {
    title: 'Certificate 1',
    pdf: 'https://drive.google.com/file/d/1fgi_Khr4UTDYwOrtSgv_0zs_4QJUJMhK/preview',
    thumbnail: '/certifications/certificate1-thumbnail.png',
  },
  {
    title: 'Certificate 2',
    pdf: 'https://drive.google.com/file/d/1eWm4NJl7WVZAHt4S4-0Ez2qdxF5085Z9/preview',
    thumbnail: '/certifications/certificate2-thumbnail.png',
  },
  {
    title: 'Certificate 3',
    pdf: 'https://drive.google.com/file/d/10Gv7zB6JYS-w-r-YBMeYh4Ae-RS-ZBx9/preview',
    thumbnail: '/certifications/certificate3-thumbnail.png',
  },
];

export default function CertificationsPage() {
  return (
    <main className="main-content">
      <h1 className="text-3xl font-semibold text-gray-100 mb-8 text-center">Certifications</h1>

      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-6">
        {certificates.map((cert, index) => (
          <div
            key={index}
            className="border border-gray-700 rounded-lg p-4 flex flex-col items-center hover:shadow-lg transition-shadow bg-gray-900"
          >
            <img
              src={cert.thumbnail}
              alt={cert.title}
              className="w-32 h-32 object-cover mb-4 rounded"
            />
            <h2 className="font-semibold text-lg text-gray-100 mb-2 text-center">{cert.title}</h2>
            <a
              href={cert.pdf}
              target="_blank"
              rel="noopener noreferrer"
              className="text-purple-400 hover:underline"
            >
              View PDF
            </a>
          </div>
        ))}
      </div>
    </main>
  );
}