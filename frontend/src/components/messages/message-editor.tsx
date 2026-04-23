"use client";

import { useState, useMemo } from "react";
import {
  Bold,
  Italic,
  Link,
  List,
  Eye,
  Pencil,
  ChevronDown,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface MessageEditorProps {
  subject: string;
  body: string;
  onSubjectChange: (value: string) => void;
  onBodyChange: (value: string) => void;
  readOnly?: boolean;
}

const VARIABLES = [
  { label: "Contact Name", value: "{{contact_name}}" },
  { label: "Company Name", value: "{{company_name}}" },
  { label: "Title", value: "{{title}}" },
  { label: "First Name", value: "{{first_name}}" },
  { label: "Last Name", value: "{{last_name}}" },
];

export function MessageEditor({
  subject,
  body,
  onSubjectChange,
  onBodyChange,
  readOnly = false,
}: MessageEditorProps) {
  const [isPreview, setIsPreview] = useState(false);
  const [showVariables, setShowVariables] = useState(false);

  const wordCount = useMemo(() => {
    const words = body.trim().split(/\s+/).filter(Boolean);
    return words.length;
  }, [body]);

  const charCount = body.length;

  const insertFormatting = (prefix: string, suffix: string) => {
    const textarea = document.querySelector(
      "[data-message-body]"
    ) as HTMLTextAreaElement | null;
    if (!textarea) return;

    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const selectedText = body.substring(start, end);
    const newText =
      body.substring(0, start) +
      prefix +
      (selectedText || "text") +
      suffix +
      body.substring(end);
    onBodyChange(newText);

    requestAnimationFrame(() => {
      textarea.focus();
      const newCursorPos = start + prefix.length + (selectedText || "text").length;
      textarea.setSelectionRange(newCursorPos, newCursorPos);
    });
  };

  const insertVariable = (variable: string) => {
    const textarea = document.querySelector(
      "[data-message-body]"
    ) as HTMLTextAreaElement | null;
    if (!textarea) {
      onBodyChange(body + variable);
      setShowVariables(false);
      return;
    }

    const start = textarea.selectionStart;
    const newText = body.substring(0, start) + variable + body.substring(start);
    onBodyChange(newText);
    setShowVariables(false);

    requestAnimationFrame(() => {
      textarea.focus();
      const newPos = start + variable.length;
      textarea.setSelectionRange(newPos, newPos);
    });
  };

  const renderPreview = (text: string) => {
    return text
      .replace(/\*\*(.*?)\*\*/g, "<strong>$1</strong>")
      .replace(/\*(.*?)\*/g, "<em>$1</em>")
      .replace(
        /\[([^\]]+)\]\(([^)]+)\)/g,
        '<a href="$2" class="text-primary-600 underline">$1</a>'
      )
      .replace(/^- (.+)$/gm, "<li>$1</li>")
      .replace(/(<li>[\s\S]*<\/li>)/g, "<ul class='list-disc pl-5 my-1'>$1</ul>");
  };

  return (
    <div className="space-y-4">
      {/* Subject */}
      <div>
        <label className="mb-1.5 block text-xs font-medium text-gray-600">
          Subject
        </label>
        {readOnly ? (
          <p className="text-lg font-semibold text-gray-900">{subject}</p>
        ) : (
          <input
            type="text"
            value={subject}
            onChange={(e) => onSubjectChange(e.target.value)}
            placeholder="Enter email subject..."
            className="w-full rounded-lg border border-gray-300 bg-white px-4 py-3 text-base font-semibold text-gray-900 placeholder:text-gray-400 transition-colors focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-500/20"
          />
        )}
      </div>

      {/* Toolbar */}
      {!readOnly && (
        <div className="flex items-center justify-between rounded-t-lg border border-b-0 border-gray-300 bg-gray-50 px-3 py-2">
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={() => insertFormatting("**", "**")}
              className="rounded p-1.5 text-gray-500 transition-colors hover:bg-gray-200 hover:text-gray-700"
              title="Bold"
            >
              <Bold className="h-4 w-4" />
            </button>
            <button
              type="button"
              onClick={() => insertFormatting("*", "*")}
              className="rounded p-1.5 text-gray-500 transition-colors hover:bg-gray-200 hover:text-gray-700"
              title="Italic"
            >
              <Italic className="h-4 w-4" />
            </button>
            <button
              type="button"
              onClick={() => insertFormatting("[", "](url)")}
              className="rounded p-1.5 text-gray-500 transition-colors hover:bg-gray-200 hover:text-gray-700"
              title="Link"
            >
              <Link className="h-4 w-4" />
            </button>
            <button
              type="button"
              onClick={() => {
                onBodyChange(body + "\n- ");
              }}
              className="rounded p-1.5 text-gray-500 transition-colors hover:bg-gray-200 hover:text-gray-700"
              title="Bullet List"
            >
              <List className="h-4 w-4" />
            </button>

            <div className="mx-2 h-5 w-px bg-gray-300" />

            {/* Variable Insertion */}
            <div className="relative">
              <button
                type="button"
                onClick={() => setShowVariables(!showVariables)}
                className="inline-flex items-center gap-1 rounded px-2 py-1.5 text-xs font-medium text-gray-500 transition-colors hover:bg-gray-200 hover:text-gray-700"
              >
                Insert Variable
                <ChevronDown className="h-3 w-3" />
              </button>
              {showVariables && (
                <div className="absolute left-0 z-20 mt-1 w-48 rounded-lg border border-gray-200 bg-white py-1 shadow-lg">
                  {VARIABLES.map((v) => (
                    <button
                      key={v.value}
                      onClick={() => insertVariable(v.value)}
                      className="flex w-full items-center justify-between px-3 py-2 text-left text-sm text-gray-700 hover:bg-gray-50"
                    >
                      <span>{v.label}</span>
                      <code className="text-xs text-gray-400">{v.value}</code>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setIsPreview(false)}
              className={cn(
                "inline-flex items-center gap-1 rounded px-2 py-1 text-xs font-medium transition-colors",
                !isPreview
                  ? "bg-white text-gray-900 shadow-sm"
                  : "text-gray-500 hover:text-gray-700"
              )}
            >
              <Pencil className="h-3 w-3" />
              Edit
            </button>
            <button
              type="button"
              onClick={() => setIsPreview(true)}
              className={cn(
                "inline-flex items-center gap-1 rounded px-2 py-1 text-xs font-medium transition-colors",
                isPreview
                  ? "bg-white text-gray-900 shadow-sm"
                  : "text-gray-500 hover:text-gray-700"
              )}
            >
              <Eye className="h-3 w-3" />
              Preview
            </button>
          </div>
        </div>
      )}

      {/* Body */}
      {readOnly ? (
        <div className="whitespace-pre-wrap rounded-lg border border-gray-200 bg-gray-50 px-4 py-3 text-sm leading-relaxed text-gray-800">
          {body}
        </div>
      ) : isPreview ? (
        <div
          className="min-h-[300px] rounded-b-lg border border-gray-300 bg-white px-4 py-3 text-sm leading-relaxed text-gray-800"
          dangerouslySetInnerHTML={{ __html: renderPreview(body) }}
        />
      ) : (
        <textarea
          data-message-body=""
          value={body}
          onChange={(e) => onBodyChange(e.target.value)}
          placeholder="Write your email message..."
          rows={14}
          className={cn(
            "min-h-[300px] w-full resize-y bg-white px-4 py-3 text-sm leading-relaxed text-gray-900 placeholder:text-gray-400 transition-colors focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-500/20",
            "rounded-b-lg border border-gray-300"
          )}
        />
      )}

      {/* Footer stats */}
      <div className="flex items-center justify-between text-xs text-gray-400">
        <span>{wordCount} words</span>
        <span>{charCount} characters</span>
      </div>
    </div>
  );
}
