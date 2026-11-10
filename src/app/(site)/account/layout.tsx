import { NavTabs } from "@/components/site/nav-tabs";

export default function AccountLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="container-page py-10">
      <h1 className="font-display text-3xl font-semibold sm:text-4xl">Account</h1>
      <NavTabs
        className="mt-6"
        label="Account sections"
        items={[
          { href: "/account", label: "Profile" },
          { href: "/account/security", label: "Password" },
          { href: "/account/purchases", label: "Purchase history" },
        ]}
      />
      <div className="pt-8">{children}</div>
    </div>
  );
}
