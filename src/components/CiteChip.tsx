interface Props {
  id: string;
  valid?: boolean;
  active?: boolean;
  onSelect?: (id: string) => void;
}

export function CiteChip({ id, valid = true, active = false, onSelect }: Props) {
  const base =
    "mx-0.5 inline-flex items-center rounded-[6px] border px-1.5 py-0.5 font-mono text-[11px] font-medium cursor-pointer transition-all";
  const color = !valid
    ? "border-rose-300 bg-rose-50 text-rose-700 line-through cursor-not-allowed"
    : active
      ? "border-[#171717] bg-[#171717] text-white shadow-xs"
      : "border-[#eaeaea] bg-white text-[#171717] hover:border-[#171717] hover:bg-[#fafafa]";
  return (
    <button
      type="button"
      disabled={!valid}
      onClick={() => onSelect?.(id)}
      title={valid ? `Show source chunk ${id}` : `Chunk ${id} was never retrieved (phantom citation)`}
      className={`${base} ${color}`}
    >
      [{id}]
    </button>
  );
}
