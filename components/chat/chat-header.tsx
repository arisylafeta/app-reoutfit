import { TooltipIconButton } from "../ui/tooltip-icon-button";
import { PanelRightOpen, PanelRightClose, Plus } from "lucide-react";
import Image from "next/image";
import { PrivacyToggle } from "./privacy-toggle";
import { StudioToggle } from "@/components/artifact/studio/studio-toggle";
import { CreditBadge } from "@/components/credits/credit-badge";

export function ChatHeader(props: {
  chatStarted: boolean;
  isOverlayLayout: boolean;
  isLargeScreen: boolean;
  chatHistoryOpen: boolean;
  onToggleSidebar: () => void;
  onNewThread: () => void;
  threadId?: string;
  isPublic?: boolean;
  onPrivacyChange?: () => void;
  opened?: boolean;
}) {
  const {
    chatStarted: _chatStarted,
    isOverlayLayout,
    isLargeScreen: _isLargeScreen,
    chatHistoryOpen,
    onToggleSidebar,
    onNewThread,
    threadId,
    isPublic,
    onPrivacyChange,
  } = props;
  const opened = props.opened ?? false;

  if (isOverlayLayout) return null;

  return (
    <header className="sticky top-0 z-10 flex items-center gap-2 bg-background px-2 py-1.5 md:px-2">
      {/* Left: Buttons (sidebar toggle first with border, then New Chat) */}
      <div className="flex items-center gap-2">
        {!opened && (
          <TooltipIconButton
            tooltip="Toggle sidebar"
            aria-label="Toggle sidebar"
            onClick={onToggleSidebar}
            variant="outline"
          >
            {chatHistoryOpen ? (
              <PanelRightOpen className="size-5" />
            ) : (
              <PanelRightClose className="size-5" />
            )}
          </TooltipIconButton>
        )}

          <TooltipIconButton
            tooltip="New Chat"
            aria-label="New Chat"
            onClick={onNewThread}
            variant="outline"
          >
            <Plus className="size-5" />
          </TooltipIconButton>


        {/* Privacy Toggle - only show if thread exists */}
        {threadId && (
          <PrivacyToggle
            threadId={threadId}
            isPublic={isPublic ?? false}
            onUpdate={onPrivacyChange}
          />
        )}
      </div>

      {/* Right: Credits Badge, Studio Button and Wordmark */}
      <div className="ml-auto flex items-center gap-2">
        {/* Credits Badge - show for all authenticated users */}
        <CreditBadge />

        {/* Studio Button - only show if thread exists */}
        {threadId && (
          <StudioToggle />
        )}

        {/* Logo */}
        {!opened && (
          <Image
            src="/logo.png"
            alt="Reoutfit"
            width={36}
            height={36}
          />
        )}
      </div>
    </header>
  );
}
