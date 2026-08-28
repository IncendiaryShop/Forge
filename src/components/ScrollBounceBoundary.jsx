import { useRef } from "react";
import { useOverscrollBounce } from "../hooks/useOverscrollBounce";

/* -------------------------------------------------------------------------
   <ScrollBounceBoundary> — wraps the routed page content ONCE (in App.jsx)
   so every page gets the same subtle rubber-band motion at the true
   top/bottom of the document without any per-page wiring.

   Purely presentational/interaction — no business logic, state, or data
   handling lives here. Motion only: no color, no glow, no indicators.
------------------------------------------------------------------------- */

export function ScrollBounceBoundary({ children }) {
  const contentRef = useRef(null);

  useOverscrollBounce({ contentRef });

  return (
    <div ref={contentRef} className="forge-bounce-content">
      {children}
    </div>
  );
}