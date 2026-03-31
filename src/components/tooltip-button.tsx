import {useEffect, useRef, useState, type ButtonHTMLAttributes, type ReactNode} from "react";
import {createPortal} from "react-dom";

interface TooltipButtonProps extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, "title"> {
    children: ReactNode;
    tooltip?: string;
}

interface TooltipPosition {
    left: number;
    top: number;
}

function getTooltipPosition(element: HTMLElement): TooltipPosition {
    const rect = element.getBoundingClientRect();
    return {
        left: rect.left + (rect.width / 2),
        top: rect.top - 10
    };
}

export function TooltipButton({
    children,
    tooltip,
    className,
    onClick,
    onBlur,
    onFocus,
    onPointerDown,
    onMouseEnter,
    onMouseLeave,
    ...props
}: TooltipButtonProps) {
    const buttonRef = useRef<HTMLButtonElement | null>(null);
    const [isTooltipVisible, setIsTooltipVisible] = useState(false);
    const [isTooltipDismissed, setIsTooltipDismissed] = useState(false);
    const [tooltipPosition, setTooltipPosition] = useState<TooltipPosition | null>(null);

    const updateTooltipPosition = () => {
        if (!buttonRef.current) {
            return;
        }

        setTooltipPosition(getTooltipPosition(buttonRef.current));
    };

    useEffect(() => {
        if (!isTooltipVisible || !tooltip) {
            return;
        }

        updateTooltipPosition();
        const handleViewportChange = () => updateTooltipPosition();
        window.addEventListener("scroll", handleViewportChange, true);
        window.addEventListener("resize", handleViewportChange);

        return () => {
            window.removeEventListener("scroll", handleViewportChange, true);
            window.removeEventListener("resize", handleViewportChange);
        };
    }, [isTooltipVisible, tooltip]);

    return (
        <>
            <button
                {...props}
                ref={buttonRef}
                className={className}
                onPointerDown={(event) => {
                    setIsTooltipVisible(false);
                    setIsTooltipDismissed(true);
                    onPointerDown?.(event);
                }}
                onClick={(event) => {
                    setIsTooltipVisible(false);
                    setIsTooltipDismissed(true);
                    event.currentTarget.blur();
                    onClick?.(event);
                }}
                onBlur={(event) => {
                    setIsTooltipVisible(false);
                    setIsTooltipDismissed(false);
                    onBlur?.(event);
                }}
                onFocus={(event) => {
                    if (
                        tooltip
                        && !isTooltipDismissed
                        && event.currentTarget.matches(":focus-visible")
                    ) {
                        updateTooltipPosition();
                        setIsTooltipVisible(true);
                    }

                    onFocus?.(event);
                }}
                onMouseEnter={(event) => {
                    if (tooltip && !isTooltipDismissed) {
                        updateTooltipPosition();
                        setIsTooltipVisible(true);
                    }

                    onMouseEnter?.(event);
                }}
                onMouseLeave={(event) => {
                    setIsTooltipVisible(false);
                    setIsTooltipDismissed(false);
                    onMouseLeave?.(event);
                }}
            >
                {children}
            </button>
            {tooltip && isTooltipVisible && tooltipPosition
                ? createPortal(
                    <div
                        className="metta-tooltip"
                        style={{
                            left: `${tooltipPosition.left}px`,
                            top: `${tooltipPosition.top}px`
                        }}
                    >
                        {tooltip}
                    </div>,
                    document.body
                )
                : null}
        </>
    );
}
