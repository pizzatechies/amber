import { Logo } from "@/components/site/logo";

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex flex-1 flex-col items-center px-4 py-10 sm:py-16">
      <Logo />
      <main className="mt-8 w-full max-w-md">{children}</main>
    </div>
  );
}
