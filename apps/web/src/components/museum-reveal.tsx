"use client";

import { useEffect, type ReactNode } from "react";
import { useAnimate, useInView, useReducedMotion } from "motion/react";

/** Visible server HTML; Motion only enhances the first encounter with a passage. */
export default function MuseumReveal({ children, className }: { children: ReactNode; className?: string }) {
  const [scope, animate] = useAnimate<HTMLDivElement>();
  const inView = useInView(scope, { once: true, amount: 0.15 });
  const reduced = useReducedMotion();

  useEffect(() => {
    if (!inView || reduced !== false) return;
    const controls = animate(scope.current, {
      opacity: [0, 1], transform: ["translateY(18px)", "translateY(0px)"],
    }, { duration: 0.5, ease: [0.23, 1, 0.32, 1] });
    const element = scope.current;
    return () => {
      controls.stop();
      // A preference change during the reveal must leave the full text readable.
      element.style.opacity = "1";
      element.style.transform = "none";
    };
  }, [animate, inView, reduced, scope]);

  return <div ref={scope} className={className}>{children}</div>;
}
