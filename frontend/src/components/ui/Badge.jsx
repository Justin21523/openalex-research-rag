const VARIANTS = {
  blue:    'bg-blue-50 text-blue-700 border-blue-100',
  green:   'bg-emerald-50 text-emerald-700 border-emerald-100',
  amber:   'bg-amber-50 text-amber-700 border-amber-100',
  purple:  'bg-purple-50 text-purple-700 border-purple-100',
  slate:   'bg-slate-100 text-slate-600 border-slate-200',
  red:     'bg-red-50 text-red-700 border-red-100',
};

export function Badge({ children, variant = 'slate', className = '' }) {
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border ${VARIANTS[variant]} ${className}`}>
      {children}
    </span>
  );
}

export function CitationChip({ id }) {
  return (
    <span className="inline-flex items-center mx-0.5 px-1.5 py-0.5 bg-blue-100 text-blue-800 text-xs font-mono rounded border border-blue-200">
      {id}
    </span>
  );
}
