"use client";
import { motion, useReducedMotion } from "framer-motion";
interface RevealProps { children: React.ReactNode; className?: string }
export function Reveal({ children, className }: RevealProps) {
  const reduced = useReducedMotion();
  return <motion.div className={className} initial={{ opacity: 0, y: reduced ? 0 : 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3 }}>{children}</motion.div>;
}
