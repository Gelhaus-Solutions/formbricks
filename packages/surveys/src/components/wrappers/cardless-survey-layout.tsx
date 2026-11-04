import { type JSX } from "preact";
import { useCallback, useEffect, useMemo, useRef, useState } from "preact/hooks";
import { useTranslation } from "react-i18next";
import { type TJsWorkspaceStateSurvey } from "@formbricks/types/js";
import { TSurveyStyling } from "@formbricks/types/surveys/types";
import { TWorkspaceStyling } from "@formbricks/types/workspace";
import { ScrollToBottomButton } from "@/components/buttons/scroll-to-bottom-button";
import { ProgressBar } from "@/components/general/progress-bar";
import { getFocusChoiceForKey, markFocusChoices, prefersReducedMotion } from "@/lib/focus-layout";
import { cn } from "@/lib/utils";

interface CardlessSurveyLayoutProps {
  /** `focus` is the GForms default: one question per screen, keyboard first, with motion. */
  variant?: "cardless" | "focus";
  children: JSX.Element;
  survey: TJsWorkspaceStateSurvey;
  blockId: string;
  styling: TSurveyStyling | TWorkspaceStyling;
  showProgressBar: boolean;
  isPreviewMode: boolean;
  showCardlessPreviewLogoSlot: boolean;
  linkSurveyCardMaxWidth?: string;
}

/**
 * Full-height layout for cardless link surveys: an optional progress bar, an optional preview logo
 * slot, and a scrollable content area with top/bottom fade overlays plus a scroll-to-bottom button.
 */
