import {
  Bath,
  BedDouble,
  BrushCleaning,
  Car,
  CookingPot,
  Gift,
  House,
  type LucideIcon,
  Package,
  PawPrint,
  Phone,
  Recycle,
  Refrigerator,
  Shirt,
  ShoppingCart,
  ShowerHead,
  SprayCan,
  Sprout,
  Trash2,
  Utensils,
  WashingMachine,
  Wrench,
} from "lucide-preact";
import { type TaskSymbolId, taskSymbol } from "../../domain/taskSymbols";

/** The picture of every symbol of the fixed list (F8); the list itself is in the domain. */
const ICONS: Record<TaskSymbolId, LucideIcon> = {
  standard: House,
  broom: BrushCleaning,
  cleaner: SprayCan,
  bath: Bath,
  shower: ShowerHead,
  laundry: WashingMachine,
  clothes: Shirt,
  bed: BedDouble,
  cooking: CookingPot,
  dishes: Utensils,
  fridge: Refrigerator,
  trash: Trash2,
  recycling: Recycle,
  plant: Sprout,
  pet: PawPrint,
  shopping: ShoppingCart,
  parcel: Package,
  gift: Gift,
  phone: Phone,
  car: Car,
  tools: Wrench,
};

/** Just the picture, in the colour of the text around it (lucide sets `aria-hidden`). */
export function SymbolIcon({
  symbol,
  size,
}: {
  readonly symbol: TaskSymbolId;
  readonly size: number;
}) {
  const Icon = ICONS[symbol];
  return <Icon size={size} />;
}

interface TaskSymbolProps {
  readonly symbol: TaskSymbolId;
  /**
   * `tile`: the 44 px tile in the symbol's tone (DESIGN.md section 6). `small`: only the picture
   * in the tone, for the chips of the week. `plain`: only the picture in the text colour, for
   * coloured tiles such as "Überfällig".
   */
  readonly variant?: "tile" | "small" | "plain";
}

/** The symbol of a task. Decoration only: the title next to it says what the task is. */
export function TaskSymbol({ symbol, variant = "tile" }: TaskSymbolProps) {
  const { tone } = taskSymbol(symbol);
  const size = variant === "small" ? 16 : variant === "plain" ? 24 : 22;
  return (
    <span
      class={`task-symbol task-symbol--${variant} task-symbol--${tone}`}
      data-symbol={symbol}
      aria-hidden="true"
    >
      <SymbolIcon symbol={symbol} size={size} />
    </span>
  );
}
