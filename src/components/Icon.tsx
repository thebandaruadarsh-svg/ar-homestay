import {
  BedDouble,
  Bell,
  Calendar,
  ChartColumn,
  CreditCard,
  FileText,
  KeyRound,
  LayoutGrid,
  LogOut,
  Plus,
  Search,
  Settings,
  Shield,
  Users,
  type LucideIcon,
  type LucideProps,
} from "lucide-react";

type IconName = "grid" | "bed" | "calendar" | "users" | "key" | "file" | "card" | "chart" | "shield" | "settings" | "bell" | "logout" | "search" | "plus";

const ICONS: Record<IconName, LucideIcon> = {
  grid: LayoutGrid,
  bed: BedDouble,
  calendar: Calendar,
  users: Users,
  key: KeyRound,
  file: FileText,
  card: CreditCard,
  chart: ChartColumn,
  shield: Shield,
  settings: Settings,
  bell: Bell,
  logout: LogOut,
  search: Search,
  plus: Plus,
};

export function Icon({ name, ...props }: { name: IconName } & LucideProps) {
  const Glyph = ICONS[name];
  return <Glyph aria-hidden className="icon" strokeWidth={1.75} {...props} />;
}
