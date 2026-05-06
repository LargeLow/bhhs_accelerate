import { useState } from 'react';

interface Props {
  label: string;
  text: string;
}

export default function CopyBlock({ label, text }: Props) {
  const [copied, setCopied] = useState(false);

  async function handleCopy() {
    await navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <div className="copy-block group">
      <div className="flex items-center justify-between mb-2">
        <p className="text-xs font-semibold uppercase tracking-wider text-gray-400">{label}</p>
        <button
          onClick={handleCopy}
          className="text-xs text-bhhs-maroon hover:text-bhhs-dark font-medium transition-colors"
        >
          {copied ? 'Copied!' : 'Copy'}
        </button>
      </div>
      <p className="text-sm text-gray-800 leading-relaxed whitespace-pre-wrap">{text}</p>
    </div>
  );
}
