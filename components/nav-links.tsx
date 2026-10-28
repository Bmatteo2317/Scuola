"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  BookIcon,
  CalendarIcon,
  CheckCircleIcon,
  ClockIcon,
  HomeIcon,
} from "./icons";

const LINKS = [
  { href: "/", label: "Dashboard", Icon: HomeIcon },
  { href: "/calendario", label: "Calendario", Icon: CalendarIcon },
  { href: "/orario", label: "Orario", Icon: ClockIcon },
  { href: "/materie", label: "Materie", Icon: BookIcon },
  { href: "/progetti", label: "Progetti", Icon: CheckCircleIcon },
];

export function NavLinks() {
  const pathname = usePathname();

  return (
    <nav className="nav">
      {LINKS.map(({ href, label, Icon }) => {
        const active = href === "/" ? pathname === "/" : pathname.startsWith(href);
        return (
          <Link
            key={href}
            href={href}
            className={active ? "nav-link active" : "nav-link"}
            aria-current={active ? "page" : undefined}
          >
            <Icon className="nav-icon" />
            {label}
          </Link>
        );
      })}
    </nav>
  );
}