export function CardlessSurveyLayout({
  variant = "cardless",
  children,
  survey,
  blockId,
  styling,
  showProgressBar,
  isPreviewMode,
  showCardlessPreviewLogoSlot,
  linkSurveyCardMaxWidth,
}: Readonly<CardlessSurveyLayoutProps>) {
  const { t } = useTranslation();
  const isFocus = variant === "focus";
  const rootRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const [isScrollAtTop, setIsScrollAtTop] = useState(true);
  const [isScrollAtBottom, setIsScrollAtBottom] = useState(false);

  const isSolidColorBackground = !styling.background?.bgType || styling.background.bgType === "color";

  const fadeColor = useMemo(() => {
    if (isSolidColorBackground && styling.background?.bg) {
      return styling.background.bg;
    }
    if (styling.background?.bgType === "color") {
      // Explicit color background without a value renders white (see MediaBackground).
      return "#ffffff";
    }

    // No background configured: the link-survey shell paints its default page
    // gray, so the fades and the scroll-to-bottom button must match it instead
    // of floating as white shapes on the gray page. The color itself lives in
    // the stylesheet (survey-ui globals) so themes/shells can override it.
    return "var(--fb-page-bg-color)";
  }, [isSolidColorBackground, styling.background?.bg, styling.background?.bgType]);

  const checkScroll = useCallback(() => {
    if (!scrollRef.current) return;
    const { scrollTop, scrollHeight, clientHeight } = scrollRef.current;
    const tolerance = 1;

    setIsScrollAtBottom(scrollTop + clientHeight >= scrollHeight - tolerance);
    setIsScrollAtTop(scrollTop <= tolerance);
  }, []);

  const scrollToBottom = useCallback(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, []);

  useEffect(() => {
    const element = scrollRef.current;
    if (!element) return;

    const handleScroll = () => {
      checkScroll();
    };

    element.addEventListener("scroll", handleScroll);
    checkScroll();

    return () => {
      element.removeEventListener("scroll", handleScroll);
    };
  }, [checkScroll]);

  // A new card opens at its top. In cardless mode this area is what scrolls, so the reset Survey
  // applies to its own content box never reaches it. Then re-check, since the content height changed.
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = 0;
    }
    checkScroll();
  }, [blockId, checkScroll]);

  // Position of the current screen: -1 for the welcome card, the block index, or past the last block for
  // an ending, so the entrance motion knows which way the respondent is moving.
  const blockPosition = useMemo(() => {
    if (blockId === "start") return -1;
    const index = survey.blocks.findIndex((block) => block.id === blockId);
    return index === -1 ? survey.blocks.length : index;
  }, [blockId, survey.blocks]);
  const currentBlock = blockPosition >= 0 ? survey.blocks[blockPosition] : undefined;
  const isQuestionScreen = currentBlock !== undefined;
  const previousPositionRef = useRef(blockPosition);

  // Focus: each new screen rises into place, or drops in when the respondent goes back. The Web
  // Animations API animates the existing node, so nothing below remounts and no survey state is lost.
  useEffect(() => {
    const previousPosition = previousPositionRef.current;
    previousPositionRef.current = blockPosition;
    const content = contentRef.current;
    if (
      !isFocus ||
      !content ||
      previousPosition === blockPosition ||
      prefersReducedMotion() ||
      typeof content.animate !== "function"
    ) {
      return;
    }
    const offset = blockPosition < previousPosition ? "-28px" : "28px";
    content.animate(
      [
        { opacity: 0, transform: `translateY(${offset})` },
        { opacity: 1, transform: "translateY(0)" },
      ],
      { duration: 460, easing: "cubic-bezier(0.2, 0.8, 0.2, 1)" }
    );
  }, [blockPosition, isFocus]);

  // Focus: give every list choice its letter (A, B, C...), again whenever the screen's markup changes.
  useEffect(() => {
    const content = contentRef.current;
    if (!isFocus || !content) return;
    markFocusChoices(content);
    if (typeof MutationObserver === "undefined") return;
    const observer = new MutationObserver(() => {
      markFocusChoices(content);
    });
    observer.observe(content, { childList: true, subtree: true });
    return () => {
      observer.disconnect();
    };
  }, [blockId, isFocus]);

  // Focus: a letter picks its choice, Enter moves on. A live link survey owns the page, so it listens on
  // the document; an editor preview listens on its own box only, so typing elsewhere in the editor
  // never answers the preview.
  useEffect(() => {
    if (!isFocus) return;
    const target: HTMLElement | Document | null = isPreviewMode ? rootRef.current : document;
    if (!target) return;
    const handleKeyDown = (event: Event) => {
      const keyEvent = event as KeyboardEvent;
      const content = contentRef.current;
      if (!content || keyEvent.altKey || keyEvent.ctrlKey || keyEvent.metaKey) return;
      const origin = keyEvent.target instanceof HTMLElement ? keyEvent.target : null;
      const isChoiceControl =
        origin?.tagName === "INPUT" && ["radio", "checkbox"].includes((origin as HTMLInputElement).type);
      // The choice list's own keyboard handling claims Enter on a focused choice; Focus still moves on.
      if (keyEvent.defaultPrevented && !(keyEvent.key === "Enter" && isChoiceControl)) return;
      const isTyping =
        origin !== null &&
        (origin.isContentEditable ||
          origin.tagName === "TEXTAREA" ||
          origin.tagName === "SELECT" ||
          (origin.tagName === "INPUT" && !isChoiceControl));
      if (keyEvent.key === "Enter") {
        if (isTyping || origin?.tagName === "BUTTON" || origin?.tagName === "A") return;
        const next = content.querySelector<HTMLButtonElement>('[data-fb-part="button-primary"]');
        if (next && !next.disabled) {
          keyEvent.preventDefault();
          // On the next tick, so a choice the same Enter just picked is in the answer before it is sent.
          setTimeout(() => {
            next.click();
          }, 0);
        }
        return;
      }
      if (isTyping) return;
      const choice = getFocusChoiceForKey(content, keyEvent.key, origin);
      if (!choice) return;
      keyEvent.preventDefault();
      const input = choice.querySelector<HTMLInputElement>('input[type="radio"], input[type="checkbox"]');
      if (input && !input.disabled) {
        input.click();
        input.focus();
      }
    };
    target.addEventListener("keydown", handleKeyDown);
    return () => {
      target.removeEventListener("keydown", handleKeyDown);
    };
  }, [isFocus, isPreviewMode]);

  const clickInContent = useCallback((selector: string) => {
    const button = contentRef.current?.querySelector<HTMLButtonElement>(selector);
    if (button && !button.disabled) button.click();
  }, []);

  // The welcome card has no progress yet; a 0% bar reads as a stray band, so hide it on the welcome card.
  const showProgressBarRow = showProgressBar && blockId !== "start";
  const cardMaxWidthStyle = linkSurveyCardMaxWidth ? { maxWidth: linkSurveyCardMaxWidth } : undefined;

  const focusStyle = isFocus
    ? ({
        "--fb-focus-enter-hint": JSON.stringify(t("common.press_enter")),
      } as JSX.CSSProperties)
    : undefined;

  return (
    <div
      ref={rootRef}
      className={cn("flex h-full min-h-0 w-full flex-1 flex-col", isFocus && "fb-focus")}
      style={focusStyle}>
      {showProgressBarRow ? (
        <div className="cardless-progress-bar z-[100] w-full shrink-0">
          <ProgressBar survey={survey} blockId={blockId} />
        </div>
      ) : null}
      {showCardlessPreviewLogoSlot ? (
        <div
          id="formbricks-cardless-preview-logo-slot"
          className="mx-auto w-full shrink-0 px-4 pb-2 pt-5 sm:px-6 sm:pt-6"
          style={cardMaxWidthStyle}
        />
      ) : null}
      <div className="relative min-h-0 flex-1">
        {isSolidColorBackground && !isScrollAtTop && (
          <div
            className="pointer-events-none absolute left-0 right-0 top-0 z-10 h-4"
            style={{ background: `linear-gradient(to bottom, ${fadeColor}, transparent)` }}
          />
        )}
        <div ref={scrollRef} className={cn("h-full min-h-0 overflow-y-auto", isFocus && "flex flex-col")}>
          <div
            className={cn(
              // Extra bottom padding keeps the last card clear of the floating scroll-to-bottom button.
              "mx-auto flex w-full flex-col items-center px-4 pb-14 sm:px-6",
              showCardlessPreviewLogoSlot ? "pt-6" : "pt-10 sm:pt-12",
              // Focus centres the screen in the viewport and leaves room for the navigation below.
              isFocus && "my-auto pb-24 sm:px-10"
            )}
            style={cardMaxWidthStyle}>
            <div ref={contentRef} className={cn("w-full", isFocus && "fb-focus-content")}>
              {children}
            </div>
          </div>
        </div>
        {!isScrollAtBottom && (
          <>
            {isSolidColorBackground && (
              <div
                className="pointer-events-none absolute bottom-0 left-4 right-4 z-10 h-10"
                style={{ background: `linear-gradient(to top, ${fadeColor}, transparent)` }}
              />
            )}
            {/* Focus keeps the bottom-right corner for its step arrows. */}
            {isFocus ? null : <ScrollToBottomButton onClick={scrollToBottom} />}
          </>
        )}
        {isFocus && isQuestionScreen ? (
          <div className="fb-focus-nav">
            <button
              type="button"
              aria-label={t("common.back")}
              disabled={blockPosition === 0 || survey.isBackButtonHidden}
              onClick={() => {
                clickInContent('[data-fb-part="button-back"]');
              }}>
              <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4">
                <path d="M6 15l6-6 6 6" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </button>
            <button
              type="button"
              aria-label={t("common.next")}
              onClick={() => {
                clickInContent('[data-fb-part="button-primary"]');
              }}>
              <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4">
                <path d="M6 9l6 6 6-6" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </button>
          </div>
        ) : null}
      </div>
    </div>
  );
}
