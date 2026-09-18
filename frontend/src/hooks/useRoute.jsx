import { useEffect, useState } from "react";

function currentPath() {
  const hash = window.location.hash || "";
  const raw = hash.startsWith("#") ? hash.slice(1) : hash;
  if (!raw || raw === "/" || raw === "#") return "/dashboard";
  if (!raw.startsWith("/")) return `/${raw}`;
  return raw;
}

export function useRoute() {
  const [path, setPath] = useState(currentPath);

  useEffect(() => {
    const onChange = () => setPath(currentPath());
    window.addEventListener("hashchange", onChange);
    return () => window.removeEventListener("hashchange", onChange);
  }, []);

  return path;
}

export function navigate(to) {
  const target = to.startsWith("/") ? to : `/${to}`;
  if (currentPath() === target) return;
  window.location.hash = target;
}

export function Link({ to, children, className, onClick, ...rest }) {
  return (
    <a href={`#${to}`} className={className} onClick={onClick} {...rest}>
      {children}
    </a>
  );
}