export default function AuthGroupLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <div className="relative min-h-screen overflow-hidden bg-[#010102] text-[#f7f8f8]">
      <div className="relative">{children}</div>
    </div>
  );
}
