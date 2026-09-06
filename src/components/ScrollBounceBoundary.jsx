import { useRef } from "react";
import { useOverscrollBounce } from "../hooks/useOverscrollBounce";

export function ScrollBounceBoundary({ children }) {
  const contentRef = useRef(null);

  useOverscrollBounce({ contentRef });

  return (
    <div ref={contentRef} className="forge-bounce-content">
      {children}
    </div>
  );
}
