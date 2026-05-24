"use client";

import { motion } from "framer-motion";
import { CheckCircle2, AlertCircle, type LucideIcon } from "lucide-react";
import { spring } from "@/styles/tokens";

type Variant = "success" | "error";

interface AuthBannerProps {
  variant: Variant;
  title: string;
  message?: string;
}

interface VariantStyle {
  bg: string;
  border: string;
  icon: LucideIcon;
  iconColor: string;
}

const variantStyles: Record<Variant, VariantStyle> = {
  success: {
    bg: "bg-success/10",
    border: "border-success/30",
    icon: CheckCircle2,
    iconColor: "text-success",
  },
  error: {
    bg: "bg-danger/10",
    border: "border-danger/30",
    icon: AlertCircle,
    iconColor: "text-danger",
  },
};

export function AuthBanner({ variant, title, message }: AuthBannerProps) {
  const styles = variantStyles[variant];
  const Icon = styles.icon;

  return (
    <motion.div
      initial={{ opacity: 0, y: -4 }}
      animate={{ opacity: 1, y: 0 }}
      transition={spring.smooth}
      className={`flex items-start gap-3 rounded-md border ${styles.bg} ${styles.border} px-4 py-3`}
    >
      <Icon className={`mt-0.5 h-4 w-4 flex-shrink-0 ${styles.iconColor}`} strokeWidth={1.75} />
      <div className="space-y-1">
        <p className="text-text-primary text-sm font-medium">{title}</p>
        {message && <p className="text-text-secondary text-xs leading-relaxed">{message}</p>}
      </div>
    </motion.div>
  );
}
