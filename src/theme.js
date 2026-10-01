const storedTheme = localStorage.getItem("theme");
if (storedTheme) document.documentElement.style.colorScheme = storedTheme;

function toggleTheme() {
  const root = document.documentElement;
  const current = root.style.colorScheme || (matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light");
  const next = current === "dark" ? "light" : "dark";
  root.style.colorScheme = next;
  localStorage.setItem("theme", next);
}
