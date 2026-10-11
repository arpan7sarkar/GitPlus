import { memo } from "react";
import { User, Bot } from "lucide-react";
import Markdown from "@/components/ui/markdown";
import CitationChip from "./CitationChip";
import type { ChatMessage as ChatMessageType, Citation } from "@/lib/mock-data";

interface ChatMessageProps {
  message: ChatMessageType;
  onCitationClick: (citation: Citation) => void;
}

const ChatMessageComponent = memo(({ message, onCitationClick }: ChatMessageProps) => {
  const isUser = message.role === "user";

  return (
    <div className={`flex min-w-0 gap-2.5 ${isUser ? "flex-row-reverse" : ""}`}>
      <div className="w-8 h-8 rounded-md bg-muted flex items-center justify-center shrink-0">
        {isUser ? <User className="h-4 w-4 text-muted-foreground" aria-hidden="true" /> : <Bot className="h-4 w-4 text-muted-foreground" aria-hidden="true" />}
        <span className="sr-only">{isUser ? "You" : "Assistant"}</span>
      </div>
      <div className={`min-w-0 max-w-[calc(100%-2.625rem)] sm:max-w-[85%] ${isUser ? "text-right" : ""}`}>
        <div className={`inline-block min-w-0 max-w-full text-left px-3 py-2.5 rounded-md text-sm leading-relaxed ${
          isUser
            ? "bg-muted border border-border text-secondary-foreground"
            : "bg-card border border-border text-secondary-foreground"
        }`}>
          <Markdown>{message.content}</Markdown>
        </div>
        {message.citations && message.citations.length > 0 && (
          <div className="flex min-w-0 flex-wrap gap-2 mt-2">
            {message.citations.map((citation, i) => (
              <CitationChip key={i} citation={citation} onClick={onCitationClick} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
});

ChatMessageComponent.displayName = "ChatMessage";

export default ChatMessageComponent;
