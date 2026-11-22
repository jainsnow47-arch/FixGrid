export function Button({
  children,
  variant = 'primary',
  size = 'md',
  className = '',
  disabled = false,
  type = 'button',
  onClick,
  ...rest
}) {
  const base =
    'inline-flex items-center justify-center gap-2 font-semibold rounded-lg transition-all duration-150 whitespace-nowrap shrink-0 cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#245B45] disabled:opacity-55 disabled:cursor-not-allowed';

  const variants = {
    primary: 'bg-[#F07832] hover:bg-[#D96522] text-white shadow-sm active:scale-[0.99]',
    forest: 'bg-[#245B45] hover:bg-[#1A4332] text-white shadow-sm active:scale-[0.99]',
    secondary: 'bg-[#D5EBDD] hover:bg-[#C2E0CE] text-[#1A4332] border border-[#245B45]/15',
    outline: 'bg-transparent hover:bg-[#245B45]/5 text-[#245B45] border border-[#245B45]/25',
    ghost: 'bg-transparent hover:bg-[#245B45]/8 text-[#24332D]',
    danger: 'bg-[#A93226] hover:bg-[#8C281E] text-white',
  };

  const sizes = {
    sm: 'px-3 py-1.5 text-xs min-h-[36px]',
    md: 'px-4 py-2 text-sm min-h-[40px]',
    lg: 'px-6 py-3 text-base min-h-[46px]',
  };

  return (
    <button
      type={type}
      disabled={disabled}
      onClick={onClick}
      className={`${base} ${variants[variant] || variants.primary} ${sizes[size] || sizes.md} ${className}`}
      {...rest}
    >
      {children}
    </button>
  );
}
