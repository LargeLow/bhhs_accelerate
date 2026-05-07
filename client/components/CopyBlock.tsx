import { useState } from 'react';

interface Props {
  label: string;
  text: string;
}

export default function CopyBlock({ label, text: initialText }: Props) {
  const [copied, setCopied] = useState(false);
  const [editing, setEditing] = useState(false);
  const [text, setText] = useState(initialText);

  async function handleCopy() {
    await navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <div className="copy-block group">
      <div className="flex items-center justify-between mb-2">
        <p className="text-xs font-semibold uppercase tracking-wider text-gray-400">{label}</p>
        <div className="flex items-center gap-3">
          <button
            onClick={() => setEditing((e) => !e)}
            className="text-xs text-gray-400 hover:text-gray-600 font-medium transition-colors"
          >
            {editing ? 'Done' : 'Edit'}
          </button>
          <button
            onClick={handleCopy}
            className="text-xs text-bhhs-maroon hover:text-bhhs-dark font-medium transition-colors"
          >
            {copied ? 'Copied!' : 'Copy'}
          </button>
        </div>
      </div>
      {editing ? (
        <textarea
          className="w-full text-sm text-gray-800 leading-relaxed border border-gray-300 rounded p-2 focus:outline-none focus:ring-1 focus:ring-bhhs-maroon resize-y"
          rows={Math.max(4, text.split('\n').length + 1)}
          value={text}
          onChange={(e) => setText(e.target.value)}
          autoFocus
        />
      ) : (
        <p className="text-sm text-gray-800 leading-relaxed whitespace-pre-wrap">{text}</p>
      )}
    </div>
  );
}
