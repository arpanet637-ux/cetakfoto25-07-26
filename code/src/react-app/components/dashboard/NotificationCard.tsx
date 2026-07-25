import { ReactNode } from "react";
import { cn } from "@/react-app/lib/utils";
import { AlertCircle, Clock, Package, Truck } from "lucide-react";

type NotificationType = "deadline" | "progress" | "stock" | "warning";

interface NotificationCardProps {
  type: NotificationType;
  title: string;
  description: string;
  meta?: ReactNode;
}

const typeConfig: Record<
  NotificationType,
  {
    icon: ReactNode;
    bgClass: string;
    iconBgClass: string;
    borderClass: string;
  }
> = {
  deadline: {
    icon: <AlertCircle className="h-5 w-5 text-white" />,
    bgClass: "bg-gradient-to-r from-red-50 to-red-100/50",
    iconBgClass: "bg-red-500",
    borderClass: "border-l-4 border-l-red-500",
  },
  progress: {
    icon: <Clock className="h-5 w-5 text-white" />,
    bgClass: "bg-gradient-to-r from-slate-50 to-slate-100/50",
    iconBgClass: "bg-slate-500",
    borderClass: "border-l-4 border-l-slate-400",
  },
  stock: {
    icon: <Package className="h-5 w-5 text-white" />,
    bgClass: "bg-gradient-to-r from-blue-50 to-blue-100/50",
    iconBgClass: "bg-blue-500",
    borderClass: "border-l-4 border-l-blue-500",
  },
  warning: {
    icon: <Truck className="h-5 w-5 text-white" />,
    bgClass: "bg-gradient-to-r from-amber-50 to-amber-100/50",
    iconBgClass: "bg-amber-500",
    borderClass: "border-l-4 border-l-amber-500",
  },
};

export default function NotificationCard({
  type,
  title,
  description,
  meta,
}: NotificationCardProps) {
  const config = typeConfig[type];

  return (
    <div
      className={cn(
        "flex items-start gap-4 rounded-lg p-4 transition-all hover:shadow-md",
        config.bgClass,
        config.borderClass
      )}
    >
      <div
        className={cn(
          "flex h-10 w-10 shrink-0 items-center justify-center rounded-full",
          config.iconBgClass
        )}
      >
        {config.icon}
      </div>
      <div className="min-w-0 flex-1">
        <h4 className="font-semibold text-foreground">{title}</h4>
        <p className="mt-0.5 text-sm text-muted-foreground">{description}</p>
        {meta && (
          <div className="mt-2 text-xs font-medium text-muted-foreground/70">
            {meta}
          </div>
        )}
      </div>
    </div>
  );
}
