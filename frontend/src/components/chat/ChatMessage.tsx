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
    <div className={`flex gap-2.5 ${isUser ? "flex-row-reverse" : ""}`}>
      <div className={`w-6 h-6 rounded flex items-center justify-center shrink-0 ${
        isUser ? "bg-muted" : "bg-primary/10"
      }`}>
        {isUser ? <User className="h-3 w-3 text-muted-foreground" /> : <Bot className="h-3 w-3 text-primary" />}
      </div>
      <div className={`max-w-[85%] ${isUser ? "text-right" : ""}`}>
        <div className={`inline-block text-left px-3 py-2.5 rounded text-sm leading-relaxed ${
          isUser
            ? "bg-primary/8 border border-primary/15 text-foreground"
            : "bg-card border border-border text-secondary-foreground"
        }`}>
          <Markdown>{message.content}</Markdown>
        </div>
        {message.citations && message.citations.length > 0 && (
          <div className="flex flex-wrap gap-1 mt-1.5">
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
