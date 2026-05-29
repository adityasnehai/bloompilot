export default function AuthGroupLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <div className="relative overflow-hidden">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(197,162,90,0.24),transparent_38%),radial-gradient(circle_at_85%_18%,rgba(76,121,97,0.14),transparent_28%)]" />
      <div className="relative">{children}</div>
    </div>
  );
}
