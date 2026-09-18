const LEVELS = {
  INFO: "INFO",
  WARN: "WARN",
  ERROR: "ERROR",
};

const MAX_ARG_LENGTH = 500;

function stringifyArg(arg) {
  if (arg instanceof Error) {
    return arg.stack || arg.message;
  }
  if (typeof arg === "string") {
    return arg;
  }
  try {
    const str = JSON.stringify(arg);
    return str.length > MAX_ARG_LENGTH ? `${str.slice(0, MAX_ARG_LENGTH)}...` : str;
  } catch {
    return String(arg);
  }
}

function write(level, message, args) {
  const timestamp = new Date().toISOString();
  const parts = args.map(stringifyArg);
  const rest = parts.length > 0 ? ` ${parts.join(" ")}` : "";
  const line = `[${timestamp}] [${level}] ${message}${rest}`;

  if (level === LEVELS.ERROR) {
    console.error(line);
  } else if (level === LEVELS.WARN) {
    console.warn(line);
  } else {
    console.log(line);
  }
}

module.exports = {
  info(message, ...args) {
    write(LEVELS.INFO, message, args);
  },
  warn(message, ...args) {
    write(LEVELS.WARN, message, args);
  },
  error(message, ...args) {
    write(LEVELS.ERROR, message, args);
  },
};