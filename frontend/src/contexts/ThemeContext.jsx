import { createContext, useContext, useState, useEffect } from "react";

const ThemeContext = createContext({
  theme: "dark",
  setTheme: () => {},
  toggleTheme: () => {},
});

export function ThemeProvider({ children }) {
  const [theme, setThemeState] = useState(() => {
    try {
      return localStorage.getItem("railsetu_theme") || "dark";
    } catch {
      return "dark";
    }
  });

  const setTheme = (newTheme) => {
    setThemeState(newTheme);
    try {
      localStorage.setItem("railsetu_theme", newTheme);
    } catch (e) {
      console.warn("Could not persist theme to localStorage:", e);
    }
  };

  const toggleTheme = () => {
    setTheme(theme === "dark" ? "white" : "dark");
  };

  useEffect(() => {
    document.documentElement.setAttribute("data-theme", theme);
    if (theme === "white") {
      document.body.classList.add("theme-white");
      document.body.classList.remove("theme-dark");
    } else {
      document.body.classList.add("theme-dark");
      document.body.classList.remove("theme-white");
    }
  }, [theme]);

  return (
    <ThemeContext.Provider value={{ theme, setTheme, toggleTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  return useContext(ThemeContext);
}

export default ThemeContext;
