"use client";

import { motion, useReducedMotion } from "framer-motion";
import { cn } from "@/lib/utils";

type Props = {
  children: React.ReactNode;
  className?: string;
  delay?: number;
};

export function AnimatedCard({ children, className, delay = 0 }: Props) {
  const reduce = useReducedMotion();

  return (
    <motion.div
      initial={reduce ? false : { opacity: 0, y: 18 }}
      whileInView={reduce ? undefined : { opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-32px" }}
      transition={
        reduce
          ? { duration: 0 }
          : { duration: 0.5, delay, ease: [0.22, 1, 0.36, 1] }
      }
      whileHover={
        reduce
          ? undefined
          : {
              y: -3,
              transition: { duration: 0.28, ease: [0.22, 1, 0.36, 1] },
            }
      }
      className={cn(
        !reduce && "motion-safe:hover:shadow-2xl motion-safe:hover:shadow-black/25 motion-safe:hover:ring-1 motion-safe:hover:ring-white/[0.08]",
        className
      )}
    >
      {children}
    </motion.div>
  );
}
